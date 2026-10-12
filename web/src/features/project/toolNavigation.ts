import { useSearchParams } from "react-router-dom";

export type ProjectTool = "secrets" | "storage" | "publish" | "domains";
export type PublishSection =
  "overview" | "activity" | "identity" | "production" | "history" | "manage";
const tools: ProjectTool[] = ["secrets", "storage", "publish", "domains"];
const sections: PublishSection[] = [
  "overview",
  "activity",
  "identity",
  "production",
  "history",
  "manage",
];

export function selectedProjectTool(params: URLSearchParams): ProjectTool {
  const value = params.get("tool") as ProjectTool;
  return params.get("publish") === "1"
    ? "publish"
    : tools.includes(value)
      ? value
      : "secrets";
}

export function selectedPublishSection(
  params: URLSearchParams,
): PublishSection {
  const value = params.get("publishSection") as PublishSection;
  return sections.includes(value) ? value : "overview";
}

export function projectToolParams(
  params: URLSearchParams,
  tool: ProjectTool,
  section?: PublishSection,
) {
  const next = new URLSearchParams(params);
  next.delete("publish");
  next.set("tab", "tools");
  next.set("tool", tool);
  next.delete("publishSection");
  if (tool === "publish" && section) next.set("publishSection", section);
  if (tool !== "storage") next.delete("storageEnv");
  return next;
}

/** Shared by the topbar shortcuts and the tools themselves. No deployment mutation. */
export function useProjectToolNavigation() {
  const [params, setParams] = useSearchParams();
  return (
    tool: ProjectTool,
    section?: PublishSection,
    productionStorage = false,
  ) => {
    const next = projectToolParams(params, tool, section);
    if (productionStorage) next.set("storageEnv", "LIVE");
    setParams(next);
  };
}
