import { expect, test } from "bun:test";

// The fixture mocks the database, the bucket and the cloud module-wide, so it runs in its own process.
test("deleting a project stops its runs first and takes it apart in a survivable order", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/projectDelete.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout);
  if (result.exitCode !== 0) throw new Error(out);
  expect(result.exitCode).toBe(0);
}, 60_000);
