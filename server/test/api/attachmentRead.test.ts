import { expect, test } from "bun:test";

// The fixture fakes both models, the bucket and the attachment table module-wide, so it runs in its own process.
function run(env: Record<string, string>) {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/attachmentRead.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout));
  }
  expect(result.exitCode).toBe(0);
}

test("an attached picture is read by the fast reader, with Kimi behind it", () => run({ TEST_NO_KIMI: "0" }), 60_000);

test("with no Kimi key the fast reader is the only one", () => run({ TEST_NO_KIMI: "1" }), 60_000);
