import { type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { GlobeIcon, HardDriveIcon, LockIcon, RocketIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { SideNavItem, SideNavSection } from "@/src/components/ui/side-nav";
import { DomainsPane } from "@/src/features/project/DomainsPane";
import { KeysPane } from "@/src/features/project/KeysPane";
import { StoragePane } from "@/src/features/project/StoragePane";
import { DeployPane } from "./DeployPane";
import { GithubPane } from "./GithubPane";
import { GithubMark } from "@/src/components/ui/github-mark";
import { useDeployStatus } from "./deploy";
import { deployPresentation, deployToneClass } from "./deployPresentation";
import { selectedProjectTool, useProjectToolNavigation, type ProjectTool } from "./toolNavigation";

interface ToolEntry {
  id: ProjectTool;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
  pane: ComponentType<{ projectId: string }>;
}

/** One line per tool: the navigation, the heading and the pane all come from here. */
const TOOLS: ToolEntry[] = [
  { id: "secrets", label: "Secrets", icon: LockIcon, group: "Setup", pane: KeysPane },
  { id: "storage", label: "Storage", icon: HardDriveIcon, group: "Setup", pane: StoragePane },
  { id: "github", label: "GitHub", icon: GithubMark, group: "Delivery", pane: GithubPane },
  { id: "deploy", label: "Deploy", icon: RocketIcon, group: "Delivery", pane: DeployPane },
  { id: "domains", label: "Domains", icon: GlobeIcon, group: "Delivery", pane: DomainsPane },
];

export function ToolsPane({ projectId }: { projectId: string }) {
  const [params] = useSearchParams();
  const toolId = selectedProjectTool(params);
  const openTool = useProjectToolNavigation();
  const { data: deploy } = useDeployStatus(projectId);
  const domainsLocked = !deploy?.live;
  const tool = TOOLS.find((t) => t.id === toolId) ?? TOOLS[0]!;
  const Pane = tool.pane;

  const groups = TOOLS.reduce<{ label: string; items: ToolEntry[] }[]>((acc, item) => {
    const last = acc.at(-1);
    if (last?.label === item.group) last.items.push(item);
    else acc.push({ label: item.group, items: [item] });
    return acc;
  }, []);

  const item = (entry: ToolEntry) => (
    <SideNavItem
      key={entry.id}
      current={tool.id === entry.id}
      aria-controls={`project-${entry.id}`}
      title={entry.id === "domains" && domainsLocked ? "Deploy your app to unlock domains" : undefined}
      onClick={() => openTool(entry.id)}
      className="w-auto shrink-0 sm:w-full"
      trailing={
        entry.id === "domains" && domainsLocked ? (
          <LockIcon aria-hidden="true" className="text-silver-500" />
        ) : entry.id === "deploy" && deploy ? (
          <span aria-hidden="true" className={cn("size-1.5 rounded-full", deployToneClass[deployPresentation(deploy).tone])} />
        ) : undefined
      }
    >
      <entry.icon className="size-4" />
      {entry.label}
    </SideNavItem>
  );

  return (
    <div className="flex h-full min-w-0 flex-col bg-space-void sm:flex-row">
      {/* boards/Controls.dc.html "Sidebar nav": grey mono section labels,
          a raised current row with a blue icon, a status dot on the right.
          Under 640px it becomes a row of chips. */}
      <nav
        aria-label="Project tools"
        className="scrollbar-none flex shrink-0 gap-1 overflow-x-auto border-b border-line p-2 sm:block sm:w-[200px] sm:overflow-y-auto sm:border-r sm:border-b-0 sm:px-3 sm:py-5 lg:w-[232px]"
      >
        <div className="hidden sm:block">
          {groups.map((group) => (
            <SideNavSection key={group.label} label={group.label} className="not-first:mt-5">
              {group.items.map(item)}
            </SideNavSection>
          ))}
        </div>
        <div className="flex gap-1 sm:hidden">{TOOLS.map(item)}</div>
      </nav>
      <section id={`project-${tool.id}`} aria-label={tool.label} className="min-h-0 min-w-0 flex-1">
        <Pane projectId={projectId} />
      </section>
    </div>
  );
}
