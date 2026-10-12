import { useSearchParams } from "react-router-dom";

export type ProjectTool = "secrets" | "storage" | "deploy" | "domains";
export type DeploySection =
  "overview" | "identity" | "deployments" | "resources";
const tools: ProjectTool[] = ["secrets", "storage", "deploy", "domains"];
const sections: DeploySection[] = [
  "overview",
  "identity",
  "deployments",
  "resources",
];

export function selectedProjectTool(params: URLSearchParams): ProjectTool {
  const value = params.get("tool") as ProjectTool;
  if (params.get("publish") === "1" || params.get("tool") === "publish")
    return "deploy";
  return tools.includes(value) ? value : "secrets";
}

/** Old links still resolve into the new four-tab workspace. */
export function selectedDeploySection(params: URLSearchParams): DeploySection {
  const value = params.get("deploySection") ?? params.get("publishSection");
  if (value === "activity" || value === "history") return "deployments";
  if (value === "production") return "resources";
  if (value === "manage") return "overview";
  return sections.includes(value as DeploySection)
    ? (value as DeploySection)
    : "overview";
}

export function projectToolParams(
  params: URLSearchParams,
  tool: ProjectTool,
  section?: DeploySection,
) {
  const next = new URLSearchParams(params);
  next.delete("publish");
  next.delete("publishSection");
  next.delete("deploySection");
  next.set("tab", "tools");
  next.set("tool", tool);
  if (tool === "deploy" && section) next.set("deploySection", section);
  if (tool !== "storage") next.delete("storageEnv");
  return next;
}

/** Navigation only; deployment mutations live in Tools → Deploy. */
export function useProjectToolNavigation() {
  const [params, setParams] = useSearchParams();
  return (
    tool: ProjectTool,
    section?: DeploySection,
    productionStorage = false,
  ) => {
    const next = projectToolParams(params, tool, section);
    if (productionStorage) next.set("storageEnv", "LIVE");
    setParams(next);
  };
}
