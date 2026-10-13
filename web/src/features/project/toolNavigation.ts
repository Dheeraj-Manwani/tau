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

export function selectedGithubPr(params: URLSearchParams): number | undefined {
  const value = params.get("githubPr");
  if (!value || !/^[1-9]\d*$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
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
  prNumber?: number,
) {
  const next = new URLSearchParams(params);
  next.delete("publish");
  next.delete("publishSection");
  next.delete("deploySection");
  next.delete("githubSection");
  next.delete("githubPr");
  next.set("tab", "tools");
  next.set("tool", tool);
  if (tool === "deploy" && section && sections.includes(section as DeploySection)) next.set("deploySection", section);
  if (tool === "github" && section && githubSections.includes(section as GithubSection)) next.set("githubSection", section);
  if (tool === "github" && section === "changes" && prNumber && Number.isSafeInteger(prNumber) && prNumber > 0) next.set("githubPr", String(prNumber));
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
    prNumber?: number,
  ) => {
    const next = projectToolParams(params, tool, section, prNumber);
    if (productionStorage) next.set("storageEnv", "LIVE");
    setParams(next);
  };
}
