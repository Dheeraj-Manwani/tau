import { pushReviewedProject } from "../lib/githubPush";
import * as projectRepo from "../repositories/project.repository";
import { Errors } from "../lib/errors";
import { compareGithubFiles, githubFileDiff } from "../lib/githubComparison";
import {
  getGithubProjectInfo,
  pushProjectToGithub,
  linkExistingRepo,
  unlinkRepo,
  listUserRepos,
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

export async function link(projectId: string, userId: string, repo: string) {
  await assertOwner(projectId, userId);
  return unwrap(await linkExistingRepo(projectId, userId, repo));
}

export async function unlink(projectId: string, userId: string) {
  await assertOwner(projectId, userId);
  await unlinkRepo(projectId, userId);
}

export async function repos(projectId: string, userId: string) {
  await assertOwner(projectId, userId);
  return unwrap(await listUserRepos(userId));
}

export async function patch(
  projectId: string,
  userId: string,
  changes: { private?: boolean; pushMode?: PushMode },
) {
  await assertOwner(projectId, userId);
  if (changes.pushMode) {
    await setPushMode(projectId, userId, changes.pushMode);
  }
  if (changes.private !== undefined) {
    return unwrap(await setRepoVisibility(projectId, userId, changes.private));
  }
  return { ok: true };
}
