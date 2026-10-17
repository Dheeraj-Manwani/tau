import { expect, test } from "bun:test";

// Module mocks are process-global in Bun. Keep the database fake in a child
// runner so it cannot replace the real module in unrelated tests.
test("the project list counts every match across pages", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/projectListTotal.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
  expect(result.exitCode).toBe(0);
});
