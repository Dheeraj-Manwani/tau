import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import { useSearchParams } from "react-router-dom";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  RocketIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/src/lib/utils";
import { boltFlash } from "@/src/lib/bolt";
import { celebrateFirstDeploy } from "@/src/lib/confetti";
import { Button } from "@/src/components/ui/button";
import { StatusDot } from "@/src/components/ui/badge";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { billingKeys } from "@/src/features/billing/api";
import { initialTitle, useDeployStatus, useIdentity } from "./deploy";
import { AppLogo } from "./AppLogo";
import { deployPresentation, deployToneClass } from "./deployPresentation";
import {
  selectedProjectTool,
  useProjectToolNavigation,
  type DeploySection,
} from "./toolNavigation";

/** Unpublished apps open Deploy directly; other states offer a navigational summary. */
export function DeployPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const query = useDeployStatus(projectId);
  const status = query.data;
  const [open, setOpen] = useState(false);
  const identity = useIdentity(projectId, open);
  const openTool = useProjectToolNavigation();
  const [params] = useSearchParams();
  const activeTab = useProjectStore((s) => s.activeTab);
  const qc = useQueryClient();
  const previous = useRef<{
    projectId: string | null;
    inProgress: boolean;
    wasLive: boolean;
  } | null>(null);

  // Always mounted in the topbar: completion is reported even after leaving Tools.
  useEffect(() => {
    if (!status) return;
    const before = previous.current;
    previous.current = { projectId, inProgress: status.inProgress, wasLive: !!status.live };
    if (
      before?.projectId !== projectId ||
      !before.inProgress ||
      status.inProgress
    )
      return;
    if (
      status.lastFailure?.schemaChanges?.length &&
      !status.lastFailure.changedSince
    ) {
      toast("Deploying needs your review: database changes were detected.");
    } else if (status.lastFailure) {
      toast.error(
        status.live
          ? "The update failed. Your previous version is still live."
          : "Deploying failed. Open Deploy to see what happened.",
      );
    } else if (status.live) {
      const message = before.wasLive ? "Your new version is live" : "Your app is live";
      const liveUrl = status.suspended ? null : (status.primaryUrl ?? status.url);
      // The address rides along: you shouldn't have to go looking for what you just shipped.
      toast.success(
        liveUrl
          ? (t) => (
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {message}
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => toast.dismiss(t.id)}
                  className="inline-flex items-center gap-1 font-medium text-blue-500 hover:text-blue-hi"
                >
                  Open
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </span>
            )
          : message,
        { duration: liveUrl ? 8000 : undefined },
      );
      // Tier A success moment: one bolt, and confetti only the first time.
      boltFlash();
      if (!before.wasLive) celebrateFirstDeploy();
      void qc.invalidateQueries({ queryKey: billingKeys.balance });
    }
  }, [status, projectId, qc]);

  const presentation = status ? deployPresentation(status) : null;
  const label =
    presentation?.label ?? (query.isError ? "Status unavailable" : "Checking…");
  const go = (section: DeploySection) => {
    setOpen(false);
    openTool("deploy", section);
  };
  const url = status?.primaryUrl ?? status?.url;
  const unpublished = presentation?.label === "Deploy";
  // An unpublished app's Deploy is the workspace's one primary
  // (boards/Workspace-Building.dc.html), except while the Deploy page is open:
  // that page carries its own primary, so the shortcut steps back.
  const onDeployPage =
    activeTab === "tools" && selectedProjectTool(params) === "deploy";
  const busy = presentation?.tone === "busy" || query.isLoading;
  const trigger = (
    <Button
      variant={unpublished && !onDeployPage ? "primary" : "secondary"}
      aria-label={label}
      onClick={unpublished ? () => go("overview") : undefined}
      className="h-8 shrink-0"
    >
      {busy ? (
        <StatusDot tone="deploying" />
      ) : unpublished ? (
        <RocketIcon />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            deployToneClass[presentation?.tone ?? "neutral"],
          )}
        />
      )}
      {label}
      {!unpublished && <ChevronDownIcon className="text-silver-600" />}
    </Button>
  );

  if (unpublished) return trigger;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Deployment summary"
          className="tau-pop tau-pop-rows z-50 max-h-[var(--radix-popover-content-available-height)] w-[288px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-line-strong bg-space-overlay p-1.5 text-silver-900 shadow-[0_16px_48px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)] outline-none"
        >
          <div className="-mx-1.5 mb-1.5 flex items-start gap-3 border-b border-line px-4 pt-2.5 pb-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong bg-space-surface">
              <AppLogo projectId={projectId} icon={identity.data?.icon} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">
                {identity.data
                  ? initialTitle(identity.data)
                  : (status?.slug ?? "Your app")}
              </p>
              <p
                role="status"
                className="mt-1 text-xs leading-relaxed text-silver-500"
              >
                {query.isError
                  ? "Status unavailable. Open Deploy to retry."
                  : (presentation?.detail ?? "Checking deployment status…")}
              </p>
            </div>
          </div>
          {url && status?.live && !status.suspended && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left font-mono text-xs text-blue-500 outline-none hover:bg-space-raised focus-visible:bg-space-raised sm:min-h-[34px]"
            >
              <span className="min-w-0 break-all">
                {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
              <ExternalLinkIcon className="size-3.5 shrink-0" />
            </a>
          )}
          <button
            type="button"
            onClick={() =>
              go(
                status?.inProgress || status?.lastFailure
                  ? "deployments"
                  : "overview",
              )
            }
            className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left text-[13px] outline-none hover:bg-space-raised focus-visible:bg-space-raised sm:min-h-[34px]"
          >
            Manage deployment
            <ArrowRightIcon className="size-3.5 shrink-0 text-silver-600" />
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
