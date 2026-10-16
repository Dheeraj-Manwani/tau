import { Suspense, lazy, useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ChevronDownIcon,
  CodeIcon,
  ExternalLinkIcon,
  WrenchIcon,
  LoaderCircleIcon,
  MonitorIcon,
  PanelLeftOpenIcon,
  RotateCwIcon,
  SmartphoneIcon,
  SquareMousePointerIcon,
  SwatchBookIcon,
  TabletIcon,
  TvMinimalIcon,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { Input, InputGroup } from "@/src/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { UserMenu } from "@/src/components/UserMenu";
import { GithubPanel } from "@/src/features/project/GithubPanel";
import { useGithubReturnToast } from "@/src/features/auth/github";
import { DeployPanel } from "@/src/features/project/DeployPanel";
import {
  useProjectStore,
  type PreviewDevice,
  type Tab,
} from "@/src/stores/useProjectStore";
import { PreviewPane } from "@/src/features/project/PreviewPane";
import { previewSrc } from "@/src/features/project/previewUrl";
import { ToolsPane } from "@/src/features/project/ToolsPane";
import { selectedDeploySection, projectToolParams } from "./toolNavigation";

// Lazy so the editor's heavy deps (CodeMirror + file icons) only load when the
// Code tab is first opened, not on initial project render.
const CodePane = lazy(() =>
  import("@/src/features/project/CodePane").then((m) => ({
    default: m.CodePane,
  })),
);

const TABS: { id: Tab; icon: typeof CodeIcon }[] = [
  { id: "preview", icon: TvMinimalIcon },
  { id: "code", icon: CodeIcon },
  { id: "tools", icon: WrenchIcon },
];

const DEVICES: {
  id: PreviewDevice;
  icon: typeof MonitorIcon;
  label: string;
}[] = [
  { id: "mobile", icon: SmartphoneIcon, label: "Mobile" },
  { id: "tablet", icon: TabletIcon, label: "Tablet" },
  { id: "desktop", icon: MonitorIcon, label: "Desktop" },
];

/** PREVIEW / CODE / TOOLS: a view switch, so a raised neutral chip with a blue
 *  icon, never the blue fill it used to be (boards/Controls.dc.html §03). */
function TabToggle() {
  const [params, setParams] = useSearchParams();
  const activeTab = useProjectStore((s) => s.activeTab);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const isWriting = useProjectStore((s) => s.writingPath !== null);

  return (
    <Segmented
      value={activeTab}
      onValueChange={(id) => {
        const next = new URLSearchParams(params);
        next.set("tab", id);
        setParams(next);
        setActiveTab(id as Tab);
      }}
      aria-label="Workspace view"
      data-tour="view-tabs"
    >
      {TABS.map(({ id, icon: Icon }) => (
        <SegmentedItem key={id} value={id} className="uppercase">
          {id === "code" && isWriting ? (
            <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Icon />
          )}
          {id}
        </SegmentedItem>
      ))}
    </Segmented>
  );
}

function DeviceSwitcher() {
  const previewDevice = useProjectStore((s) => s.previewDevice);
  const setPreviewDevice = useProjectStore((s) => s.setPreviewDevice);

  return (
    <Segmented
      size="sm"
      iconOnly
      value={previewDevice}
      onValueChange={(id) => setPreviewDevice(id as PreviewDevice)}
      aria-label="Preview device"
      data-tour="device-switcher"
    >
      {DEVICES.map(({ id, icon: Icon, label }) => (
        <SegmentedItem key={id} value={id} aria-label={label} className="w-7">
          <Icon className="size-3.5" />
        </SegmentedItem>
      ))}
    </Segmented>
  );
}

/** A ghost icon button with a tooltip, for the preview toolbar. */
function ToolbarIcon({
  label,
  onClick,
  disabled,
  pressed,
  children,
  ...rest
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
  "data-tour"?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
          className={cn(pressed && "bg-space-raised text-silver-900 [&_svg]:text-blue-500")}
          {...rest}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Element picker toggle.
 *
 * Only offered once the in-iframe runtime has announced itself: an older
 * project whose sandbox predates the tagger has no runtime, and a dead toggle
 * is worse than no toggle. `visualEditReady` is reset on every iframe remount.
 *
 * The copy says "ask about" rather than "edit": what a selection does first is
 * open a prompt box (doc/archive/VISUAL_EDIT_PROMPTING.md), with the deterministic
 * editor one click further in.
 */
function VisualEditToggle() {
  const ready = useProjectStore((s) => s.visualEditReady);
  const enabled = useProjectStore((s) => s.visualEditEnabled);
  const setEnabled = useProjectStore((s) => s.setVisualEditEnabled);

  if (!ready) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setEnabled(!enabled)}
          aria-label="Select an element"
          data-tour="select-element"
          aria-pressed={enabled}
          className={cn(
            "shrink-0",
            enabled && "border-line-hover bg-space-raised [&_svg]:text-blue-500",
          )}
        >
          <SquareMousePointerIcon />
          Edit
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {enabled ? "Stop selecting" : "Select an element to ask about it"}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Global theme editing. Sits beside the element picker because it is the same
 * feature at a different scale: one click here restyles every element that uses
 * a theme token, rather than the one element under the cursor.
 *
 * Unlike the picker this needs no in-iframe runtime: it edits `src/index.css`
 * directly: so it is offered whenever there is a preview at all.
 */
function ThemeToggle() {
  const open = useProjectStore((s) => s.themePanelOpen);
  const setOpen = useProjectStore((s) => s.setThemePanelOpen);
  const previewUrl = useProjectStore((s) => s.previewUrl);

  if (!previewUrl) return null;

  return (
    <ToolbarIcon
      label={open ? "Close theme" : "Edit theme"}
      pressed={open}
      onClick={() => setOpen(!open)}
      data-tour="theme-editor"
    >
      <SwatchBookIcon />
    </ToolbarIcon>
  );
}

/** The path chip ("/ ⌄") opens the preview-path popover
 *  (boards/Overlays.dc.html); reload and open-in-tab sit beside it. */
function PreviewNavigation() {
  const previewUrl = useProjectStore((s) => s.previewUrl);
  const previewPath = useProjectStore((s) => s.previewPath);
  const reloadPreview = useProjectStore((s) => s.reloadPreview);
  const setPreviewPath = useProjectStore((s) => s.setPreviewPath);
  const hasUrl = Boolean(previewUrl);

  // While the user is typing, the input shows their draft; the committed path
  // is only replaced on Enter. `null` means "not editing: show the real path".
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const value = draft ?? previewPath;

  const fullUrl = previewSrc(previewUrl, previewPath);

  const commit = () => {
    if (!hasUrl) return;
    setPreviewPath(value);
    setDraft(null);
    setOpen(false);
  };

  return (
    <div className="flex min-w-0 items-center gap-1" data-tour="url-bar">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          setDraft(null);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasUrl}
            aria-label={`Navigate preview: ${previewPath}`}
            title={fullUrl ?? "No preview yet"}
            className="max-w-32 min-w-0 sm:max-w-48"
          >
            <span className="truncate font-mono">{previewPath}</span>
            <ChevronDownIcon className="text-silver-600" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          aria-label="Preview navigation"
          className="w-80 max-w-[calc(100vw-24px)]"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
            className="flex flex-col gap-2"
          >
            <label htmlFor="preview-path" className="text-[13px] font-medium">
              Preview path
            </label>
            <InputGroup>
              <Input
                id="preview-path"
                value={value}
                spellCheck={false}
                autoComplete="off"
                placeholder="/settings"
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
              <Button type="submit">Go</Button>
            </InputGroup>
            <p className="text-xs text-silver-500">Enter a path or paste a URL.</p>
          </form>
        </PopoverContent>
      </Popover>
      <ToolbarIcon label="Reload preview" disabled={!hasUrl} onClick={() => hasUrl && reloadPreview()}>
        <RotateCwIcon />
      </ToolbarIcon>
      <ToolbarIcon
        label="Open in new tab"
        disabled={!hasUrl}
        onClick={() => fullUrl && window.open(fullUrl, "_blank")}
      >
        <ExternalLinkIcon />
      </ToolbarIcon>
    </div>
  );
}

export function RightPanel() {
  useGithubReturnToast();
  const activeTab = useProjectStore((s) => s.activeTab);
  const projectId = useProjectStore((s) => s.projectId);
  const previewDevice = useProjectStore((s) => s.previewDevice);
  const isChatOpen = useProjectStore((s) => s.isChatOpen);
  const toggleChat = useProjectStore((s) => s.toggleChat);
  const setActiveTab = useProjectStore((s) => s.setActiveTab);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("publish") === "1" || params.get("tool") === "publish") {
      setParams(projectToolParams(params, "deploy", selectedDeploySection(params)), { replace: true });
      setActiveTab("tools");
    } else {
      const tab = params.get("tab");
      if (tab === "tools" || tab === "preview" || tab === "code") setActiveTab(tab);
    }
  }, [projectId, params, setParams, setActiveTab]);

  return (
    <div className="flex h-full min-w-0 flex-col bg-space-void">
      {/* boards/Workspace-*.dc.html: 64px bar, the view switch and preview
          tools on the left; device, GitHub, Deploy and you on the right. */}
      <div className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line py-3 pr-5 pl-4">
        {!isChatOpen && (
          <ToolbarIcon label="Open chat" onClick={toggleChat}>
            <PanelLeftOpenIcon />
          </ToolbarIcon>
        )}

        <TabToggle />
        {activeTab === "preview" && <PreviewNavigation />}

        <div className="flex-1" />
        {activeTab === "preview" && <VisualEditToggle />}
        {activeTab === "preview" && <ThemeToggle />}
        {activeTab === "preview" && <DeviceSwitcher />}

        <div
          className="flex items-center gap-2.5"
          aria-label="Project sharing and deployment"
          data-tour="ship"
        >
          <GithubPanel />
          <DeployPanel />
        </div>
        <span className="ml-1 flex">
          <UserMenu />
        </span>
      </div>

      <div className="min-h-0 flex-1">
        {/* Keep the iframe mounted while Code is open. Unmounting it made a
            simple tab round-trip navigate the preview again and replay the
            post-load shimmer even though the already-loaded page was usable. */}
        <div
          className={cn("h-full bg-space-void", activeTab !== "preview" && "hidden")}
          aria-hidden={activeTab !== "preview"}
        >
          <PreviewPane
            device={previewDevice}
            active={activeTab === "preview"}
          />
        </div>

        {activeTab === "code" && (
          <Suspense
            fallback={
              <div className="flex h-full flex-col gap-3 bg-space-void p-6" aria-label="Loading editor">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            }
          >
            <CodePane />
          </Suspense>
        )}

        {activeTab === "tools" && projectId && (
          <ToolsPane key={projectId} projectId={projectId} />
        )}
      </div>
    </div>
  );
}
