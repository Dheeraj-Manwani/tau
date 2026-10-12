import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RocketIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useIsMutating } from "@tanstack/react-query";
import { cn } from "@/src/lib/utils";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useBalance } from "@/src/features/billing/api";
import { AddressPicker, BuyCredits, IdentitySection } from "./IdentitySection";
import {
  deployKeys,
  deployedAgo,
  errorMessage,
  formatBytes,
  useDeployStatus,
  useNameCheck,
  usePublishProject,
} from "./deploy";
import {
  activeDeployment,
  deploymentDuration,
  deploymentSteps,
  publishPresentation,
  publishSectionAvailability,
  publishToneClass,
} from "./publishPresentation";
import {
  selectedPublishSection,
  useProjectToolNavigation,
  type PublishSection,
} from "./toolNavigation";
import {
  ExportData,
  PublishBadge,
  PublishFailure,
  PublishHistory,
  PublishNotice,
  RefreshSecrets,
  ServerLogs,
  TakeOffline,
  publishButtonClass,
  publishPrimaryClass,
} from "./PublishOperations";

function PublishedUrlActions({ url }: { url: string }) {
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={publishButtonClass}
      >
        Open site
        <ExternalLinkIcon className="size-3.5" />
      </a>
      <button
        type="button"
        className={publishButtonClass}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            toast.success("URL copied");
          } catch {
            toast.error(
              "Couldn't copy the URL. Select the address above to copy it.",
            );
          }
        }}
      >
        <CopyIcon className="size-3.5" />
        Copy URL
      </button>
    </>
  );
}

function PublishGroup({
  id,
  title,
  description,
  forced,
  visible,
  children,
}: {
  id: PublishSection;
  title: string;
  description: string;
  forced: boolean;
  visible: boolean;
  children: ReactNode;
}) {
  const navigationKey = useLocation().key;
  const [choice, setChoice] = useState<{
    key: string;
    forced: boolean;
    open: boolean;
  } | null>(null);
  const open =
    choice?.key === navigationKey && choice.forced === forced
      ? choice.open
      : forced;
  if (!visible) return null;
  return (
    <section
      data-publish-section={id}
      className="rounded-xl border border-silver-200 bg-space-surface"
    >
      <h2
        tabIndex={-1}
        className="rounded-xl focus-visible:outline-2 focus-visible:outline-ring"
      >
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`publish-${id}-content`}
          onClick={() => setChoice({ key: navigationKey, forced, open: !open })}
          className="flex w-full items-center justify-between gap-4 p-4 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-silver-900">
              {title}
            </span>
            <span className="mt-1 block text-xs font-normal leading-relaxed text-silver-600">
              {description}
            </span>
          </span>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-silver-600 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </h2>
      <div
        id={`publish-${id}-content`}
        hidden={!open}
        className="border-t border-silver-200 p-4"
      >
        {children}
      </div>
    </section>
  );
}

/** All publishing actions live here; the topbar only summarizes and navigates. */
export function PublishPane({ projectId }: { projectId: string }) {
  const query = useDeployStatus(projectId);
  const status = query.data;
  const publish = usePublishProject(projectId);
  const pendingActions = useIsMutating({
    mutationKey: deployKeys.action(projectId),
  });
  const balance = useBalance();
  const generating = useProjectStore(
    (s) => s.status === "streaming" && !s.isPreviewJob,
  );
  const [params] = useSearchParams();
  const navigationKey = useLocation().key;
  const requestedSection = selectedPublishSection(params);
  const available = status
    ? publishSectionAvailability(status, publish.isPending)
    : null;
  const section = available?.[requestedSection] ? requestedSection : "overview";
  const openTool = useProjectToolNavigation();
  const root = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState<string | null>(null);
  const choosing = !!status && !status.slug && status.suggestedName !== null;
  const chosenName = choosing ? (address ?? status.suggestedName) : null;
  const nameCheck = useNameCheck(projectId, chosenName);
  const [, tick] = useState(0);
  const busy = !!status?.inProgress || publish.isPending;
  useEffect(() => {
    if (!busy) return;
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [busy]);
  useEffect(() => {
    if (!query.isSuccess) return;
    const target = root.current?.querySelector<HTMLElement>(
      `[data-publish-section="${section}"]`,
    );
    target?.scrollIntoView({ block: "nearest" });
    target?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  }, [section, navigationKey, query.isSuccess]);

  if (!status)
    return (
      <div className="p-6 text-sm text-silver-600" role="status">
        {query.isError ? (
          <>
            <p>Couldn't load publishing status.</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={cn(publishButtonClass, "mt-3")}
            >
              Try again
            </button>
          </>
        ) : (
          <p className="flex items-center gap-2">
            <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
            Loading publishing status…
          </p>
        )}
      </div>
    );

  const presentation = publishPresentation(status);
  const url = status.primaryUrl ?? status.url;
  const blocked =
    busy ||
    pendingActions > 0 ||
    generating ||
    !!status.suspended ||
    query.isError;
  const feeDue = status.publishFee.due && !status.live;
  const insufficient =
    feeDue &&
    !!balance.data &&
    balance.data.credits.available < status.publishFee.credits;
  const addressUnavailable =
    choosing &&
    (!chosenName ||
      nameCheck.checking ||
      nameCheck.data?.name !== chosenName.trim().toLowerCase() ||
      !nameCheck.data.available);
  const review =
    !!status.lastFailure?.schemaChanges?.length &&
    !status.lastFailure.changedSince;
  const attempt =
    activeDeployment(status) ?? status.deployments[0] ?? status.live;
  const steps = attempt ? deploymentSteps(attempt, review) : [];
  const duration = attempt ? deploymentDuration(attempt) : null;
  const cannotPublish =
    blocked || insufficient || (feeDue && !balance.data) || addressUnavailable;
  const start = (confirmSchemaChange = false) => {
    if (cannotPublish) return;
    publish.mutate({
      ...(chosenName ? { name: chosenName } : {}),
      ...(confirmSchemaChange ? { confirmSchemaChange: true } : {}),
    });
  };
  const label = busy
    ? "Publishing…"
    : status.lastFailure && !status.lastFailure.changedSince
      ? "Retry publish"
      : status.live
        ? status.unpublishedChanges > 0
          ? "Publish update"
          : "Republish"
        : status.deployments.some((d) => d.status === "SUPERSEDED")
          ? "Publish again"
          : "Publish app";

  return (
    <div
      ref={root}
      className="h-full overflow-y-auto px-4 py-5 text-silver-900 sm:px-6"
    >
      <div className="mx-auto max-w-3xl space-y-4 pb-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-medium">Publish</h1>
            <p className="mt-1 text-xs leading-relaxed text-silver-600">
              Put your app online. Follow each publish and manage what visitors
              see.
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-2 rounded-full border border-silver-200 px-2.5 py-1 text-[11px]">
            <span
              className={cn(
                "size-1.5 rounded-full",
                publishToneClass[presentation.tone],
              )}
            />
            {presentation.label === "Deployed" ? "Live" : presentation.label}
          </span>
        </header>
        {query.isError && (
          <PublishNotice tone="error">
            Couldn't refresh status. These are the last known details. Last
            successful check:{" "}
            {new Date(query.dataUpdatedAt).toLocaleTimeString()}.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => void query.refetch()}
            >
              Retry status check
            </button>
          </PublishNotice>
        )}
        {status.suspended && (
          <PublishNotice tone="error">{presentation.detail}</PublishNotice>
        )}
        <section
          data-publish-section="overview"
          className="rounded-xl border border-silver-200 bg-space-surface p-4 sm:p-5"
        >
          <h2
            tabIndex={-1}
            className="text-xs font-medium text-silver-600 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {status.live
              ? "Production"
              : status.url
                ? "Your reserved address"
                : "Your first publish"}
          </h2>
          {url ? (
            <p className="mt-3 break-all text-lg font-medium tracking-tight">
              {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </p>
          ) : (
            <p className="mt-3 text-sm">Choose your app's public address</p>
          )}
          {status.live ? (
            <p className="mt-2 text-[11px] text-silver-600">
              Published{" "}
              {deployedAgo(status.live.completedAt ?? status.live.createdAt)} ·
              Version{" "}
              <span className="font-mono">{status.live.id.slice(0, 8)}</span>
              {status.live.fileCount > 0 &&
                ` · ${status.live.fileCount} files · ${formatBytes(status.live.sizeBytes)}`}
            </p>
          ) : (
            <p className="mt-2 text-xs text-silver-600">
              {status.url
                ? "This address is reserved. There is no live version."
                : "Your preview stays separate from the published app."}
            </p>
          )}
          {choosing && (
            <div className="mt-4">
              <AddressPicker
                projectId={projectId}
                suggested={status.suggestedName!}
                domain={status.domain}
                value={address}
                onChange={setAddress}
              />
            </div>
          )}
          <div className="mt-4" role="status" aria-live="polite">
            <p
              className={cn(
                "text-xs leading-relaxed",
                presentation.tone === "warning"
                  ? "text-amber-200"
                  : "text-silver-600",
              )}
            >
              {presentation.detail}
            </p>
          </div>
          {status.live?.error && status.lastFailure && (
            <p className="mt-2 text-xs text-amber-200">{status.live.error}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!review && (
              <button
                type="button"
                disabled={cannotPublish}
                onClick={() => start()}
                className={cn(
                  publishButtonClass,
                  (!status.live ||
                    status.lastFailure ||
                    status.unpublishedChanges > 0) &&
                    publishPrimaryClass,
                )}
              >
                {busy ? (
                  <LoaderCircleIcon className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <RocketIcon className="size-3.5" />
                )}
                {label}
                {feeDue && !busy && ` · ${status.publishFee.credits} credits`}
              </button>
            )}
            {url && status.live && !status.suspended && (
              <PublishedUrlActions url={url} />
            )}
          </div>
          <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-silver-600">
            <p>
              {feeDue
                ? `First successful publish: ${status.publishFee.credits} credits. Failed attempts are not charged. Future updates are free.`
                : status.live
                  ? "Publishing updates is free. Your current version stays live while the new one is prepared."
                  : "Publishing updates is free. Your app goes online when the publish succeeds."}
            </p>
            {generating && (
              <p>
                Wait for Tau to finish editing before publishing this project.
              </p>
            )}
            {feeDue && !balance.data && (
              <p>
                {balance.isError
                  ? "Couldn't check your credit balance."
                  : "Checking your credit balance…"}
                {balance.isError && (
                  <button
                    type="button"
                    onClick={() => void balance.refetch()}
                    className="ml-1 text-blue-500 underline"
                  >
                    Retry balance check
                  </button>
                )}
              </p>
            )}
            {insufficient && (
              <BuyCredits>
                First publish needs {status.publishFee.credits} credits. You
                have {balance.data!.credits.available}.
              </BuyCredits>
            )}
            <PublishBadge />
          </div>
        </section>
        {status.lastFailure && !status.inProgress && (
          <PublishFailure
            projectId={projectId}
            failure={status.lastFailure}
            blocked={blocked}
            confirmDisabled={cannotPublish}
            onConfirmSchema={() => start(true)}
          />
        )}
        {publish.isError && (
          <PublishNotice tone="error">
            {errorMessage(publish.error, "Couldn't start publishing.")}
          </PublishNotice>
        )}
        {status.serverWarning && (
          <PublishNotice>{status.serverWarning}</PublishNotice>
        )}
        <PublishGroup
          visible={!!available?.activity}
          key={attempt?.id ?? (publish.isPending ? "request" : "empty")}
          id="activity"
          title="Publish activity"
          description={
            busy
              ? "Publishing continues if you leave this tab."
              : attempt
                ? "What happened during the latest publish."
                : "Each reported stage will appear here when you publish."
          }
          forced={
            section === "activity" ||
            busy ||
            publish.isSuccess ||
            !!status.lastFailure
          }
        >
          {attempt ? (
            <>
              <div className="mb-4 flex flex-wrap justify-between gap-2 text-[11px] text-silver-600">
                <span>
                  Attempt{" "}
                  <span className="font-mono">{attempt.id.slice(0, 8)}</span>
                  {duration &&
                    ` · ${duration} ${attempt.completedAt ? "total" : "since requested"}`}
                </span>
                <span>
                  Last checked{" "}
                  {new Date(query.dataUpdatedAt).toLocaleTimeString()}
                </span>
              </div>
              <ol className="space-y-4">
                {steps.map((step) => (
                  <li key={step.id} className="flex gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        step.state === "done"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                          : step.state === "active"
                            ? "border-blue-400/30 text-blue-400"
                            : step.state === "failed"
                              ? "border-red-400/30 text-red-300"
                              : "border-silver-200 text-silver-600",
                      )}
                    >
                      {step.state === "done" ? (
                        <CheckIcon className="size-3" />
                      ) : step.state === "active" ? (
                        <LoaderCircleIcon className="size-3 animate-spin motion-reduce:animate-none" />
                      ) : (
                        <span className="size-1 rounded-full bg-current" />
                      )}
                    </span>
                    <div>
                      <p
                        className={cn(
                          "text-xs font-medium",
                          step.state === "pending" && "text-silver-600",
                        )}
                      >
                        {step.label}
                        <span className="ml-2 text-[10px] font-normal text-silver-600">
                          {step.state === "done"
                            ? "Complete"
                            : step.state === "active"
                              ? "In progress"
                              : step.state === "pending"
                                ? "Next"
                                : step.state === "review"
                                  ? "Needs your decision"
                                  : "Failed"}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-silver-600">
                        {step.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            busy && (
              <p className="text-xs text-silver-600">
                Waiting for the publisher to report the first stage.
              </p>
            )
          )}
          {publish.isPending && !status.inProgress && (
            <p role="status" className="mt-3 text-xs text-blue-300">
              Sending your publish request…
            </p>
          )}
          {busy && (
            <p className="mt-4 text-[11px] leading-relaxed text-silver-600">
              Status refreshes every few seconds. Build output becomes available
              here if the publish fails.
            </p>
          )}
          {status.lastFailure?.buildLog && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-blue-500">
                View failed build output
              </summary>
              <p className="my-2 text-[11px] text-silver-600">
                Last lines saved from the failed build.
              </p>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-space-void p-3 font-mono text-xs text-silver-600">
                {status.lastFailure.buildLog}
              </pre>
            </details>
          )}
        </PublishGroup>
        <PublishGroup
          visible={!!available?.identity}
          id="identity"
          title="Address & appearance"
          description="Manage your public address, app name and logo."
          forced={section === "identity"}
        >
          <div className="space-y-3">
            {url && (
              <div className="text-xs text-silver-600">
                <p className="break-all text-silver-900">{url}</p>
                {status.primaryUrl &&
                  status.url &&
                  status.primaryUrl !== status.url && (
                    <p className="mt-1 break-all">Tau address: {status.url}</p>
                  )}
                <p className="mt-2">
                  Your Tau address stays reserved for this project.
                </p>
              </div>
            )}
            {url && status.live && !status.suspended && (
              <div className="flex flex-wrap gap-2">
                <PublishedUrlActions url={url} />
              </div>
            )}
            <button
              type="button"
              onClick={() => openTool("domains")}
              className={publishButtonClass}
            >
              Manage custom domains
            </button>
            <IdentitySection projectId={projectId} />
            <p className="text-[11px] text-silver-600">
              Publish after saving appearance changes to update your live app.
            </p>
          </div>
        </PublishGroup>
        <PublishGroup
          visible={!!available?.production}
          id="production"
          title="Production resources"
          description="The server, database and files used by your published app."
          forced={section === "production"}
        >
          <div className="space-y-5">
            {status.backendPublished && (
              <div>
                <h3 className="text-xs font-medium">Server</h3>
                <p className="my-2 text-xs leading-relaxed text-silver-600">
                  Apply updated secrets to the live server or inspect recent
                  runtime output.
                </p>
                <div className="mb-2">
                  <button
                    type="button"
                    onClick={() => openTool("secrets")}
                    className={publishButtonClass}
                  >
                    Manage secrets
                  </button>
                </div>
                <RefreshSecrets
                  projectId={projectId}
                  blocked={blocked || !status.live}
                />
                <ServerLogs projectId={projectId} />
              </div>
            )}
            {status.databasePublished && (
              <div>
                <h3 className="text-xs font-medium">Database</h3>
                <p className="my-2 text-xs leading-relaxed text-silver-600">
                  Production data is separate from preview data. Restoring a
                  published version does not restore this data.
                </p>
                <ExportData
                  projectId={projectId}
                  blocked={!!status.suspended}
                />
              </div>
            )}
            {status.storagePublished && (
              <div>
                <h3 className="text-xs font-medium">File storage</h3>
                <p className="my-2 text-xs text-silver-600">
                  Inspect files uploaded to the published app.
                </p>
                <button
                  type="button"
                  onClick={() => openTool("storage", undefined, true)}
                  className={publishButtonClass}
                >
                  Open production storage
                </button>
              </div>
            )}
            {!status.backendPublished &&
              !status.databasePublished &&
              !status.storagePublished && (
                <p className="text-xs text-silver-600">
                  No production server, database or storage has been reported
                  for this project.
                </p>
              )}
          </div>
        </PublishGroup>
        <PublishGroup
          visible={!!available?.history}
          id="history"
          title="Deployment history"
          description={`${status.deployments.length} recorded ${status.deployments.length === 1 ? "attempt" : "attempts"}. Inspect versions and restore an available publish.`}
          forced={section === "history"}
        >
          {status.deployments.length ? (
            <PublishHistory
              projectId={projectId}
              status={status}
              blocked={blocked}
            />
          ) : (
            <p className="text-xs text-silver-600">
              Your first publish will appear here.
            </p>
          )}
        </PublishGroup>
        <PublishGroup
          visible={!!available?.manage}
          id="manage"
          title="Manage publishing"
          description="Control public access to your app."
          forced={section === "manage"}
        >
          {status.suspended ? (
            <p className="text-xs text-silver-600">
              Publishing actions are unavailable while this site is suspended.
            </p>
          ) : status.live ? (
            <TakeOffline projectId={projectId} blocked={blocked} />
          ) : (
            <p className="text-xs leading-relaxed text-silver-600">
              {status.url
                ? "Your site is offline. Publish again or restore an available version from deployment history."
                : "Your app is not public yet. Start with your first publish above."}
            </p>
          )}
        </PublishGroup>
      </div>
    </div>
  );
}
