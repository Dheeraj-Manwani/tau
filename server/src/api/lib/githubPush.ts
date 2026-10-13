import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "./errors";
import { gh, GithubApiError, githubWriteError, resolveToken } from "./githubClient";
import { filterPushableFiles, type PushMode } from "./githubFiles";
import { checkGithubSnapshot, gitBlobSha, githubTarget, headSha, readProjectBlob, remoteTree, verifyGithubPreview } from "./githubComparison";
import type { PushResult } from "./github";

export interface ReviewedPushOptions {
  preview: string;
  title: string;
  description?: string;
  draft?: boolean;
  mode?: PushMode;
  prNumber?: number;
  branch?: string; // Worker preference; the review suffix prevents overwriting an existing ref.
}

interface PullRequest { number: number; html_url: string; state: string; head: { ref: string; repo: { full_name: string } | null }; base: { ref: string } }

function reviewBranch(title: string, suffix: string, requested?: string): string {
  const name = (requested || title).trim().toLowerCase().replace(/[^a-z0-9/_-]+/g, "-").replace(/\/{2,}/g, "/").replace(/^[-/]+|[-/]+$/g, "").slice(0, 60).replace(/[-/]+$/g, "") || "update";
  return `${name.startsWith("tau/") ? name : `tau/${name}`}-${suffix}`;
}

/** Publish only a signed review's immutable contents. GitHub performs the final SHA guard atomically. */
export async function pushReviewedProject(projectId: string, userId: string, opts: ReviewedPushOptions): Promise<PushResult> {
  const snapshot = verifyGithubPreview(projectId, userId, opts.preview);
  if ((opts.mode !== undefined && opts.mode !== snapshot.mode) || opts.prNumber !== snapshot.prNumber) throw Errors.conflict("The push target does not match the review. Refresh the comparison.");
  if (opts.draft && snapshot.mode !== "new_pr") throw Errors.badRequest("Draft creation is available only for a new pull request.");
  const title = opts.title.trim();
  if (!title || title.length > 200 || (opts.description?.length ?? 0) > 5_000) throw Errors.badRequest("Provide a title up to 200 characters and a description up to 5,000 characters.");
  const body = opts.description?.trim() ?? "";
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("Reconnect GitHub before pushing.");
  const reviewId = createHash("sha256").update(opts.preview).digest("hex");
  const branch = snapshot.mode === "new_pr" ? reviewBranch("reviewed-changes", reviewId.slice(0, 12), opts.branch) : snapshot.branch;
  const marker = `Tau-Review: ${reviewId}`;
  let commitSha: string | undefined;
  let repoUrl = `https://github.com/${snapshot.repo}`;
  let published = false;
  let recovered = false;
  try {
    // A repeated new-PR submission uses the same branch. Never create a second PR
    // or commit merely because the first response was lost.
    if (snapshot.mode === "new_pr") {
      try {
        const existingSha = await headSha(token, snapshot.repo, branch);
        const existing = await gh<{ message: string; parents: { sha: string }[] }>(token, "GET", `/repos/${snapshot.repo}/git/commits/${existingSha}`);
        if (!existing.message.endsWith(marker) || existing.parents[0]?.sha !== snapshot.headSha) throw Errors.conflict("This review's branch already exists with different changes. Refresh the comparison.");
        commitSha = existingSha;
        published = true;
        recovered = true;
      } catch (err) { if (!(err instanceof GithubApiError && err.status === 404)) throw err; }
    }
    if (!published) {
      const local = await checkGithubSnapshot(snapshot, token);
      if (local.target.repo.archived) throw Errors.forbidden("This repository is archived. Unarchive it on GitHub before pushing.");
      if (local.target.repo.permissions?.push !== true) throw Errors.forbidden("Your GitHub account has read-only access to this repository.");
      if (!local.target.repo.node_id) throw new AppError("Repository identity is unavailable. Refresh GitHub before pushing.", 503);
      repoUrl = local.target.repo.html_url;
      const entries = await remoteTree(token, snapshot.repo, snapshot.treeSha);
      const remote = new Map(entries.map((entry) => [entry.path, entry]));
      const pushable = await filterPushableFiles(userId, projectId, local.files);
      const tree: { path: string; mode: string; type: "blob"; sha: string | null }[] = [];
      for (let start = 0; start < pushable.length; start += 8) {
        const batch = await Promise.all(pushable.slice(start, start + 8).map(async (file) => {
          const bytes = await readProjectBlob(userId, projectId, file);
          const expected = gitBlobSha(bytes);
          const before = remote.get(file.path);
          if (before?.sha === expected) return null;
          // Base64 for every file preserves BOMs, arbitrary binary bytes and encodings.
          const blob = await gh<{ sha: string }>(token, "POST", `/repos/${snapshot.repo}/git/blobs`, { content: Buffer.from(bytes).toString("base64"), encoding: "base64" });
          if (blob.sha !== expected) throw new AppError("GitHub returned unexpected file content. Refresh before pushing.", 503);
          return { path: file.path, mode: before?.mode ?? "100644", type: "blob" as const, sha: blob.sha };
        }));
        for (const entry of batch) if (entry) tree.push(entry);
      }
      for (const path of snapshot.deletions) {
        const before = remote.get(path);
        if (!before || before.type !== "blob" || !["100644", "100755"].includes(before.mode)) throw Errors.conflict("The reviewed deletion is unavailable. Refresh the comparison.");
        tree.push({ path, mode: before.mode, type: "blob", sha: null });
      }
      if (!tree.length) throw Errors.conflict("There are no changed files to push. Refresh the comparison.");
      const result = await gh<{ sha: string }>(token, "POST", `/repos/${snapshot.repo}/git/trees`, { base_tree: snapshot.treeSha, tree });
      // Recheck before creating the commit and immediately before publishing its ref.
      await checkGithubSnapshot(snapshot, token);
      const commit = await gh<{ sha: string }>(token, "POST", `/repos/${snapshot.repo}/git/commits`, { message: `${title}${body && snapshot.mode === "direct" ? `\n\n${body}` : ""}\n\n${marker}`, tree: result.sha, parents: [snapshot.headSha] });
      commitSha = commit.sha;
      const final = await checkGithubSnapshot(snapshot, token);
      if (final.target.repo.archived) throw Errors.forbidden("This repository was archived. Refresh GitHub before pushing.");
      if (final.target.repo.permissions?.push !== true) throw Errors.forbidden("Repository write access changed. Refresh GitHub.");
      const refUpdates = snapshot.mode === "new_pr"
        ? [{ name: `refs/heads/${snapshot.branch}`, beforeOid: snapshot.headSha, afterOid: snapshot.headSha, force: false }, { name: `refs/heads/${branch}`, beforeOid: "0".repeat(40), afterOid: commitSha, force: false }]
        : [{ name: `refs/heads/${branch}`, beforeOid: snapshot.headSha, afterOid: commitSha, force: false }];
      try {
        const response = await gh<{ data?: { updateRefs: unknown }; errors?: { type?: string; message: string }[] }>(token, "POST", "/graphql", { query: "mutation PublishReview($input: UpdateRefsInput!) { updateRefs(input: $input) { clientMutationId } }", variables: { input: { repositoryId: final.target.repo.node_id, clientMutationId: reviewId, refUpdates } } });
        if (response.errors?.length) {
          if (response.errors.some((error) => error.type === "RATE_LIMITED" || /rate.?limit/i.test(error.message))) throw Errors.tooMany("GitHub's rate limit was reached. Check the branch on GitHub before refreshing the comparison.");
          if (response.errors.some((error) => error.type === "INTERNAL")) throw new AppError("GitHub could not complete this push. Refresh the comparison before trying again.", 503);
          const forbidden = response.errors.some((error) => error.type === "FORBIDDEN" || /permission|protected|rule|workflow/i.test(error.message));
          throw forbidden ? Errors.forbidden("GitHub refused the push. Check write access, branch rules, and workflow permissions.") : Errors.conflict("The GitHub branch changed or rejected this push. Refresh the comparison.");
        }
        if (!response.data?.updateRefs) throw new Error("Missing publication result");
        published = true;
      } catch (err) {
        // A timed-out response can follow a successful write. Confirm before reporting
        // failure; never retry a ref update automatically.
        try { published = await headSha(token, snapshot.repo, branch) === commitSha; }
        catch {
          if (!(err instanceof AppError || err instanceof GithubApiError)) return { repoUrl, branch, mode: snapshot.mode, commitUrl: `${repoUrl}/commit/${commitSha}`, summary: "Check the push on GitHub", warning: "The push response was interrupted and its result could not be confirmed. Check the commit on GitHub before starting another push." };
        }
        if (!published) throw err;
      }
    }
  } catch (err) { return githubWriteError(err, userId); }

  const confirmedAt = new Date();
  const result: PushResult = { repoUrl, branch, mode: snapshot.mode, commitUrl: `${repoUrl}/commit/${commitSha}`, summary: `Committed reviewed changes to [${snapshot.repo}](${repoUrl}) on ${branch}.` };
  try {
    if (snapshot.mode !== "direct") {
      let pr: PullRequest | undefined;
      if (snapshot.mode === "update_pr") {
        // Revalidate again: a PR can be closed or retargeted after its ref was pushed.
        const project = { githubRepo: snapshot.repo, githubPushMode: snapshot.mode, headSequence: snapshot.localSequence, lastPrNumber: snapshot.prNumber ?? null, lastPushedBranch: snapshot.branch };
        const target = await githubTarget(token, project, snapshot.mode, snapshot.prNumber);
        if (target.branch !== snapshot.branch || target.baseBranch !== snapshot.baseBranch) throw Errors.conflict("The pull request target changed after the commit was pushed.");
        pr = await gh<PullRequest>(token, "PATCH", `/repos/${snapshot.repo}/pulls/${snapshot.prNumber}`, { title, body });
      } else {
        const findPr = async () => {
          const prs = await gh<PullRequest[]>(token, "GET", `/repos/${snapshot.repo}/pulls?head=${encodeURIComponent(`${snapshot.repo.split("/")[0]}:${branch}`)}&state=open`);
          return prs.find((item) => item.head.ref === branch && item.head.repo?.full_name.toLowerCase() === snapshot.repo.toLowerCase() && item.base.ref === snapshot.baseBranch);
        };
        pr = await findPr();
        if (!pr && !recovered) {
          try { pr = await gh<PullRequest>(token, "POST", `/repos/${snapshot.repo}/pulls`, { title, body, head: branch, base: snapshot.baseBranch, draft: opts.draft ?? false }); }
          catch (err) { pr = await findPr(); if (!pr) throw err; }
        }
        if (!pr) throw Errors.conflict("This review was already pushed. Open its branch on GitHub to finish or inspect the pull request.");
      }
      result.prUrl = pr.html_url;
      result.prNumber = pr.number;
      result.summary = `${snapshot.mode === "update_pr" ? "Updated" : "Opened"} pull request [#${pr.number}](${pr.html_url}) with reviewed changes.`;
    }
  } catch (err) {
    let reason = "GitHub could not finish the pull request action.";
    try { await githubWriteError(err, userId); } catch (error) { if (error instanceof Error) reason = error.message; }
    result.warning = `The commit was pushed to ${branch}. ${reason} Open the commit on GitHub to finish the pull request; do not repeat the push.`;
  }
  try {
    const tracked = await prisma.project.findUnique({ where: { id: projectId }, select: { lastPushedAt: true, lastPushedCommitSha: true } });
    const saved = await prisma.project.updateMany({ where: { id: projectId, userId, githubRepo: snapshot.repo, OR: [{ lastPushedSequence: null }, { lastPushedSequence: { lte: snapshot.localSequence } }] }, data: { lastPushedBranch: branch, lastPushedSequence: snapshot.localSequence, lastPushedCommitSha: commitSha, lastPushedAt: tracked && tracked.lastPushedCommitSha === commitSha && tracked.lastPushedAt ? tracked.lastPushedAt : confirmedAt, ...(result.prNumber ? { lastPrNumber: result.prNumber, lastPrUrl: result.prUrl } : {}) } });
    if (!saved.count) result.warning = `${result.warning ? `${result.warning} ` : ""}Project tracking changed after publication. Refresh GitHub to see its current state.`;
  } catch { result.warning = `${result.warning ? `${result.warning} ` : ""}The commit succeeded, but Tau could not save its push tracking. Refresh GitHub.`; }
  return result;
}
