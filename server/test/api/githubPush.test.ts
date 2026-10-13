import { expect, test } from "bun:test";

test("GitHub push routes publish only reviewed overlays and handle permissions, races and partial results", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/githubPush.fixture.ts`], { cwd: `${import.meta.dir}/../..`, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  expect(result.exitCode).toBe(0);
}, 60_000);
