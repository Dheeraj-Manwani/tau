import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  LoaderCircleIcon,
  RocketIcon,
  XIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/src/lib/utils";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { billingKeys } from "@/src/features/billing/api";
import { deployedAgo, useDeployStatus } from "./deploy";
import { publishPresentation, publishToneClass } from "./publishPresentation";
import {
  useProjectToolNavigation,
  type PublishSection,
} from "./toolNavigation";

/** Unpublished apps open Publish directly; other states offer a navigational summary. */
export function DeployPanel() {
  const projectId = useProjectStore((s) => s.projectId);
  const query = useDeployStatus(projectId);
  const status = query.data;
  const [open, setOpen] = useState(false);
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
      toast("Publishing needs your review: database changes were detected.");
    } else if (status.lastFailure) {
      toast.error(
        status.live
          ? "The update failed. Your previous version is still live."
          : "Publishing failed. Open Publish to see what happened.",
      );
    } else if (status.live) {
      toast.success("Your new version is live");
      void qc.invalidateQueries({ queryKey: billingKeys.balance });
    }
  }, [status, projectId, qc]);

  const presentation = status ? publishPresentation(status) : null;
  const label =
    presentation?.label ?? (query.isError ? "Status unavailable" : "Checking…");
  const go = (section: PublishSection) => {
    setOpen(false);
    openTool("publish", section);
  };
  const url = status?.primaryUrl ?? status?.url;
  const unpublished = presentation?.label === "Publish";
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
            publishToneClass[presentation?.tone ?? "neutral"],
          )}
        />
      )}
      {label}
      {!unpublished && <ChevronDownIcon className="size-3.5 text-current opacity-60" />}
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
          className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[340px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-xl border border-silver-200 bg-space-surface p-4 text-silver-900 outline-none"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-medium">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  publishToneClass[presentation?.tone ?? "neutral"],
                )}
              />
              {!status
                ? query.isError
                  ? "Status unavailable"
                  : "Checking status…"
                : status.suspended
                  ? "Site suspended"
                  : status?.live
                    ? "Production · Live"
                    : status?.inProgress
                      ? "Publishing"
                      : status?.url
                        ? "Reserved address"
                        : "Not published yet"}
            </p>
            <Popover.Close
              aria-label="Close deployment summary"
              className="flex size-7 items-center justify-center rounded-md text-silver-600 hover:bg-space-overlay"
            >
              <XIcon className="size-3.5" />
            </Popover.Close>
          </div>
          {url && (
            <button
              type="button"
              onClick={() => go("identity")}
              className="mt-3 flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-blue-500 hover:text-blue-300"
            >
              <span className="min-w-0 break-all">
                {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
              <ArrowRightIcon className="size-3.5 shrink-0" />
            </button>
          )}
          {status?.live && !status.suspended && (
            <p className="mt-1.5 text-[11px] text-silver-600">
              Published{" "}
              {deployedAgo(status.live.completedAt ?? status.live.createdAt)} ·{" "}
              <span className="font-mono">{status.live.id.slice(0, 8)}</span>
            </p>
          )}
          <p
            className={cn(
              "mt-3 rounded-lg p-3 text-xs leading-relaxed",
              presentation?.tone === "warning"
                ? "bg-amber-500/10 text-amber-200"
                : presentation?.tone === "error"
                  ? "bg-red-500/10 text-red-200"
                  : "bg-space-overlay text-silver-600",
            )}
          >
            {query.isError
              ? "Couldn't refresh deployment status. Open Publish to retry."
              : (presentation?.detail ?? "Checking your publishing status…")}
          </p>
          {query.isError && status && (
            <p className="mt-2 text-[11px] text-silver-600">
              Last successful check:{" "}
              {new Date(query.dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
          <div className="mt-3 border-t border-silver-200 pt-2">
            {(
              [
                [
                  "overview",
                  status?.inProgress
                    ? "View publish progress"
                    : status?.live
                      ? status.unpublishedChanges > 0 || status.lastFailure
                        ? "Publish update"
                        : "View publishing"
                      : "Set up publishing",
                ],
                ["activity", "Activity & build output"],
                ["history", "Deployment history"],
                ["manage", "Manage publishing"],
              ] as [PublishSection, string][]
            ).map(([section, text]) => (
              <button
                key={section}
                type="button"
                onClick={() => go(section)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-1.5 text-left text-xs hover:bg-space-overlay focus-visible:outline-2 focus-visible:outline-ring sm:min-h-9"
              >
                {text}
                <ArrowRightIcon className="size-3.5 text-silver-600" />
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
