import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { api } from "@/src/lib/api-client";
import { githubKeys } from "@/src/features/auth/github";
import { isProjectGithubQuery } from "@/src/features/auth/githubCache";
import { useProjectStore } from "@/src/stores/useProjectStore";

/**
 * Project-scoped GitHub state + actions for the GitHub panel. Distinct from
 * `features/auth/github.ts`, which owns the account-level connect/disconnect
 * handshake. Everything here is keyed by projectId and talks to
 * `/project/:id/github`.
 */

export type PushMode = "new_pr" | "update_pr" | "direct";

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
}

export interface RepoSummary {
  fullName: string;
  htmlUrl: string;
  visibility: "private" | "public";
  defaultBranch: string;
}

export interface GithubProjectInfo {
  connected: boolean;
  username: string | null;
  repo: RepoSummary | null;
  lastPr: PrSummary | null;
  openPrs: PrSummary[];
  unpushedChanges: number;
  pushMode: PushMode;
}

export interface PushResult {
  repoUrl: string;
  prUrl?: string;
  branch: string;
  mode: PushMode;
  summary: string;
}

export interface UserRepo {
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

export const projectGithubKeys = {
  info: (projectId: string) => ["project", projectId, "github"] as const,
  repos: (projectId: string) =>
    ["project", projectId, "github", "repos"] as const,
  changes: (projectId: string, repo: string, mode: PushMode, deletions: string[], sequence: number | null) =>
    ["project", projectId, "github", "changes", repo, mode, [...deletions].sort(), sequence] as const,
  diff: (projectId: string, preview: string, path: string) =>
    ["project", projectId, "github", "diff", preview, path] as const,
};

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
  localSequence: number;
  files: GithubFileChange[];
  counts: { added: number; modified: number; deleted: number; total: number };
  repositoryOnly: { path: string; sizeBytes: number }[];
  excludedCount: number;
}

export interface GithubFileDiff {
  path: string;
  kind: "text" | "binary" | "large";
  patch: string | null;
  additions: number | null;
  deletions: number | null;
}

export function useGithubChanges(projectId: string, repo: string, mode: PushMode, deletions: string[], enabled: boolean) {
  const sequence = useProjectStore((s) => s.projectId === projectId ? s.headSequence : null);
  return useQuery({
    queryKey: projectGithubKeys.changes(projectId, repo, mode, deletions, sequence),
    queryFn: ({ signal }) => api.get<GithubComparison>(`/project/${projectId}/github/changes`, {
      params: { mode, deletions: JSON.stringify([...deletions].sort()) }, signal,
    }).then((r) => r.data),
    enabled,
    staleTime: 15_000,
    retry: false,
    // Keep repository-only checkboxes mounted while a deletion selection loads.
    // A new repository, target or local version must never inherit an old diff.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[4] === repo && previousQuery.queryKey[5] === mode && previousQuery.queryKey[7] === sequence
        ? previous : undefined,
  });
}

export function useGithubDiff(projectId: string, preview: string, path: string, enabled: boolean) {
  return useQuery({
    queryKey: projectGithubKeys.diff(projectId, preview, path),
    queryFn: ({ signal }) => api.get<GithubFileDiff>(`/project/${projectId}/github/diff`, {
      params: { path, preview }, signal,
    }).then((r) => r.data),
    enabled,
    staleTime: 0,
    retry: false,
    gcTime: 60_000,
  });
}

export function useGithubProject(projectId: string | null) {
  return useQuery({
    queryKey: projectGithubKeys.info(projectId ?? ""),
    queryFn: () =>
      api
        .get<GithubProjectInfo>(`/project/${projectId}/github`)
        .then((r) => r.data),
    enabled: !!projectId,
    staleTime: 15_000,
  });
}

/** Fetched on demand (only when the "link existing repo" picker opens). */
export function useUserRepos(projectId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: projectGithubKeys.repos(projectId ?? ""),
    queryFn: () =>
      api
        .get<{ repos: UserRepo[] }>(`/project/${projectId}/github/repos`)
        .then((r) => r.data.repos),
    enabled: !!projectId && enabled,
    staleTime: 30_000,
  });
}

function useInvalidateInfo(projectId: string | null) {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      queryKey: projectGithubKeys.info(projectId ?? ""),
    });
}

export function usePushToGithub(projectId: string | null) {
  const invalidate = useInvalidateInfo(projectId);
  return useMutation({
    mutationFn: (body: { title?: string; mode?: PushMode }) =>
      api
        .post<PushResult>(`/project/${projectId}/github/push`, body)
        .then((r) => r.data),
    onSuccess: (res) => {
      toast.success(
        res.mode === "direct"
          ? "Committed to GitHub"
          : res.prUrl
            ? "Pushed: pull request ready"
            : "Pushed to GitHub",
      );
      void invalidate();
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Push failed")),
  });
}

export function useLinkRepo(projectId: string | null) {
  const invalidate = useInvalidateInfo(projectId);
  return useMutation({
    mutationFn: (repo: string) =>
      api
        .post<RepoSummary>(`/project/${projectId}/github/link`, { repo })
        .then((r) => r.data),
    onSuccess: (repo) => {
      toast.success(`Linked ${repo.fullName}`);
      void invalidate();
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't link repo")),
  });
}

export function useUnlinkRepo(projectId: string | null) {
  const invalidate = useInvalidateInfo(projectId);
  return useMutation({
    mutationFn: () => api.delete(`/project/${projectId}/github/link`),
    onSuccess: () => {
      toast.success("Repository unlinked");
      void invalidate();
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't unlink")),
  });
}

export function usePatchGithub(projectId: string | null) {
  const invalidate = useInvalidateInfo(projectId);
  return useMutation({
    mutationFn: (changes: { private?: boolean; pushMode?: PushMode }) =>
      api.patch(`/project/${projectId}/github`, changes),
    onSuccess: () => void invalidate(),
    onError: (err: unknown) => toast.error(errorMessage(err, "Update failed")),
  });
}

/** Disconnecting an account affects all projects, including inactive caches. */
export function useDisconnectGithub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete("/auth/github"),
    onSuccess: () => {
      toast.success("GitHub disconnected");
      qc.invalidateQueries({ queryKey: githubKeys.status });
      qc.invalidateQueries({ predicate: isProjectGithubQuery });
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "Couldn't disconnect GitHub")),
  });
}

export function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
}
