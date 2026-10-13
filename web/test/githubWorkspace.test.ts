import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { isProjectGithubQuery } from "../src/features/auth/githubCache";
import { githubEditLabel, githubPullRequests, githubPrState } from "../src/features/project/githubPresentation";
import type { GithubProjectInfo } from "../src/features/project/github";
import { githubPatchLines } from "../src/features/project/githubDiffPresentation";

test("account changes invalidate GitHub state across projects and repository pickers only", async () => {
  const client = new QueryClient();
  const keys = [
    ["project", "first", "github"],
    ["project", "second", "github"],
    ["project", "second", "github", "repos"],
    ["project", "second", "github", "changes", "repo", "direct"],
    ["project", "first", "github", "diff", "preview", "src/App.tsx"],
    ["project", "first", "deploy"],
    ["project", "first", "tree"],
  ];
  for (const key of keys) client.setQueryData(key, {});
  await client.invalidateQueries({ predicate: isProjectGithubQuery, refetchType: "none" });
  expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, true, true, true, false, false]);
  client.clear();
});

test("unified diff line numbers follow removed, added, unchanged and multiple hunks", () => {
  const lines = githubPatchLines("--- a/file\n+++ b/file\n@@ -2,2 +2,3 @@\n-old\n+new\n+extra\n same\n@@ -10 +11 @@\n-last\n+next\n\\ No newline at end of file\n");
  expect(lines.filter((line) => line.kind !== "header")).toEqual([
    { text: "-old", kind: "removed", before: 2, after: null },
    { text: "+new", kind: "added", before: null, after: 2 },
    { text: "+extra", kind: "added", before: null, after: 3 },
    { text: " same", kind: "context", before: 3, after: 4 },
    { text: "-last", kind: "removed", before: 10, after: null },
    { text: "+next", kind: "added", before: null, after: 11 },
  ]);
  expect(lines.at(-1)?.kind).toBe("header");
});

test("the last Tau PR appears once even when it is included in open PRs", () => {
  const pr = { number: 12, title: "Update project", state: "open", url: "https://github.com/example/project/pull/12" };
  const info: GithubProjectInfo = {
    connected: true, username: "example", repo: null, pushMode: "new_pr",
    unpushedChanges: 2, lastPr: pr, openPrs: [{ ...pr, number: 14 }, pr],
  };
  expect(githubPullRequests(info).map((row) => row.number)).toEqual([12, 14]);
  expect(githubPullRequests({ ...info, lastPr: null }).map((row) => row.number)).toEqual([14, 12]);
  expect(githubPullRequests({ ...info, openPrs: [], lastPr: null })).toEqual([]);
  expect(githubPrState({ ...pr, state: "closed", merged: true }).label).toBe("Merged");
  expect(githubPrState({ ...pr, state: "closed" }).label).toBe("Closed");
  expect(githubPrState({ ...pr, draft: true }).label).toBe("Draft");
});

test("sequence counts are presented as edits, without claiming a file count or remote sync", () => {
  expect(githubEditLabel(0)).toBe("No edits since last push");
  expect(githubEditLabel(1)).toBe("1 edit since last push");
  expect(githubEditLabel(5)).toBe("5 edits since last push");
});


test("selected PR review links preserve project context and clear the target when leaving Changes", async () => {
  const { projectToolParams, selectedGithubPr } = await import("../src/features/project/toolNavigation");
  const current = new URLSearchParams("tab=tools&tool=github&githubSection=pull-requests&chat=keep&githubPr=42");
  const review = projectToolParams(current, "github", "changes", 39);
  expect(selectedGithubPr(review)).toBe(39);
  expect(review.get("chat")).toBe("keep");
  expect(review.get("githubSection")).toBe("changes");
  expect(current.get("githubPr")).toBe("42");
  for (const target of [projectToolParams(review, "deploy", "deployments"), projectToolParams(review, "github", "issues"), projectToolParams(review, "github", "changes")]) expect(target.has("githubPr")).toBe(false);
  for (const value of ["-1", "0", "1.5", "39junk", "", "9007199254740993"]) expect(selectedGithubPr(new URLSearchParams({ githubPr: value }))).toBeUndefined();
});
