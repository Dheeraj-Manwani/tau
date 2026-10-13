import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { createTwoFilesPatch, diffLines } from "diff";
import { prisma } from "@/lib/prisma";
import { getBlob } from "@/lib/s3";
import { env } from "@/lib/env";
import { AppError, Errors } from "./errors";
import { filterPushableFiles, isPushMode, type PushMode } from "./githubFiles";
import { gh, GithubApiError, githubReadError, resolveToken } from "./githubClient";
import { isBinaryPath } from "./projectFiles";

const MAX_DIFF_BYTES = 200_000;
const MAX_PATCH_BYTES = 400_000;
const MAX_FILES = 5_000;

export interface GithubFileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  kind: "text" | "binary" | "large";
  beforeBytes: number;
  afterBytes: number;
}

export interface GithubComparison {
  preview: string;
  repo: string;
  branch: string;
  mode: PushMode;
  headSha: string;
  prNumber?: number;
  canPush: boolean;
  localSequence: number;
  files: GithubFileChange[];
  counts: { added: number; modified: number; deleted: number; total: number };
  repositoryOnly: { path: string; sizeBytes: number }[];
  excludedCount: number;
}

interface RemoteEntry {
  path: string;
  type: "blob" | "tree" | "commit";
  mode: string;
  sha: string;
  size?: number;
}

interface LocalFile { path: string; contentHash: string; sizeBytes: number }
interface LocalProject {
  githubRepo: string | null;
  githubPushMode: string;
  headSequence: number;
  lastPushedBranch: string | null;
  lastPrNumber: number | null;
}
export interface GithubSnapshot {
  purpose: "github_comparison";
  userId: string;
  projectId: string;
  repo: string;
  branch: string;
  mode: PushMode;
  headSha: string;
  treeSha: string;
  prNumber?: number;
  baseBranch: string;
  localSequence: number;
  manifestHash: string;
  deletions: string[];
}

export function gitBlobSha(bytes: Uint8Array): string {
  return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex");
}

function manifestHash(files: LocalFile[]): string {
  return createHash("sha256").update(JSON.stringify(files.map((f) => [f.path, f.contentHash, f.sizeBytes]))).digest("hex");
}

export async function readProjectBlob(userId: string, projectId: string, file: LocalFile): Promise<Uint8Array> {
  try {
    const bytes = await getBlob(userId, projectId, file.contentHash);
    if (createHash("sha256").update(bytes).digest("hex") !== file.contentHash) throw new Error("Stored blob hash mismatch");
    return bytes;
  } catch {
    throw new AppError(`Project file content is unavailable for ${file.path}. Try again to refresh the comparison.`, 503);
  }
}

async function readLocal(projectId: string) {
  // Read both inside a repeatable snapshot; a later version check catches writes
  // while the remote tree/blob requests are in flight.
  const [project, files] = await prisma.$transaction([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { githubRepo: true, githubPushMode: true, headSequence: true, lastPushedBranch: true, lastPrNumber: true },
    }),
    prisma.projectFile.findMany({ where: { projectId }, select: { path: true, contentHash: true, sizeBytes: true }, orderBy: { path: "asc" } }),
  ], { isolationLevel: "RepeatableRead" });
  if (!project) throw Errors.notFound("Project not found");
  if (!project.githubRepo) throw Errors.conflict("Link a repository before comparing files.");
  if (files.length > MAX_FILES) throw Errors.badRequest(`Comparison supports up to ${MAX_FILES.toLocaleString()} project files.`);
  if (files.some((file) => !validPath(file.path))) throw Errors.badRequest("A project file has an invalid repository path.");
  return { project: project as LocalProject, files, hash: manifestHash(files) };
}

export async function githubTarget(token: string, project: LocalProject, mode: PushMode, prNumber?: number) {
  const repoPath = `/repos/${project.githubRepo}`;
  const repo = await gh<{ default_branch: string; node_id: string; html_url: string; archived?: boolean; permissions?: { push?: boolean } }>(token, "GET", repoPath);
  if (!repo.default_branch) throw Errors.conflict("Initialize a default branch on GitHub before comparing files.");
  if (mode === "update_pr") {
    const number = prNumber ?? project.lastPrNumber;
    if (!number || (!prNumber && !project.lastPushedBranch)) throw Errors.conflict("Choose an open pull request to update.");
    const pr = await gh<{ state: string; merged_at?: string | null; head: { ref: string; repo: { full_name: string } | null }; base: { ref: string; repo: { full_name: string } | null } }>(token, "GET", `${repoPath}/pulls/${number}`);
    if (pr.state !== "open" || pr.merged_at || pr.head.repo?.full_name.toLowerCase() !== project.githubRepo?.toLowerCase() ||
      pr.base.repo?.full_name.toLowerCase() !== project.githubRepo?.toLowerCase() ||
      (!prNumber && pr.head.ref !== project.lastPushedBranch) || pr.head.ref === repo.default_branch || pr.head.ref === pr.base.ref) {
      throw Errors.conflict("This pull request cannot be updated from Tau. Choose an open pull request in the linked repository.");
    }
    return { repo, branch: pr.head.ref, baseBranch: pr.base.ref, prNumber: number };
  }
  if (prNumber !== undefined) throw Errors.badRequest("Select a pull request only when updating one.");
  return { repo, branch: repo.default_branch, baseBranch: repo.default_branch, prNumber: undefined };
}

export async function headSha(token: string, repo: string, branch: string): Promise<string> {
  const ref = await gh<{ object: { sha: string } }>(token, "GET", `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  return ref.object.sha;
}

export async function remoteTree(token: string, repo: string, treeSha: string): Promise<RemoteEntry[]> {
  const tree = await gh<{ tree: RemoteEntry[]; truncated: boolean }>(token, "GET", `/repos/${repo}/git/trees/${treeSha}?recursive=1`);
  // Never show a complete-looking count from GitHub's incomplete tree response.
  if (tree.truncated) throw Errors.badRequest("This repository is too large for a complete comparison in Tau. Review it on GitHub.");
  if (tree.tree.filter((entry) => entry.type !== "tree").length > MAX_FILES) {
    throw Errors.badRequest(`Comparison supports repositories with up to ${MAX_FILES.toLocaleString()} files. Review this repository on GitHub.`);
  }
  return tree.tree;
}

function validPath(path: string): boolean {
  return !!path && !path.startsWith("/") && !path.includes("\\") && !/[\x00-\x1f\x7f]/.test(path) &&
    !path.split("/").some((part) => !part || part === "." || part === "..");
}

function isRegular(entry: RemoteEntry): boolean {
  return entry.type === "blob" && ["100644", "100755"].includes(entry.mode);
}

function decodeText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return null; }
}

function fileKind(path: string, beforeBytes: number, bytes: Uint8Array): GithubFileChange["kind"] {
  if (isBinaryPath(path) || (bytes.byteLength <= MAX_DIFF_BYTES && decodeText(bytes) === null)) return "binary";
  return Math.max(beforeBytes, bytes.byteLength) > MAX_DIFF_BYTES ? "large" : "text";
}

export async function checkGithubSnapshot(snapshot: GithubSnapshot, token: string) {
  const local = await readLocal(snapshot.projectId);
  if (local.project.githubRepo !== snapshot.repo || local.project.headSequence !== snapshot.localSequence || local.hash !== snapshot.manifestHash) {
    throw Errors.conflict("Project files or the linked repository changed. Refresh the comparison.");
  }
  const target = await githubTarget(token, local.project, snapshot.mode, snapshot.prNumber);
  if (target.branch !== snapshot.branch || target.baseBranch !== snapshot.baseBranch || await headSha(token, snapshot.repo, target.branch) !== snapshot.headSha) {
    throw Errors.conflict("The GitHub branch changed. Refresh the comparison.");
  }
  return { ...local, target };
}

/** Read-only overlay: remote-only entries survive unless explicitly selected. */
export async function compareGithubFiles(projectId: string, userId: string, opts: { mode?: PushMode; deletions?: string[]; prNumber?: number }): Promise<GithubComparison> {
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("Connect your GitHub account before comparing files.");
  try {
    const local = await readLocal(projectId);
    const repo = local.project.githubRepo!;
    const mode = opts.mode ?? (isPushMode(local.project.githubPushMode) ? local.project.githubPushMode : "new_pr");
    const target = await githubTarget(token, local.project, mode, opts.prNumber);
    const branch = target.branch;
    const sha = await headSha(token, repo, branch);
    const commit = await gh<{ tree: { sha: string } }>(token, "GET", `/repos/${repo}/git/commits/${sha}`);
    const entries = await remoteTree(token, repo, commit.tree.sha);
    const remote = new Map(entries.map((entry) => [entry.path, entry]));
    const pushable = await filterPushableFiles(userId, projectId, local.files);
    const localPaths = new Set(local.files.map((f) => f.path));
    const safeRemote = await filterPushableFiles(userId, projectId, [
      ...local.files.filter((f) => f.path === ".gitignore"),
      ...entries.filter((e) => isRegular(e) && !localPaths.has(e.path) && validPath(e.path)).map((e) => ({ path: e.path, contentHash: e.sha, sizeBytes: e.size ?? 0 })),
    ]);
    const repositoryOnly = safeRemote.filter((f) => !localPaths.has(f.path)).map((f) => ({ path: f.path, sizeBytes: f.sizeBytes }));
    const deletions = [...new Set(opts.deletions ?? [])].sort();
    const deletable = new Set(repositoryOnly.map((f) => f.path));
    if (deletions.some((path) => !deletable.has(path))) throw Errors.badRequest("Only eligible repository-only files can be selected for deletion review.");
    const changes: GithubFileChange[] = [];
    // Keep R2 concurrency bounded; comparison uploads nothing to GitHub.
    for (let start = 0; start < pushable.length; start += 8) {
      const batch = await Promise.all(pushable.slice(start, start + 8).map(async (file) => {
        if (!validPath(file.path)) throw Errors.badRequest("A project file has an invalid repository path.");
        const before = remote.get(file.path);
        if ((before && !isRegular(before)) || file.path.split("/").slice(0, -1).some((_, index, parts) => {
          const parent = remote.get(parts.slice(0, index + 1).join("/"));
          return parent && parent.type !== "tree";
        })) throw Errors.conflict(`Cannot compare ${file.path}: a directory, symlink or submodule occupies this path on GitHub.`);
        const bytes = await readProjectBlob(userId, projectId, file);
        if (before?.sha === gitBlobSha(bytes)) return null;
        return { path: file.path, status: before ? "modified" as const : "added" as const, kind: fileKind(file.path, before?.size ?? 0, bytes), beforeBytes: before?.size ?? 0, afterBytes: bytes.byteLength };
      }));
      for (const file of batch) if (file) changes.push(file);
    }
    for (const path of deletions) {
      const before = remote.get(path)!;
      changes.push({ path, status: "deleted", kind: isBinaryPath(path) ? "binary" : (before.size ?? 0) > MAX_DIFF_BYTES ? "large" : "text", beforeBytes: before.size ?? 0, afterBytes: 0 });
    }
    changes.sort((a, b) => a.path.localeCompare(b.path));
    const snapshot: GithubSnapshot = { purpose: "github_comparison", userId, projectId, repo, branch, mode, headSha: sha, treeSha: commit.tree.sha, prNumber: target.prNumber, baseBranch: target.baseBranch, localSequence: local.project.headSequence, manifestHash: local.hash, deletions };
    await checkGithubSnapshot(snapshot, token);
    return {
      preview: jwt.sign(snapshot, env.ACCESS_TOKEN_SECRET, { algorithm: "HS256", expiresIn: "15m" }),
      repo, branch, mode, headSha: sha, prNumber: target.prNumber, canPush: target.repo.permissions?.push === true && !target.repo.archived, localSequence: snapshot.localSequence, files: changes,
      counts: { added: changes.filter((f) => f.status === "added").length, modified: changes.filter((f) => f.status === "modified").length, deleted: deletions.length, total: changes.length },
      repositoryOnly, excludedCount: local.files.length - pushable.length,
    };
  } catch (err) { return githubReadError(err, userId); }
}

export interface GithubFileDiff {
  path: string;
  kind: "text" | "binary" | "large";
  patch: string | null;
  additions: number | null;
  deletions: number | null;
}

export async function githubFileDiff(projectId: string, userId: string, path: string, preview: string): Promise<GithubFileDiff> {
  const snapshot = verifyGithubPreview(projectId, userId, preview);
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("Reconnect your GitHub account before reviewing files.");
  try {
    const local = await checkGithubSnapshot(snapshot, token);
    const reviewed = async (result: GithubFileDiff) => {
      await checkGithubSnapshot(snapshot, token);
      return result;
    };
    const pushable = await filterPushableFiles(userId, projectId, local.files);
    const file = pushable.find((f) => f.path === path);
    const deleted = snapshot.deletions.includes(path);
    if (!file && !deleted) throw Errors.notFound("This file is not included in the comparison.");
    const entries = await remoteTree(token, snapshot.repo, snapshot.treeSha);
    const before = entries.find((e) => e.path === path);
    if (before && !isRegular(before)) throw Errors.conflict("This path cannot be reviewed as a regular file.");
    const after = file ? await readProjectBlob(userId, projectId, file) : new Uint8Array();
    if (file && before?.sha === gitBlobSha(after)) throw Errors.notFound("This file has no changes to review.");
    let kind = fileKind(path, before?.size ?? 0, after);
    if (kind !== "text") return await reviewed({ path, kind, patch: null, additions: null, deletions: null });
    let beforeBytes = new Uint8Array();
    if (before) {
      const blob = await gh<{ content: string; encoding: string; size: number }>(token, "GET", `/repos/${snapshot.repo}/git/blobs/${before.sha}`);
      if (blob.size > MAX_DIFF_BYTES) return await reviewed({ path, kind: "large", patch: null, additions: null, deletions: null });
      if (blob.encoding !== "base64") throw new Error("Unexpected GitHub blob encoding");
      beforeBytes = Buffer.from(blob.content, "base64");
      if (gitBlobSha(beforeBytes) !== before.sha) throw new Error("Remote blob hash mismatch");
    }
    const oldText = decodeText(beforeBytes);
    const newText = decodeText(after);
    if (oldText === null || newText === null) kind = "binary";
    if (kind === "binary") return await reviewed({ path, kind, patch: null, additions: null, deletions: null });
    const parts = diffLines(oldText!, newText!, { timeout: 1_000 });
    if (!parts) return await reviewed({ path, kind: "large", patch: null, additions: null, deletions: null });
    const patch = createTwoFilesPatch(before ? `a/${path}` : "/dev/null", deleted ? "/dev/null" : `b/${path}`, oldText!, newText!, "", "", { context: 3, timeout: 1_000 });
    if (!patch || Buffer.byteLength(patch) > MAX_PATCH_BYTES) return await reviewed({ path, kind: "large", patch: null, additions: null, deletions: null });
    return await reviewed({ path, kind: "text", patch, additions: parts.reduce((n, p) => n + (p.added ? p.count ?? 0 : 0), 0), deletions: parts.reduce((n, p) => n + (p.removed ? p.count ?? 0 : 0), 0) });
  } catch (err) { return githubReadError(err, userId); }
}

export function verifyGithubPreview(projectId: string, userId: string, preview: string): GithubSnapshot {
  try {
    const verified = jwt.verify(preview, env.ACCESS_TOKEN_SECRET, { algorithms: ["HS256"] }) as GithubSnapshot;
    if (verified.purpose !== "github_comparison" || verified.projectId !== projectId || verified.userId !== userId) throw new Error("Wrong preview");
    if (!verified.baseBranch || !isPushMode(verified.mode) || !Array.isArray(verified.deletions)) throw new Error("Old preview");
    return verified;
  } catch { throw Errors.conflict("This comparison expired or is invalid. Refresh the comparison."); }
}
