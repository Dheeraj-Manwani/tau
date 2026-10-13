import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { isProjectGithubQuery } from "../src/features/auth/githubCache";
import { githubEditLabel, githubPullRequests, githubPrState } from "../src/features/project/githubPresentation";
import type { GithubProjectInfo } from "../src/features/project/github";

test("account changes invalidate GitHub state across projects and repository pickers only", async () => {
  const client = new QueryClient();
  const keys = [
    ["project", "first", "github"],
    ["project", "second", "github"],
    ["project", "second", "github", "repos"],
    ["project", "first", "deploy"],
    ["project", "first", "tree"],
  ];
  for (const key of keys) client.setQueryData(key, {});
  await client.invalidateQueries({ predicate: isProjectGithubQuery, refetchType: "none" });
  expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true, true, false, false]);
  client.clear();
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
});

test("sequence counts are presented as edits, without claiming a file count or remote sync", () => {
  expect(githubEditLabel(0)).toBe("No edits since last push");
  expect(githubEditLabel(1)).toBe("1 edit since last push");
  expect(githubEditLabel(5)).toBe("5 edits since last push");
});
