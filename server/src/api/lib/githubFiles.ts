import ignore from "ignore";
import { getBlobText } from "@/lib/s3";
import { isSecretPath } from "./projectFiles";

export type PushMode = "new_pr" | "update_pr" | "direct";
export const PUSH_MODES: PushMode[] = ["new_pr", "update_pr", "direct"];

export function isPushMode(v: unknown): v is PushMode {
  return typeof v === "string" && (PUSH_MODES as string[]).includes(v);
}

/**
 * Drop everything that must not be committed: credential-shaped paths
 * unconditionally, then whatever the project's own `.gitignore` excludes.
 *
 * Order matters. `isSecretPath` is the floor and runs first, so a project whose
 * `.gitignore` was deleted or rewritten by the agent still cannot publish keys.
 * The `.gitignore` pass on top is what stops us committing build output and
 * PGlite's on-disk `data/` directory, both of which the templates ignore and we
 * were previously pushing anyway.
 *
 * Only the root `.gitignore` is read. Real git also honors per-directory ones,
 * but no template writes any and the floor covers the case that matters.
 */
export async function filterPushableFiles<
  T extends { path: string; contentHash: string },
>(userId: string, projectId: string, files: T[]): Promise<T[]> {
  const safe = files.filter((f) => !isSecretPath(f.path));

  const gitignore = safe.find((f) => f.path === ".gitignore");
  if (!gitignore) return safe;

  let patterns: string;
  try {
    patterns = await getBlobText(userId, projectId, gitignore.contentHash);
  } catch {
    // A missing blob must not turn into "push everything" — the floor already
    // applied, and skipping the .gitignore pass only over-includes noise.
    return safe;
  }

  const matcher = ignore().add(patterns);
  // `.gitignore` itself is committed by convention; `ignore` would happily let
  // a pattern exclude it, but git only ignores untracked files and this one is
  // always tracked in a real repo.
  return safe.filter(
    (f) => f.path === ".gitignore" || !matcher.ignores(f.path),
  );
}

