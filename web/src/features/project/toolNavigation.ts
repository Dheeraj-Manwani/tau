import { useSearchParams } from "react-router-dom";

export type ProjectTool = "secrets" | "storage" | "github" | "deploy" | "domains";
export type GithubSection = "changes" | "pull-requests" | "issues" | "settings";
export type DeploySection =
  "overview" | "identity" | "deployments" | "resources";
const tools: ProjectTool[] = ["secrets", "storage", "github", "deploy", "domains"];
const githubSections: GithubSection[] = ["changes", "pull-requests", "issues", "settings"];
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

export function selectedGithubSection(params: URLSearchParams): GithubSection {
  const value = params.get("githubSection") as GithubSection;
  return githubSections.includes(value) ? value : "changes";
}

/** Old links still resolve into the Tools workspace. */
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
  section?: DeploySection | GithubSection,
) {
  const next = new URLSearchParams(params);
  next.delete("publish");
  next.delete("publishSection");
  next.delete("deploySection");
  next.delete("githubSection");
  next.set("tab", "tools");
  next.set("tool", tool);
  if (tool === "deploy" && section && sections.includes(section as DeploySection)) next.set("deploySection", section);
  if (tool === "github" && section && githubSections.includes(section as GithubSection)) next.set("githubSection", section);
  if (tool !== "storage") next.delete("storageEnv");
  return next;
}

/** Navigation only; each tool pane owns its actions. */
export function useProjectToolNavigation() {
  const [params, setParams] = useSearchParams();
  return (
    tool: ProjectTool,
    section?: DeploySection | GithubSection,
    productionStorage = false,
  ) => {
    const next = projectToolParams(params, tool, section);
    if (productionStorage) next.set("storageEnv", "LIVE");
    setParams(next);
  };
}
