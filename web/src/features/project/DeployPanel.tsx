import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RocketIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/src/lib/utils";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { billingKeys } from "@/src/features/billing/api";
import { initialTitle, useDeployStatus, useIdentity } from "./deploy";
import { AppLogo } from "./AppLogo";
import { deployPresentation, deployToneClass } from "./deployPresentation";
import { useProjectToolNavigation, type DeploySection } from "./toolNavigation";

/** Unpublished apps open Deploy directly; other states offer a navigational summary. */
export function DeployPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const query = useDeployStatus(projectId);
  const status = query.data;
  const [open, setOpen] = useState(false);
  const identity = useIdentity(projectId, open);
  const openTool = useProjectToolNavigation();
  const qc = useQueryClient();
  const previous = useRef<{
    projectId: string | null;
    inProgress: boolean;
  } | null>(null);

  // Always mounted in the topbar: completion is reported even after leaving Tools.
  useEffect(() => {
    if (!status) return;
    const before = previous.current;
    previous.current = { projectId, inProgress: status.inProgress };
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
      toast.success("Your new version is live");
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
  const trigger = (
    <button
      type="button"
      aria-label={label}
      onClick={unpublished ? () => go("overview") : undefined}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring sm:h-9",
        unpublished
          ? "border-transparent bg-blue-500 text-blue-900 hover:bg-blue-400"
          : "border-silver-200 bg-space-surface text-silver-900 hover:bg-space-overlay",
      )}
    >
      {presentation?.tone === "busy" || query.isLoading ? (
        <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />
      ) : unpublished ? (
        <RocketIcon className="size-3.5" />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 rounded-full",
            deployToneClass[presentation?.tone ?? "neutral"],
          )}
        />
      )}
      {label}
      {!unpublished && (
        <ChevronDownIcon className="size-3.5 text-current opacity-60" />
      )}
    </button>
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
          className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[280px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-silver-200 bg-space-surface p-2 text-silver-900 outline-none"
        >
          <div className="mb-1 flex items-start gap-3 border-b border-silver-200 px-2.5 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-silver-200 bg-space-overlay">
              <AppLogo projectId={projectId} icon={identity.data?.icon} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {identity.data
                  ? initialTitle(identity.data)
                  : (status?.slug ?? "Your app")}
              </p>
              <p
                role="status"
                className="mt-1 text-[11px] leading-relaxed text-silver-600"
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
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-xs font-medium text-blue-500 hover:bg-space-overlay focus-visible:outline-2 focus-visible:outline-ring sm:min-h-9"
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
            className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-xs hover:bg-space-overlay focus-visible:outline-2 focus-visible:outline-ring sm:min-h-9"
          >
            Manage deployment
            <ArrowRightIcon className="size-3.5 shrink-0 text-silver-600" />
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
