import { expect, test } from "bun:test";
import { safeGithubReturnTo } from "@/api/lib/githubReturnTo";

test("GitHub OAuth returns only to the configured origin and preserves project navigation", () => {
  const app = "https://app.example.test";
  const project = `${app}/project/123?tab=tools&tool=github&githubSection=issues#issue`;
  expect(safeGithubReturnTo(project, app)).toBe(project);
  expect(safeGithubReturnTo("https://app.example.test:443/project/123", app)).toBe(`${app}/project/123`);
  for (const raw of [undefined, [], "invalid", "/project/123", "https://app.example.test.evil.test/project", "https://app.example.test@evil.test", "https://user@app.example.test/project", "http://app.example.test/project", "https://app.example.test:444/project", "javascript:alert(1)", "https://evil.test/?return=https://app.example.test"]) expect(safeGithubReturnTo(raw, app)).toBe(`${app}/`);
  expect(safeGithubReturnTo("http://localhost:5174/project/1?tool=github", "http://localhost:5174/")).toBe("http://localhost:5174/project/1?tool=github");
  expect(safeGithubReturnTo("http://localhost:5175/project/1", "http://localhost:5174/")).toBe("http://localhost:5174/");
});
