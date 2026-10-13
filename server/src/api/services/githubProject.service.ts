import { listGithubPulls, getGithubPull, listGithubIssues, getGithubIssue, createProjectGithubIssue, type GithubListState } from "../lib/githubCollaboration";
import { pushReviewedProject } from "../lib/githubPush";
import * as projectRepo from "../repositories/project.repository";
import { Errors } from "../lib/errors";
import { compareGithubFiles, githubFileDiff } from "../lib/githubComparison";
import {
  getGithubProjectInfo,
  pushProjectToGithub,
  createGithubRepository,
  unlinkRepo,
  setRepoVisibility,
  setPushMode,
  type PushMode,
} from "../lib/github";

async function assertOwner(projectId: string, userId: string): Promise<void> {
  const project = await projectRepo.findProjectById(projectId);
  if (!project) throw Errors.notFound("Project not found");
  if (project.userId !== userId) {
    throw Errors.forbidden("You do not have access to this project");
  }
}

function unwrap<T>(result: T | { error: string }): T {
  if (result && typeof result === "object" && "error" in result) {
    throw Errors.badRequest((result as { error: string }).error);
  }
  return result as T;
}

export async function getInfo(projectId: string, userId: string) {
  await assertOwner(projectId, userId);
  return getGithubProjectInfo(projectId, userId);
}

export async function changes(projectId: string, userId: string, opts: { mode?: PushMode; deletions?: string[]; prNumber?: number }) {
  await assertOwner(projectId, userId);
  return compareGithubFiles(projectId, userId, opts);
}

export async function diff(projectId: string, userId: string, path: string, preview: string) {
  await assertOwner(projectId, userId);
  return githubFileDiff(projectId, userId, path, preview);
}

export async function push(
  projectId: string,
  userId: string,
  opts: { title?: string; description?: string; mode?: PushMode; preview?: string; prNumber?: number; draft?: boolean },
) {
  await assertOwner(projectId, userId);
  if (opts.preview) return pushReviewedProject(projectId, userId, { ...opts, preview: opts.preview, title: opts.title ?? "Update from Tau" });
  if (opts.prNumber !== undefined || opts.draft !== undefined) throw Errors.badRequest("Refresh and review the comparison before composing this push.");
  const result = await pushProjectToGithub(projectId, userId, {
    title: opts.title ?? "",
    body: opts.description ?? "",
    mode: opts.mode,
  });
  return unwrap(result);
}

export async function createRepository(projectId: string, userId: string, opts: { name: string; description?: string }) {
  await assertOwner(projectId, userId);
  return createGithubRepository(projectId, userId, opts);
}

export async function unlink(projectId: string, userId: string) {
  await assertOwner(projectId, userId);
  await unlinkRepo(projectId, userId);
}

export async function patch(
  projectId: string,
  userId: string,
  changes: { private?: boolean; pushMode?: PushMode; repo?: string },
) {
  await assertOwner(projectId, userId);
  if (changes.pushMode) {
    await setPushMode(projectId, userId, changes.pushMode);
  }
  if (changes.private !== undefined) {
    return unwrap(await setRepoVisibility(projectId, userId, changes.private, changes.repo));
  }
  return { ok: true };
}


export async function pulls(projectId: string, userId: string, opts: { repo: string; state: GithubListState; page: number }) {
  await assertOwner(projectId, userId);
  return listGithubPulls(projectId, userId, opts);
}
export async function pull(projectId: string, userId: string, repo: string, number: number) {
  await assertOwner(projectId, userId);
  return getGithubPull(projectId, userId, repo, number);
}
export async function issues(projectId: string, userId: string, opts: { repo: string; state: GithubListState; page: number }) {
  await assertOwner(projectId, userId);
  return listGithubIssues(projectId, userId, opts);
}
export async function issue(projectId: string, userId: string, repo: string, number: number) {
  await assertOwner(projectId, userId);
  return getGithubIssue(projectId, userId, repo, number);
}
export async function createIssue(projectId: string, userId: string, opts: { repo: string; title: string; description: string }) {
  await assertOwner(projectId, userId);
  return createProjectGithubIssue(projectId, userId, opts);
}
