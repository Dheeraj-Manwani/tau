import { prisma } from "@/lib/prisma";
import { Errors } from "./errors";
import { isPushMode, type PushMode } from "./githubFiles";
import { gh, GithubApiError, resolveToken, dropConnection, githubReadError, githubWriteError } from "./githubClient";

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
  visibility: "private" | "public";
  defaultBranch: string;
  canPush?: boolean;
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
  visibility: "private" | "public";
}

interface GithubRepoResponse {
  full_name: string;
  name: string;
  html_url: string;
  default_branch: string;
  private: boolean;
  owner: { login: string };
  permissions?: { push?: boolean };
}

function toRepoInfo(r: GithubRepoResponse): RepoInfo {
  return {
    fullName: r.full_name,
    owner: r.owner.login,
    repo: r.name,
    htmlUrl: r.html_url,
    defaultBranch: r.default_branch || "main",
    visibility: r.private ? "private" : "public",
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

function toPrSummary(p: GithubPrResponse): PrSummary {
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
): Promise<void> {
  await prisma.project
    .update({
      where: { id: projectId },
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
      await cacheRepoFacts(project.id, info);
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
      repo = {
        fullName: info.fullName,
        htmlUrl: info.htmlUrl,
        visibility: info.visibility,
        defaultBranch: info.defaultBranch,
        canPush: r.permissions?.push === true,
      };
      // Refresh cached facts if they drifted.
      if (
        info.defaultBranch !== project.githubDefaultBranch ||
        info.visibility !== project.githubVisibility
      ) {
        await cacheRepoFacts(projectId, info);
      }

      const prs = await gh<GithubPrResponse[]>(
        token,
        "GET",
        `/repos/${owner}/${name}/pulls?state=open&per_page=10`,
      );
      const summarize = (pr: GithubPrResponse): PrSummary => ({ ...toPrSummary(pr), canUpdate: r.permissions?.push === true && pr.state === "open" && !pr.merged_at && pr.head?.ref !== info.defaultBranch && pr.head?.repo?.full_name.toLowerCase() === info.fullName.toLowerCase() && pr.base?.repo?.full_name.toLowerCase() === info.fullName.toLowerCase() });
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
  };
}

/** Link a project to an existing repo the user already owns ("owner/repo"). */
export async function linkExistingRepo(
  projectId: string,
  userId: string,
  repoFullName: string,
): Promise<RepoSummary | PushError> {
  const token = await resolveToken(userId);
  if (!token) return { error: "GitHub is not connected." };

  const parts = repoFullName.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { error: "Expected a repository in 'owner/repo' form." };
  }

  try {
    const r = await gh<GithubRepoResponse>(
      token,
      "GET",
      `/repos/${parts[0]}/${parts[1]}`,
    );
    const info = toRepoInfo(r);
    await prisma.project.update({
      where: { id: projectId },
      data: {
        githubRepo: info.fullName,
        githubDefaultBranch: info.defaultBranch,
        githubVisibility: info.visibility,
        // A different repo — reset last-push bookkeeping.
        lastPushedBranch: null,
        lastPrUrl: null,
        lastPrNumber: null,
        lastPushedSequence: null,
      },
    });
    return {
      fullName: info.fullName,
      htmlUrl: info.htmlUrl,
      visibility: info.visibility,
      defaultBranch: info.defaultBranch,
    };
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 404) {
      return { error: "Repository not found, or your token can't access it." };
    }
    if (err instanceof GithubApiError && err.status === 401) {
      await dropConnection(userId);
      return { error: "The GitHub connection is no longer valid." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

/** Detach a project from its repo (does not touch the repo on GitHub). */
export async function unlinkRepo(
  projectId: string,
  userId: string,
): Promise<void> {
  // userId kept for signature symmetry / future per-user checks.
  void userId;
  await prisma.project.update({
    where: { id: projectId },
    data: {
      githubRepo: null,
      githubDefaultBranch: null,
      githubVisibility: null,
      lastPushedBranch: null,
      lastPrUrl: null,
      lastPrNumber: null,
      lastPushedSequence: null,
    },
  });
}

export interface UserRepo {
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

/** The repos the user owns, most-recently-updated first (for the link picker). */
export async function listUserRepos(
  userId: string,
): Promise<UserRepo[] | PushError> {
  const token = await resolveToken(userId);
  if (!token) return { error: "GitHub is not connected." };
  try {
    const repos = await gh<GithubRepoResponse[]>(
      token,
      "GET",
      `/user/repos?per_page=100&sort=updated&affiliation=owner`,
    );
    return repos.map((r) => ({
      fullName: r.full_name,
      private: r.private,
      htmlUrl: r.html_url,
    }));
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 401) {
      await dropConnection(userId);
      return { error: "The GitHub connection is no longer valid." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

/** Flip a linked repo between private and public. */
export async function setRepoVisibility(
  projectId: string,
  userId: string,
  makePrivate: boolean,
): Promise<RepoSummary | PushError> {
  const token = await resolveToken(userId);
  if (!token) return { error: "GitHub is not connected." };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { githubRepo: true },
  });
  if (!project?.githubRepo) return { error: "No repository is linked." };

  const [owner, name] = project.githubRepo.split("/");
  try {
    const r = await gh<GithubRepoResponse>(
      token,
      "PATCH",
      `/repos/${owner}/${name}`,
      { private: makePrivate },
    );
    const info = toRepoInfo(r);
    await prisma.project.update({
      where: { id: projectId },
      data: { githubVisibility: info.visibility },
    });
    return {
      fullName: info.fullName,
      htmlUrl: info.htmlUrl,
      visibility: info.visibility,
      defaultBranch: info.defaultBranch,
    };
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 422) {
      return {
        error:
          "GitHub refused the visibility change (an org policy may block it).",
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

/** Persist the default push mode for a project (no GitHub call). */
export async function setPushMode(
  projectId: string,
  userId: string,
  mode: PushMode,
): Promise<void> {
  void userId;
  await prisma.project.update({
    where: { id: projectId },
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
  const token = await resolveToken(userId);
  if (!token) {
    return {
      error:
        "GitHub is not connected. Ask the user to click the GitHub button on the project page to connect their account first.",
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { githubRepo: true },
  });
  if (!project?.githubRepo) {
    return {
      error:
        "This project isn't linked to a GitHub repository yet. Push to GitHub first, then file issues.",
    };
  }

  const title = opts.title.trim();
  if (!title) return { error: "An issue needs a title." };

  const [owner, name] = project.githubRepo.split("/");
  try {
    const issue = await gh<{ html_url: string; number: number }>(
      token,
      "POST",
      `/repos/${owner}/${name}/issues`,
      { title, body: opts.body.trim() || undefined },
    );
    return {
      issueUrl: issue.html_url,
      number: issue.number,
      summary: `Opened issue [#${issue.number} — ${title}](${issue.html_url})`,
    };
  } catch (err) {
    if (err instanceof GithubApiError && err.status === 401) {
      await dropConnection(userId);
      return { error: "The GitHub connection is no longer valid." };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Couldn't create the issue: ${message}` };
  }
}
