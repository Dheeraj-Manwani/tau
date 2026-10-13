import { prisma } from "@/lib/prisma";
import { AppError, Errors } from "./errors";

export class GithubApiError extends Error {
  constructor(readonly status: number, readonly body: string, readonly rateLimited = false) {
    super(`GitHub API ${status}: ${body}`);
    this.name = "GithubApiError";
  }
}

export async function gh<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "tau-app",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GithubApiError(res.status, text, res.status === 429 ||
      (res.status === 403 && (res.headers.get("x-ratelimit-remaining") === "0" ||
        res.headers.has("retry-after") || /rate limit/i.test(text))));
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function resolveToken(userId: string): Promise<string | null> {
  const account = await prisma.oAuthAccount.findFirst({ where: { userId, provider: "github" } });
  return account?.accessToken ?? null;
}

export async function dropConnection(userId: string): Promise<void> {
  await prisma.oAuthAccount.deleteMany({ where: { userId, provider: "github" } }).catch(() => {});
}

/** Keep session authentication separate from a revoked GitHub credential. */
export async function githubReadError(err: unknown, userId: string): Promise<never> {
  if (err instanceof AppError) throw err;
  if (err instanceof GithubApiError) {
    if (err.status === 401) {
      await dropConnection(userId);
      throw Errors.conflict("Your GitHub connection expired. Reconnect your account in Settings.");
    }
    if (err.rateLimited) throw Errors.tooMany("GitHub's rate limit was reached. Try again later.");
    if (err.status === 403) throw Errors.forbidden("Your GitHub account cannot read this repository. Check its permissions.");
    if (err.status === 404) throw Errors.notFound("The repository or branch is unavailable, or your account no longer has access.");
    if (err.status === 409) throw Errors.conflict("This repository has no commits yet. Initialize a branch on GitHub to compare files.");
  }
  throw new AppError("GitHub is unavailable. Try again to refresh the comparison.", 503);
}
