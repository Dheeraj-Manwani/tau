import { type ComponentType } from "react";
import { useSearchParams } from "react-router-dom";
import { GlobeIcon, HardDriveIcon, LockIcon, RocketIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { DomainsPane } from "@/src/features/project/DomainsPane";
import { KeysPane } from "@/src/features/project/KeysPane";
import { StoragePane } from "@/src/features/project/StoragePane";
import { DeployPane } from "./DeployPane";
import { useDeployStatus } from "./deploy";
import { deployPresentation, deployToneClass } from "./deployPresentation";
import { selectedProjectTool, useProjectToolNavigation, type ProjectTool } from "./toolNavigation";

interface ToolEntry {
  id: ProjectTool;
  label: string;
  icon: typeof LockIcon;
  group: string;
  pane: ComponentType<{ projectId: string }>;
}

/** One line per tool: the navigation, the heading and the pane all come from here. */
const TOOLS: ToolEntry[] = [
  { id: "secrets", label: "Secrets", icon: LockIcon, group: "Setup", pane: KeysPane },
  { id: "storage", label: "Storage", icon: HardDriveIcon, group: "Setup", pane: StoragePane },
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

  return (
    <div className="flex h-full min-w-0 flex-col bg-[var(--space-void)] sm:flex-row">
      <nav
        aria-label="Project tools"
        className="flex shrink-0 flex-wrap gap-1 border-b border-[var(--silver-200)] bg-[var(--space-surface)] p-2 sm:block sm:w-44 sm:border-r sm:border-b-0 sm:p-3 lg:w-48"
      >
        {TOOLS.map((item, i) => (
          <div key={item.id}>
            {(i === 0 || TOOLS[i - 1]!.group !== item.group) && (
              <p className={cn("mb-3 hidden px-2 pt-1 text-[11px] font-medium uppercase tracking-wider text-[var(--silver-600)] sm:block", i > 0 && "mt-4")}>
                {item.group}
              </p>
            )}
            <button
              type="button"
              aria-current={tool.id === item.id ? "page" : undefined}
              aria-controls={`project-${item.id}`}
              title={item.id === "domains" && domainsLocked ? "Deploy your app to unlock domains" : undefined}
              onClick={() => openTool(item.id)}
              className={cn(
                "flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring sm:mb-1",
                tool.id === item.id
                  ? "bg-[var(--space-overlay)] text-[var(--silver-900)]"
                  : "text-[var(--silver-600)] hover:bg-[var(--space-overlay)]/60 hover:text-[var(--silver-900)]",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
              {item.id === "domains" && domainsLocked && <LockIcon aria-hidden="true" className="ml-auto size-3.5 shrink-0 text-[var(--silver-600)]" />}
              {item.id === "deploy" && deploy && <span aria-hidden="true" className={cn("ml-auto size-1.5 rounded-full", deployToneClass[deployPresentation(deploy).tone])} />}
            </button>
          </div>
        ))}
      </nav>
      <section id={`project-${tool.id}`} aria-label={tool.label} className="min-h-0 min-w-0 flex-1">
        <Pane projectId={projectId} />
      </section>
    </div>
  );
}
