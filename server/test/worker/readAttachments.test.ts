import { expect, test } from "bun:test";

// The fixture fakes the database, the reader, the bus and the meter module-wide, so it runs in its own process.
test("a request's files are read when its run starts, shown as a step and charged to the run", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/readAttachments.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  }
  expect(result.exitCode).toBe(0);
}, 60_000);
