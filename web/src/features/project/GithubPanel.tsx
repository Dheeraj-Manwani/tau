import { Button } from "@/src/components/ui/button";
import { GithubMark } from "@/src/components/ui/github-mark";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useGithubProject } from "./github";
import { useProjectToolNavigation } from "./toolNavigation";

/**
 * The header shortcut leads to the single GitHub workspace in Tools. A
 * secondary button with a small status dot (boards/Controls.dc.html "Toolbar
 * triggers"): blue while the repository is still to be created, orange for
 * unpushed changes, green when GitHub is up to date.
 */
export function GithubPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const { data, isError } = useGithubProject(projectId);
  const openTool = useProjectToolNavigation();
  const dot = !isError && data?.connected
    ? !data.repo ? "bg-blue-500" : data.unpushedChanges > 0 ? "bg-orange-400" : "bg-green-400"
    : null;

  return (
    <Button
      variant="secondary"
      aria-label="GitHub"
      disabled={!projectId}
      onClick={() => openTool("github")}
      className="shrink-0"
    >
      <GithubMark className="size-4" />
      GitHub
      {dot && <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${dot}`} />}
    </Button>
  );
}
