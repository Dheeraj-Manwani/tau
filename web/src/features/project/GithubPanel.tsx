import { GithubMark } from "@/src/components/ui/github-mark";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useGithubProject } from "./github";
import { useProjectToolNavigation } from "./toolNavigation";

/** The header shortcut leads to the single GitHub workspace in Tools. */
export function GithubPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const { data, isError } = useGithubProject(projectId);
  const openTool = useProjectToolNavigation();
  const dot = !isError && data?.connected
    ? !data.repo ? "bg-blue-500" : data.unpushedChanges > 0 ? "bg-amber-400" : "bg-green-500"
    : null;

  return (
    <button
      type="button"
      aria-label="GitHub"
      disabled={!projectId}
      onClick={() => openTool("github")}
      className="relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-silver-200 bg-space-surface px-3.5 text-sm font-medium text-silver-900 transition-colors hover:bg-space-overlay focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
    >
      <GithubMark className="size-4" />
      GitHub
      {dot && <span aria-hidden="true" className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-space-void ${dot}`} />}
    </button>
  );
}
