import type { ActionItem, Plan } from "@/src/stores/useProjectStore";

/** The building loader's four phases (boards/Workspace-Building.dc.html). */
export const BUILD_PHASES = [
  "Reading your prompt",
  "Writing the code",
  "Building the preview",
  "Finishing touches",
] as const;

export type BuildPhase = 0 | 1 | 2 | 3;

const WRITES = new Set<ActionItem["kind"]>([
  "create_file",
  "edit_file",
  "delete_file",
  "download_asset",
  "dispatch_implementer",
]);

const CHECKS = new Set<ActionItem["kind"]>([
  "run_command",
  "tail_command_output",
  "wait_for_port",
  "check_sandbox",
  "dispatch_verifier",
]);

/**
 * Where the first build is, from what the job stream has reported this turn,
 * never from a timer:
 * 0. nothing written yet;
 * 1. the first file is being written;
 * 2. after writing, tau starts or checks the app;
 * 3. a review ran over the written app, or every planned step is done.
 */
export function buildPhase({
  actions,
  writingPath,
  plan,
}: {
  /** This turn's actions, oldest first. */
  actions: readonly Pick<ActionItem, "kind">[];
  writingPath: string | null;
  plan: Pick<Plan, "todos"> | null;
}): BuildPhase {
  const firstWrite = actions.findIndex((a) => WRITES.has(a.kind));
  if (firstWrite < 0) return writingPath ? 1 : 0;

  const after = actions.slice(firstWrite + 1);
  const reviewed = after.some((a) => a.kind === "dispatch_verifier");
  const planDone =
    !!plan && plan.todos.length > 0 && plan.todos.every((t) => t.status !== "pending");
  if (reviewed || (planDone && after.some((a) => CHECKS.has(a.kind)))) return 3;
  if (after.some((a) => CHECKS.has(a.kind))) return 2;
  return 1;
}
