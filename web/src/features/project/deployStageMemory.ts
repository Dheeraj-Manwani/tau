import type { DeploymentStatus } from "./deploy";

/**
 * The server keeps no record of which stage a failed deployment reached, so
 * the pipeline would have to invent one. This browser can do better for the
 * attempts it watched: it remembers the last stage it saw each one in, for
 * the session, and the pipeline stops there.
 */
const KEY = "tau:deploy-stages";
const LIMIT = 20;
const memory = new Map<string, DeploymentStatus>();

function load(): Map<string, DeploymentStatus> {
  if (memory.size > 0) return memory;
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as [string, DeploymentStatus][];
    for (const [id, stage] of saved) memory.set(id, stage);
  } catch {
    // No storage (private mode, tests): the in-memory map still works.
  }
  return memory;
}

export function rememberDeployStage(id: string, stage: DeploymentStatus): void {
  const stages = load();
  if (stages.get(id) === stage) return;
  stages.delete(id);
  stages.set(id, stage);
  while (stages.size > LIMIT) stages.delete(stages.keys().next().value!);
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...stages]));
  } catch {
    // Best effort, as above.
  }
}

export function rememberedDeployStage(id: string): DeploymentStatus | null {
  return load().get(id) ?? null;
}
