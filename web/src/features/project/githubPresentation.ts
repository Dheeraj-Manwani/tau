import type { GithubProjectInfo, PrSummary } from "./github";

/** The current API counts edit events, not distinct changed files. */
export function githubEditLabel(count: number): string {
  return count > 0
    ? `${count} edit${count === 1 ? "" : "s"} since last push`
    : "No edits since last push";
}

export function githubPullRequests(info: GithubProjectInfo): PrSummary[] {
  const { lastPr, openPrs } = info;
  return lastPr
    ? [lastPr, ...openPrs.filter((pr) => pr.number !== lastPr.number)]
    : openPrs;
}

export function githubPrState(pr: PrSummary) {
  if (pr.merged) return { label: "Merged", className: "bg-purple-500/10 text-purple-400" };
  if (pr.state === "closed") return { label: "Closed", className: "bg-red-500/10 text-red-400" };
  return { label: "Open", className: "bg-emerald-500/10 text-emerald-500" };
}
