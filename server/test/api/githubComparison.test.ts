import { expect, test } from "bun:test";

// Database/blob/fetch mocks are process-scoped, so isolate them from other tests.
test("GitHub comparison routes review exact files and reject stale or unauthorized requests", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/githubComparison.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`, stdout: "pipe", stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  expect(result.exitCode).toBe(0);
}, 60_000);
