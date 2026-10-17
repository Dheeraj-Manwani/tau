import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "./errors";
import { gh, ghPage, GithubApiError, githubReadError, resolveToken } from "./githubClient";
import { toPrSummary, type PrSummary } from "./github";

export type GithubListState = "open" | "closed" | "all";
interface Repo { full_name: string; default_branch: string; archived: boolean; has_issues: boolean; permissions?: { push?: boolean; pull?: boolean } }
interface Pr {
  number: number; html_url: string; title: string; state: string; merged_at: string | null;
  body: string | null; user: { login: string }; updated_at: string; draft: boolean;
  head: { ref: string; sha: string; repo: { full_name: string } | null };
  base: { ref: string; repo: { full_name: string } | null };
  additions: number; deletions: number; changed_files: number; commits: number; mergeable: boolean | null;
}
interface Issue {
  number: number; html_url: string; title: string; state: string; body: string | null;
  user: { login: string }; updated_at: string; created_at: string; comments: number;
  labels: (string | { name: string; color: string })[]; assignees: { login: string }[];
  pull_request?: unknown;
}
export interface GithubIssue {
  number: number; url: string; title: string; state: string; body: string; author: string;
  updatedAt: string; createdAt: string; comments: number; labels: string[]; assignees: string[];
}
export interface GithubPage<T> { repo: string; items: T[]; page: number; hasNext: boolean }
export interface GithubDetailSection<T> { available: boolean; items: T[]; hasMore: boolean; reason?: string }
export interface GithubReview { id: number; author: string; state: string; body: string; url: string; submittedAt: string | null; commitSha: string }
export interface GithubCheck { id: string; name: string; state: string; url: string | null; source: "check" | "status" }
export interface GithubPrDetail {
  repo: string; pr: PrSummary; headSha: string; additions: number; deletions: number; files: number; commits: number; mergeable: boolean | null;
  reviews: GithubDetailSection<GithubReview>; checks: GithubDetailSection<GithubCheck>; statuses: GithubDetailSection<GithubCheck>;
}

async function context(projectId: string, userId: string, expectedRepo: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true, githubRepo: true } });
  if (!project) throw Errors.notFound("Project not found");
  if (project.userId !== userId) throw Errors.forbidden("You do not have access to this project");
  if (!project.githubRepo || project.githubRepo.toLowerCase() !== expectedRepo.toLowerCase()) throw Errors.conflict("The linked repository changed. Refresh GitHub.");
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("Connect GitHub before using this workspace.");
  const repo = await gh<Repo>(token, "GET", `/repos/${expectedRepo}`);
  return { token, repo, path: `/repos/${repo.full_name}` };
}

async function checkAssociation(projectId: string, repo: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { githubRepo: true } });
  if (project?.githubRepo?.toLowerCase() !== repo.toLowerCase()) throw Errors.conflict("The linked repository changed. Refresh GitHub.");
}

function summary(pr: Pr, repo: Repo): PrSummary {
  return { ...toPrSummary(pr), canUpdate: !repo.archived && repo.permissions?.push === true && pr.state === "open" && !pr.merged_at && pr.head.ref !== repo.default_branch && pr.head.ref !== pr.base.ref && pr.head.repo?.full_name.toLowerCase() === repo.full_name.toLowerCase() && pr.base.repo?.full_name.toLowerCase() === repo.full_name.toLowerCase() };
}
function issueView(issue: Issue): GithubIssue {
  return { number: issue.number, url: issue.html_url, title: issue.title, state: issue.state, body: issue.body ?? "", author: issue.user?.login ?? "unknown", updatedAt: issue.updated_at, createdAt: issue.created_at, comments: issue.comments, labels: issue.labels.map((label) => typeof label === "string" ? label : label.name), assignees: issue.assignees.map((user) => user.login) };
}

export async function listGithubPulls(projectId: string, userId: string, opts: { repo: string; state: GithubListState; page: number }): Promise<GithubPage<PrSummary>> {
  try {
    const { token, repo, path } = await context(projectId, userId, opts.repo);
    const page = await ghPage<Pr[]>(token, `${path}/pulls?state=${opts.state}&sort=updated&direction=desc&per_page=20&page=${opts.page}`);
    await checkAssociation(projectId, repo.full_name);
    return { repo: repo.full_name, items: page.items.map((pr) => summary(pr, repo)), page: opts.page, hasNext: page.hasNext };
  } catch (err) { return githubReadError(err, userId); }
}

/** A missing review/check permission is independent of a pending check. */
async function detailSection<T>(userId: string, read: () => Promise<{ items: T[]; hasMore: boolean }>): Promise<GithubDetailSection<T>> {
  try { return { available: true, ...await read() }; }
  catch (err) {
    if (err instanceof GithubApiError && err.status === 401) return githubReadError(err, userId);
    const reason = err instanceof GithubApiError && err.rateLimited ? "GitHub rate limit reached. Try refreshing later." : err instanceof GithubApiError && [403, 404].includes(err.status) ? "Unavailable with your current GitHub access." : "GitHub could not load these results. Refresh to try again.";
    return { available: false, items: [], hasMore: false, reason };
  }
}

export async function getGithubPull(projectId: string, userId: string, expectedRepo: string, number: number): Promise<GithubPrDetail> {
  try {
    const { token, repo, path } = await context(projectId, userId, expectedRepo);
    const pr = await gh<Pr>(token, "GET", `${path}/pulls/${number}`);
    // Checks/statuses are attached to this SHA in the base repository. Fork head
    // checks can be configured there; an unavailable SHA is shown explicitly.
    const [reviews, checks, statuses] = await Promise.all([
      detailSection<GithubReview>(userId, async () => {
        const page = await ghPage<{ id: number; user: { login: string }; state: string; body: string | null; html_url: string; submitted_at: string | null; commit_id: string }[]>(token, `${path}/pulls/${number}/reviews?per_page=100&page=1`);
        return { items: page.items.map((r) => ({ id: r.id, author: r.user?.login ?? "unknown", state: r.state, body: r.body ?? "", url: r.html_url, submittedAt: r.submitted_at, commitSha: r.commit_id })), hasMore: page.hasNext };
      }),
      detailSection<GithubCheck>(userId, async () => {
        const page = await ghPage<{ total_count: number; check_runs: { id: number; name: string; status: string; conclusion: string | null; html_url: string | null; head_sha: string }[] }>(token, `${path}/commits/${pr.head.sha}/check-runs?filter=latest&per_page=100&page=1`);
        return { items: page.items.check_runs.filter((r) => r.head_sha === pr.head.sha).map((r) => ({ id: String(r.id), name: r.name, state: r.status === "completed" ? r.conclusion ?? "unknown" : r.status, url: r.html_url, source: "check" as const })), hasMore: page.hasNext || page.items.total_count > page.items.check_runs.length };
      }),
      detailSection<GithubCheck>(userId, async () => {
        const page = await ghPage<{ total_count: number; statuses: { id: number; context: string; state: string; target_url: string | null }[] }>(token, `${path}/commits/${pr.head.sha}/status?per_page=100&page=1`);
        return { items: page.items.statuses.map((r) => ({ id: String(r.id), name: r.context, state: r.state, url: r.target_url, source: "status" as const })), hasMore: page.hasNext || page.items.total_count > page.items.statuses.length };
      }),
    ]);
    const current = await gh<Pr>(token, "GET", `${path}/pulls/${number}`);
    if (current.head.sha !== pr.head.sha || current.head.ref !== pr.head.ref || current.base.ref !== pr.base.ref) throw Errors.conflict("The pull request changed while loading its details. Refresh to see its current checks.");
    await checkAssociation(projectId, repo.full_name);
    return { repo: repo.full_name, pr: summary(current, repo), headSha: pr.head.sha, additions: pr.additions, deletions: pr.deletions, files: pr.changed_files, commits: pr.commits, mergeable: current.mergeable, reviews, checks, statuses };
  } catch (err) { return githubReadError(err, userId); }
}

export async function listGithubIssues(projectId: string, userId: string, opts: { repo: string; state: GithubListState; page: number }): Promise<GithubPage<GithubIssue> & { canCreate: boolean; disabledReason?: string }> {
  try {
    const { token, repo, path } = await context(projectId, userId, opts.repo);
    if (!repo.has_issues) {
      await checkAssociation(projectId, repo.full_name);
      return { repo: repo.full_name, items: [], page: opts.page, hasNext: false, canCreate: false, disabledReason: "Issues are disabled for this repository." };
    }
    const page = await ghPage<Issue[]>(token, `${path}/issues?state=${opts.state}&sort=updated&direction=desc&per_page=20&page=${opts.page}`);
    await checkAssociation(projectId, repo.full_name);
    return { repo: repo.full_name, items: page.items.filter((issue) => !issue.pull_request).map(issueView), page: opts.page, hasNext: page.hasNext, canCreate: !repo.archived && repo.has_issues === true, ...(repo.archived ? { disabledReason: "This repository is archived." } : !repo.has_issues ? { disabledReason: "Issues are disabled for this repository." } : {}) };
  } catch (err) { return githubReadError(err, userId); }
}

export async function getGithubIssue(projectId: string, userId: string, expectedRepo: string, number: number): Promise<{ repo: string; issue: GithubIssue }> {
  try {
    const { token, repo, path } = await context(projectId, userId, expectedRepo);
    const issue = await gh<Issue>(token, "GET", `${path}/issues/${number}`);
    if (issue.pull_request) throw Errors.badRequest("This item is a pull request. Open it in Pull requests instead.");
    await checkAssociation(projectId, repo.full_name);
    return { repo: repo.full_name, issue: issueView(issue) };
  } catch (err) { return githubReadError(err, userId); }
}

/** Reused by the project's API and the worker's create_github_issue tool. */
export async function createProjectGithubIssue(projectId: string, userId: string, opts: { repo: string; title: string; description: string }) {
  try {
    const { token, repo, path } = await context(projectId, userId, opts.repo);
    if (repo.archived || !repo.has_issues) throw Errors.forbidden(repo.archived ? "This repository is archived." : "Issues are disabled for this repository.");
    const title = opts.title.trim();
    if (!title || title.length > 200 || opts.description.length > 5_000) throw Errors.badRequest("Provide an issue title up to 200 characters and a description up to 5,000 characters.");
    await checkAssociation(projectId, repo.full_name);
    const issue = await gh<Issue>(token, "POST", `${path}/issues`, { title, body: opts.description.trim() });
    return { issueUrl: issue.html_url, number: issue.number, summary: `Opened issue [#${issue.number}: ${issue.title}](${issue.html_url})` };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof GithubApiError) {
      if (err.status === 401 || err.rateLimited) return githubReadError(err, userId);
      if (err.status === 403) throw Errors.forbidden("GitHub did not allow creating this issue. Check repository access and interaction limits.");
      if (err.status === 422) throw Errors.badRequest("GitHub rejected the issue. Check its title and description.");
      if (err.status === 404) return githubReadError(err, userId);
    }
    throw new AppError("Issue creation could not be confirmed. Check the repository's issues on GitHub before creating another.", 503);
  }
}
