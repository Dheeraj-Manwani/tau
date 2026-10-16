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
  // Badge tones (boards/Surfaces.dc.html): no purple; merged is the blue of
  // "changed", closed the red of loss.
  if (pr.merged) return { label: "Merged", className: "border border-blue-500/34 bg-blue-500/12 text-blue-500" };
  if (pr.state === "closed") return { label: "Closed", className: "border border-red-400/32 bg-red-400/10 text-red-400" };
  if (pr.draft) return { label: "Draft", className: "border border-line-strong bg-space-surface text-silver-600" };
  return { label: "Open", className: "border border-green-400/32 bg-green-400/11 text-green-400" };
}
