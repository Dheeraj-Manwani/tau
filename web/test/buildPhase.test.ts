import { describe, expect, test } from "bun:test";

import { buildPhase } from "@/src/features/project/buildPhase";

describe("building loader phase", () => {
  test("reads the prompt until the first file is written", () => {
    expect(buildPhase({ actions: [{ kind: "create_plan" }, { kind: "read_file" }], writingPath: null, plan: null })).toBe(0);
    expect(buildPhase({ actions: [], writingPath: "src/App.tsx", plan: null })).toBe(1);
  });

  test("writes the code, then builds the preview once tau checks it", () => {
    const wrote = [{ kind: "create_plan" as const }, { kind: "create_file" as const }];
    expect(buildPhase({ actions: wrote, writingPath: null, plan: null })).toBe(1);
    // A check before any write is still reading.
    expect(buildPhase({ actions: [{ kind: "run_command" }], writingPath: null, plan: null })).toBe(0);
    expect(buildPhase({ actions: [...wrote, { kind: "wait_for_port" }], writingPath: null, plan: null })).toBe(2);
  });

  test("finishing touches after a review or once every step is done", () => {
    const built = [{ kind: "create_file" as const }, { kind: "run_command" as const }];
    expect(buildPhase({ actions: [...built, { kind: "dispatch_verifier" }], writingPath: null, plan: null })).toBe(3);
    const plan = { todos: [{ sno: 1, label: "a", status: "done" as const }, { sno: 2, label: "b", status: "skipped" as const }] };
    expect(buildPhase({ actions: built, writingPath: null, plan })).toBe(3);
    const open = { todos: [{ sno: 1, label: "a", status: "pending" as const }] };
    expect(buildPhase({ actions: built, writingPath: null, plan: open })).toBe(2);
  });
});
