import { expect, test } from "bun:test";

// The fixture mocks the database, the bucket and the file helpers module-wide, so it runs in its own process.
test("use_attachment saves what the user attached into the project", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/useAttachment.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  }
  expect(result.exitCode).toBe(0);
}, 60_000);
