import { expect, test } from "bun:test";

// The fixture fakes the database, the bucket and the reader module-wide, so it runs in its own process.
test("completing an upload starts at most one read, or none when deferred, and the limit counts files", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/attachmentComplete.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  }
  expect(result.exitCode).toBe(0);
}, 60_000);
