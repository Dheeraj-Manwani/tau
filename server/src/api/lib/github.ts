import { prisma } from "@/lib/prisma";
import { Errors } from "./errors";
import { isPushMode, type PushMode } from "./githubFiles";
import { gh, ghPage, GithubApiError, resolveToken, dropConnection, githubReadError, githubWriteError } from "./githubClient";

/**
 * Shared with the worker, which imports `pushProjectToGithub` for the agent's
 * push tool. It lives under `api/lib/` rather than `lib/` because it depends on
 * `projectFiles.ts` (`isBinaryPath` / `isSecretPath`), which is still api-owned.
 *
 * There used to be a second copy in the worker that was missing the base64
 * branch in `filterPushableFiles`, so agent-initiated pushes silently corrupted
 * every binary file (images) while api-initiated pushes handled them correctly.
 * Deleting that copy fixed it.
 *
 * Server-side git engine. We never run `git` in the sandbox — instead we build
 * reviewed overlays with the Git Data API and publish refs atomically through GraphQL.
 *
 * The commit content is the stored `ProjectFile` set (the same source of truth
 * `rehydrateSandbox` reads from), so pushing works whether or not a sandbox is
 * awake, and the token never leaves this process.
 */

export { filterPushableFiles, isPushMode, PUSH_MODES, type PushMode } from "./githubFiles";

export interface PushResult {
  repoUrl: string;
  /** Present for new_pr / update_pr; absent for a direct commit. */
  prUrl?: string;
  branch: string;
  mode: PushMode;
  /** Markdown shown in the chat UI; also readable by the model. */
  summary: string;
  commitUrl?: string;
  prNumber?: number;
  warning?: string;
}

export interface PushError {
  error: string;
}

export interface RepoSummary {
  fullName: string;
  htmlUrl: string;
  visibility: "private" | "public" | "internal";
  defaultBranch: string;
  canPush?: boolean;
  canAdmin?: boolean;
  canChangeVisibility?: boolean;
  archived?: boolean;
  visibilityReason?: string;
}

export interface PrSummary {
  url: string;
  number: number;
  title: string;
  state: string; // "open" | "closed"
  merged?: boolean;
  author?: string;
  updatedAt?: string;
  headBranch?: string;
  baseBranch?: string;
  draft?: boolean;
  body?: string;
  canUpdate?: boolean;
}

export interface GithubProjectInfo {
  connected: boolean;
  username: string | null;
  repo: RepoSummary | null;
  lastPr: PrSummary | null;
  openPrs: PrSummary[];
  /** Rough "changes since last push" — headSequence minus last-pushed sequence. */
  unpushedChanges: number;
  pushMode: PushMode;
  lastPush?: { at: string; commitSha: string; commitUrl: string; branch: string } | null;
}

interface GithubUser {
  id: number;
  login: string;
}

/** Look up the account behind a token. Returns null on 401 (revoked/invalid). */
async function fetchGithubUser(token: string): Promise<GithubUser | null> {
  try {
    const data = await gh<GithubUser>(token, "GET", "/user");
    return { id: data.id, login: data.login };
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 401) return null;
    throw err;
  }
}

/** Turn a project name into a valid, collision-resistant GitHub repo slug. */
function slugifyRepoName(name: string): string {
  const slug = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  return slug || "tau-project";
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 8);
}

interface RepoInfo {
  fullName: string; // "owner/repo"
  owner: string;
  repo: string;
  htmlUrl: string;
  defaultBranch: string;
  visibility: "private" | "public" | "internal";
}

interface GithubRepoResponse {
  full_name: string;
  name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  owner: { login: string };
  permissions?: { push?: boolean; admin?: boolean };
  archived?: boolean;
  fork?: boolean;
  visibility?: string;
}

export function repositorySummary(r: GithubRepoResponse): RepoSummary {
  const info = toRepoInfo(r);
  const canAdmin = r.permissions?.admin === true;
  const canChangeVisibility = canAdmin && !r.archived && !r.fork && r.visibility !== "internal";
  return { fullName: info.fullName, htmlUrl: info.htmlUrl, visibility: info.visibility, defaultBranch: info.defaultBranch,
    canPush: r.permissions?.push === true && !r.archived, canAdmin, canChangeVisibility, archived: r.archived === true,
    ...(!canChangeVisibility ? { visibilityReason: r.archived ? "This repository is archived." : r.fork ? "Fork visibility follows its repository network." : r.visibility === "internal" ? "Manage internal repository visibility on GitHub." : "Repository admin access is required to change visibility." } : {}),
  };
}

function toRepoInfo(r: GithubRepoResponse): RepoInfo {
  return {
    fullName: r.full_name,
    owner: r.owner.login,
    repo: r.name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch || "main",
    visibility: r.visibility === "internal" ? "internal" : r.private ? "private" : "public",
  };
}

interface GithubPrResponse {
  html_url: string;
  number: number;
  title: string;
  state: string;
  merged?: boolean;
  merged_at?: string | null;
  user?: { login: string };
  updated_at?: string;
  head?: { ref: string; repo?: { full_name: string } | null };
  base?: { ref: string; repo?: { full_name: string } | null };
  draft?: boolean;
  body?: string | null;
}

export function toPrSummary(p: GithubPrResponse): PrSummary {
  return {
    url: p.html_url,
    number: p.number,
    title: p.title,
    state: p.state,
    merged: p.merged ?? Boolean(p.merged_at),
    author: p.user?.login,
    updatedAt: p.updated_at,
    headBranch: p.head?.ref,
    baseBranch: p.base?.ref,
    draft: p.draft,
    body: p.body ?? "",
  };
}

/** Persist the cached repo facts on the project row after a lookup/link. */
async function cacheRepoFacts(
  projectId: string,
  repo: RepoInfo,
  expectedRepo: string | null,
): Promise<void> {
  await prisma.project
    .updateMany({
      where: { id: projectId, githubRepo: expectedRepo },
      data: {
        githubRepo: repo.fullName,
        githubDefaultBranch: repo.defaultBranch,
        githubVisibility: repo.visibility,
      },
    })
    .catch(() => {});
}

/** Look up an existing linked repo, or create a fresh private one (auto-init'd). */
async function ensureRepo(
  token: string,
  project: { id: string; name: string; githubRepo: string | null },
  description: string,
): Promise<RepoInfo> {
  if (project.githubRepo) {
    const [owner, repo] = project.githubRepo.split("/");
    const existing = await gh<GithubRepoResponse>(
      token,
      "GET",
      `/repos/${owner}/${repo}`,
    );
    return toRepoInfo(existing);
  }

  // auto_init gives us an initial commit + default branch to PR into.
  const base = slugifyRepoName(project.name);
  let lastErr: unknown;
  for (const candidate of [
    base,
    `${base}-${shortId()}`,
    `${base}-${shortId()}`,
  ]) {
    try {
      const created = await gh<GithubRepoResponse>(
        token,
        "POST",
        `/user/repos`,
        {
          name: candidate,
          description: description.slice(0, 350),
          private: true,
          auto_init: true,
        },
      );
      const info = toRepoInfo(created);
      await cacheRepoFacts(project.id, info, null);
      return info;
    } catch (err) {
      // 422 = name already taken (or invalid); try the next candidate.
      if (err instanceof GithubApiError && err.status === 422) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("Could not create a GitHub repository");
}

/** Worker/mobile compatibility: generate a fresh review and use the same overlay engine. */
export async function pushProjectToGithub(
  projectId: string,
  userId: string,
  opts: { title: string; body: string; mode?: PushMode; branch?: string },
): Promise<PushResult | PushError> {
  try {
    const token = await resolveToken(userId);
    if (!token) throw Errors.conflict("Connect your GitHub account before pushing.");
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, userId: true, name: true, githubRepo: true } });
    if (!project) throw Errors.notFound("Project not found");
    if (project.userId !== userId) throw Errors.forbidden("You do not have access to this project");
    if (!project.githubRepo) {
      const repo = await ensureRepo(token, project, opts.title);
      await getHeadShaWithRetry(token, repo.owner, repo.repo, repo.defaultBranch);
    }
    const { compareGithubFiles } = await import("./githubComparison");
    const { pushReviewedProject } = await import("./githubPush");
    const review = await compareGithubFiles(projectId, userId, { mode: opts.mode });
    return await pushReviewedProject(projectId, userId, { preview: review.preview, title: opts.title || "Update from Tau", description: opts.body, mode: review.mode, prNumber: review.prNumber, branch: opts.branch });
  } catch (err) {
    try { await githubWriteError(err, userId); } catch (error) {
      return { error: error instanceof Error ? error.message : "GitHub push failed." };
    }
    return { error: "GitHub push failed." };
  }
}

/** Auto-initialized repositories can briefly lack a readable default ref. */
async function getHeadShaWithRetry(token: string, owner: string, repo: string, branch: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try { await gh(token, "GET", `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`); return; }
    catch (err) {
      if (!(err instanceof GithubApiError && err.status === 404) || attempt >= 3) throw err;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

/**
 * Everything the GitHub panel shows for a project: connection + linked repo +
 * last/open PRs + a rough count of changes since the last push.
 */
export async function getGithubProjectInfo(
  projectId: string,
  userId: string,
): Promise<GithubProjectInfo> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      githubRepo: true,
      githubDefaultBranch: true,
      githubVisibility: true,
      githubPushMode: true,
      headSequence: true,
      lastPushedSequence: true,
      lastPrNumber: true,
      lastPushedAt: true,
      lastPushedCommitSha: true,
      lastPushedBranch: true,
    },
  });

  const pushMode: PushMode = isPushMode(project?.githubPushMode)
    ? project!.githubPushMode
    : "new_pr";

  const token = await resolveToken(userId);
  const empty: GithubProjectInfo = {
    connected: false,
    username: null,
    repo: null,
    lastPr: null,
    openPrs: [],
    unpushedChanges: 0,
    pushMode,
    lastPush: null,
  };
  if (!token || !project) return empty;

  const ghUser = await fetchGithubUser(token).catch((err) => githubReadError(err, userId));
  if (!ghUser) {
    await dropConnection(userId);
    return empty;
  }

  let repo: RepoSummary | null = null;
  let lastPr: PrSummary | null = null;
  let openPrs: PrSummary[] = [];

  if (project.githubRepo) {
    const [owner, name] = project.githubRepo.split("/");
    try {
      const r = await gh<GithubRepoResponse>(
        token,
        "GET",
        `/repos/${owner}/${name}`,
      );
      const info = toRepoInfo(r);
      repo = repositorySummary(r);
      // Refresh cached facts if they drifted.
      if (
        info.defaultBranch !== project.githubDefaultBranch ||
        info.visibility !== project.githubVisibility
      ) {
        await cacheRepoFacts(projectId, info, project.githubRepo);
      }

      const prs = await gh<GithubPrResponse[]>(
        token,
        "GET",
        `/repos/${owner}/${name}/pulls?state=open&per_page=10`,
      );
      const summarize = (pr: GithubPrResponse): PrSummary => ({ ...toPrSummary(pr), canUpdate: repo!.canPush === true && pr.state === "open" && !pr.merged_at && pr.head?.ref !== info.defaultBranch && pr.head?.ref !== pr.base?.ref && pr.head?.repo?.full_name.toLowerCase() === info.fullName.toLowerCase() && pr.base?.repo?.full_name.toLowerCase() === info.fullName.toLowerCase() });
      openPrs = prs.map(summarize);

      if (project.lastPrNumber) {
        try {
          const pr = await gh<GithubPrResponse>(
            token,
            "GET",
            `/repos/${owner}/${name}/pulls/${project.lastPrNumber}`,
          );
          lastPr = summarize(pr);
        } catch (err) {
          if (!(err instanceof GithubApiError && err.status === 404)) throw err;
        }
      }
    } catch (err) {
      if (err instanceof GithubApiError && err.status === 401) {
        await dropConnection(userId);
        return empty;
      }
      return githubReadError(err, userId);
    }
  }

  const association = await prisma.project.findUnique({ where: { id: projectId }, select: { githubRepo: true } });
  if (association?.githubRepo !== (repo?.fullName ?? project.githubRepo)) throw Errors.conflict("The linked repository changed. Refresh GitHub.");
  const unpushedChanges = repo
    ? Math.max(0, project.headSequence - (project.lastPushedSequence ?? 0))
    : 0;

  return {
    connected: true,
    username: ghUser.login,
    repo,
    lastPr,
    openPrs,
    unpushedChanges,
    pushMode,
    lastPush: repo && project.lastPushedAt && project.lastPushedCommitSha && project.lastPushedBranch ? { at: project.lastPushedAt.toISOString(), commitSha: project.lastPushedCommitSha, commitUrl: `${repo.htmlUrl}/commit/${project.lastPushedCommitSha}`, branch: project.lastPushedBranch } : null,
  };
}

async function ownedGithubProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { userId: true, githubRepo: true } });
  if (!project) throw Errors.notFound("Project not found");
  if (project.userId !== userId) throw Errors.forbidden("You do not have access to this project");
  return project;
}

/** Link an accessible repository without importing or modifying remote files. */
export async function linkExistingRepo(
  projectId: string,
  userId: string,
  repoFullName: string,
): Promise<RepoSummary | PushError> {
  const project = await ownedGithubProject(projectId, userId);
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("GitHub is not connected.");

  const parts = repoFullName.split("/");
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoFullName) || parts.some((part) => part === "." || part === "..")) {
    throw Errors.badRequest("Expected a repository in 'owner/repo' form.");
  }

  try {
    const r = await gh<GithubRepoResponse>(
      token,
      "GET",
      `/repos/${parts[0]}/${parts[1]}`,
    );
    const info = toRepoInfo(r);
    if (project.githubRepo?.toLowerCase() === info.fullName.toLowerCase()) return repositorySummary(r);
    const saved = await prisma.project.updateMany({
      where: { id: projectId, userId, githubRepo: project.githubRepo },
      data: {
        githubRepo: info.fullName,
        githubDefaultBranch: info.defaultBranch,
        githubVisibility: info.visibility,
        // A different repo — reset last-push bookkeeping.
        lastPushedBranch: null,
        lastPrUrl: null,
        lastPrNumber: null,
        lastPushedSequence: null,
        lastPushedAt: null,
        lastPushedCommitSha: null,
      },
    });
    if (!saved.count) throw Errors.conflict("The repository association changed. Refresh GitHub before linking.");
    return repositorySummary(r);
  } catch (err) {
    return githubReadError(err, userId);
  }
}

/** Detach a project from its repo (does not touch the repo on GitHub). */
export async function unlinkRepo(
  projectId: string,
  userId: string,
): Promise<void> {
  const project = await ownedGithubProject(projectId, userId);
  const saved = await prisma.project.updateMany({
    where: { id: projectId, userId, githubRepo: project.githubRepo },
    data: {
      githubRepo: null,
      githubDefaultBranch: null,
      githubVisibility: null,
      lastPushedBranch: null,
      lastPrUrl: null,
      lastPrNumber: null,
      lastPushedSequence: null,
      lastPushedAt: null,
      lastPushedCommitSha: null,
    },
  });
  if (!saved.count) throw Errors.conflict("The repository association changed. Refresh GitHub.");
}

export interface UserRepo {
  fullName: string;
  private: boolean;
  htmlUrl: string;
  canPush?: boolean;
  canAdmin?: boolean;
  archived?: boolean;
}

export type RepoAffiliation = "all" | "owner" | "collaborator" | "organization_member";
export interface UserRepoPage { repos: UserRepo[]; page: number; hasNext: boolean }

/** Accessible repositories, newest activity first, including collaborator/org access. */
export async function listUserRepos(
  userId: string,
  opts: { page: number; affiliation: RepoAffiliation } = { page: 1, affiliation: "all" },
): Promise<UserRepoPage> {
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("GitHub is not connected.");
  try {
    const affiliation = opts.affiliation === "all" ? "owner,collaborator,organization_member" : opts.affiliation;
    const page = await ghPage<GithubRepoResponse[]>(token, `/user/repos?per_page=30&sort=updated&direction=desc&affiliation=${affiliation}&page=${opts.page}`);
    return { page: opts.page, hasNext: page.hasNext, repos: page.items.map((r) => ({
      fullName: r.full_name,
      private: r.private,
      htmlUrl: r.html_url,
      canPush: r.permissions?.push === true && !r.archived,
      canAdmin: r.permissions?.admin === true,
      archived: r.archived === true,
    })) };
  } catch (err) {
    return githubReadError(err, userId);
  }
}

/** Flip a linked repo between private and public. */
export async function setRepoVisibility(
  projectId: string,
  userId: string,
  makePrivate: boolean,
  expectedRepo?: string,
): Promise<RepoSummary | PushError> {
  const project = await ownedGithubProject(projectId, userId);
  if (!project.githubRepo) throw Errors.conflict("No repository is linked.");
  if (expectedRepo && expectedRepo.toLowerCase() !== project.githubRepo.toLowerCase()) throw Errors.conflict("The linked repository changed. Refresh GitHub.");
  const token = await resolveToken(userId);
  if (!token) throw Errors.conflict("GitHub is not connected.");

  const [owner, name] = project.githubRepo.split("/");
  try {
    const current = await gh<GithubRepoResponse>(token, "GET", `/repos/${owner}/${name}`);
    const capability = repositorySummary(current);
    if (!capability.canChangeVisibility) throw Errors.forbidden(capability.visibilityReason!);
    const latest = await ownedGithubProject(projectId, userId);
    if (latest.githubRepo !== project.githubRepo) throw Errors.conflict("The linked repository changed. Refresh GitHub.");
    if (current.private === makePrivate) return capability;
    const r = await gh<GithubRepoResponse>(
      token,
      "PATCH",
      `/repos/${owner}/${name}`,
      { private: makePrivate },
    );
    const info = toRepoInfo(r);
    const saved = await prisma.project.updateMany({
      where: { id: projectId, userId, githubRepo: project.githubRepo },
      data: { githubVisibility: info.visibility },
    });
    if (!saved.count) throw Errors.conflict("Visibility changed on GitHub, but the project association changed. Refresh GitHub to see its current repository.");
    return repositorySummary(r);
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 422) {
      throw Errors.conflict("GitHub refused the visibility change. Repository or organization policy may block it.");
    }
    if (err instanceof GithubApiError && err.status === 403 && !err.rateLimited) throw Errors.forbidden("GitHub refused the visibility change. Check admin access and organization policy.");
    return githubReadError(err, userId);
  }
}

/** Persist the default push mode for a project (no GitHub call). */
export async function setPushMode(
  projectId: string,
  userId: string,
  mode: PushMode,
): Promise<void> {
  await ownedGithubProject(projectId, userId);
  await prisma.project.update({
    where: { id: projectId, userId },
    data: { githubPushMode: mode },
  });
}

export interface IssueResult {
  issueUrl: string;
  number: number;
  summary: string;
}

/** Open a GitHub issue on the project's linked repo. */
export async function createGithubIssue(
  projectId: string,
  userId: string,
  opts: { title: string; body: string },
): Promise<IssueResult | PushError> {
  try {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { githubRepo: true, userId: true } });
    if (!project?.githubRepo) throw Errors.conflict("Link a GitHub repository before creating an issue.");
    if (project.userId !== userId) throw Errors.forbidden("You do not have access to this project");
    const { createProjectGithubIssue } = await import("./githubCollaboration");
    return await createProjectGithubIssue(projectId, userId, { repo: project.githubRepo, title: opts.title, description: opts.body });
  } catch (error) { return { error: error instanceof Error ? error.message : "GitHub issue creation failed." }; }
}
