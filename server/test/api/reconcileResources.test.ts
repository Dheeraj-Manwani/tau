import { expect, test } from "bun:test";
import { projectIdOfResourceName } from "@/lib/reconcileResources";

test("only names tau made are mapped back to a project", () => {
  const id = "0a3c64ec-761f-4f5c-8a18-8b61f7744c01";
  expect(projectIdOfResourceName(`tau-app-${id}`)).toBe(id);
  expect(projectIdOfResourceName("tau-app-not-a-uuid")).toBeNull();
  expect(projectIdOfResourceName(`other-${id}`)).toBeNull();
  expect(projectIdOfResourceName(`tau-app-${id}-extra`)).toBeNull();
});

// Module mocks are process-global in Bun, so the stand-ins live in a child runner.
test("custom hostnames Cloudflare could not drop are retried", () => {
  const result = Bun.spawnSync([process.execPath, "test", `${import.meta.dir}/reconcileHostnames.fixture.ts`], {
    cwd: `${import.meta.dir}/../..`,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
  expect(result.exitCode).toBe(0);
});
