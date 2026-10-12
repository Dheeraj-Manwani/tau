import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  CopyIcon,
  ArrowRightIcon,
  LockIcon,
  ExternalLinkIcon,
  LoaderCircleIcon,
  RocketIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useIsMutating } from "@tanstack/react-query";
import { cn } from "@/src/lib/utils";
import { ToolPaneContent } from "./ToolPaneContent";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useBalance } from "@/src/features/billing/api";
import { AppLogo } from "./AppLogo";
import { DeploymentList } from "./DeploymentList";
import { AddressPicker, BuyCredits, IdentitySection } from "./IdentitySection";
import {
  deployKeys,
  deployedAgo,
  errorMessage,
  formatBytes,
  useDeployStatus,
  useNameCheck,
  useIdentity,
  initialTitle,
  useDeployProject,
} from "./deploy";
import {
  deployPresentation,
  deploySectionAvailability,
  deployToneClass,
} from "./deployPresentation";
import {
  selectedDeploySection,
  useProjectToolNavigation,
  type DeploySection,
} from "./toolNavigation";
import {
  ExportData,
  DeployBadge,
  DeployNotice,
  RefreshSecrets,
  ServerLogs,
  TakeOffline,
  deployButtonClass,
  deployPrimaryClass,
} from "./DeployOperations";

function DeployedUrlActions({ url }: { url: string }) {
  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={deployButtonClass}
      >
        Open site
        <ExternalLinkIcon className="size-3.5" />
      </a>
      <button
        type="button"
        className={deployButtonClass}
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

/** All deploying actions live here; the topbar only summarizes and navigates. */
export function DeployPane({ projectId }: { projectId: string }) {
  const query = useDeployStatus(projectId);
  const status = query.data;
  const deploy = useDeployProject(projectId);
  const pendingActions = useIsMutating({
    mutationKey: deployKeys.action(projectId),
  });
  const balance = useBalance();
  const generating = useProjectStore(
    (s) => s.status === "streaming" && !s.isPreviewJob,
  );
  const [params] = useSearchParams();
  const navigationKey = useLocation().key;
  const requestedSection =
    params.has("deploySection") || params.has("publishSection")
      ? selectedDeploySection(params)
      : status?.inProgress || status?.lastFailure
        ? "deployments"
        : "overview";
  const [identityDirty, setIdentityDirty] = useState(false);
  const identity = useIdentity(projectId, true);
  const available = status
    ? deploySectionAvailability(status, deploy.isPending || deploy.isSuccess)
    : null;
  const section = available?.[requestedSection] ? requestedSection : "overview";
  const openTool = useProjectToolNavigation();
  const root = useRef<HTMLDivElement>(null);
  const [address, setAddress] = useState<string | null>(null);
  const choosing = !!status && !status.slug && status.suggestedName !== null;
  const chosenName = choosing ? (address ?? status.suggestedName) : null;
  const nameCheck = useNameCheck(projectId, chosenName);
  const [, tick] = useState(0);
  const busy = !!status?.inProgress || deploy.isPending;
  useEffect(() => {
    if (!busy) return;
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [busy]);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy && !wasBusy.current && section !== "deployments") openTool("deploy", "deployments");
    wasBusy.current = busy;
  }, [busy, section, openTool]);
  useEffect(() => {
    if (!query.isSuccess) return;
    root.current?.scrollTo({ top: 0 });
  }, [section, navigationKey, query.isSuccess]);

  if (!status)
    return (
      <div className="h-full overflow-y-auto [scrollbar-gutter:stable]">
        <ToolPaneContent className="text-sm text-silver-600" role="status">
          {query.isError ? (
            <>
              <p>Couldn't load deployment status.</p>
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={cn(deployButtonClass, "mt-3")}
              >
                Try again
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2">
              <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" />
              Loading deployment status…
            </p>
          )}
        </ToolPaneContent>
      </div>
    );

  const presentation = deployPresentation(status);
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
  const cannotDeploy =
    blocked ||
    identityDirty ||
    insufficient ||
    (feeDue && !balance.data) ||
    addressUnavailable;
  const start = (confirmSchemaChange = false) => {
    if (cannotDeploy) return;
    openTool("deploy", "deployments");
    deploy.mutate({
      ...(chosenName ? { name: chosenName } : {}),
      ...(confirmSchemaChange ? { confirmSchemaChange: true } : {}),
    });
  };
  const label = identityDirty
    ? "Save changes first"
    : busy
      ? "Deploying…"
      : status.lastFailure && !status.lastFailure.changedSince
        ? "Retry deployment"
        : status.live
          ? status.unpublishedChanges > 0
            ? "Deploy changes"
            : "Redeploy"
          : status.deployments.some((d) => d.status === "SUPERSEDED")
            ? "Deploy again"
            : "Deploy site";

  const tabs: { id: DeploySection; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "identity", label: "Name & logo" },
    ...(available?.deployments
      ? [{ id: "deployments" as const, label: "Deployments" }]
      : []),
    ...(available?.resources
      ? [{ id: "resources" as const, label: "Resources" }]
      : []),
  ];
  const identityName = identity.data
    ? initialTitle(identity.data)
    : (status.slug ?? "Your app");
  return (
    <div
      ref={root}
      className="h-full overflow-y-auto text-silver-900 [scrollbar-gutter:stable]"
    >
      <ToolPaneContent className="space-y-5 pb-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-medium">Deploy</h1>
            <p className="mt-1 text-xs leading-relaxed text-silver-600">
              Make your app live and manage every deployment.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-2 text-[11px] text-silver-600">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  deployToneClass[presentation.tone],
                )}
              />
              {presentation.label === "Deployed"
                ? "Live"
                : presentation.label === "Deploy"
                  ? "Not deployed"
                  : presentation.label}
            </span>
            {!review && (
              <button
                type="button"
                disabled={cannotDeploy}
                onClick={() => start()}
                className={cn(
                  deployButtonClass,
                  (!status.live ||
                    status.lastFailure ||
                    status.unpublishedChanges > 0) &&
                    deployPrimaryClass,
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
            {review && (
              <button
                type="button"
                className={deployButtonClass}
                onClick={() => openTool("deploy", "deployments")}
              >
                Review database changes
              </button>
            )}
          </div>
        </header>
        {query.isError && (
          <DeployNotice tone="error">
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
          </DeployNotice>
        )}
        {status.suspended && (
          <DeployNotice tone="error">{presentation.detail}</DeployNotice>
        )}
        {status.serverWarning && (
          <DeployNotice>{status.serverWarning}</DeployNotice>
        )}
        {deploy.isError && (
          <DeployNotice tone="error">
            {errorMessage(deploy.error, "Couldn't start deploying.")}
          </DeployNotice>
        )}
        {identityDirty && (
          <DeployNotice tone="info">
            You have unsaved appearance changes. Save them in{" "}
            <button
              type="button"
              className="underline"
              onClick={() => openTool("deploy", "identity")}
            >
              Name & logo
            </button>{" "}
            before deploying.
          </DeployNotice>
        )}
        <div
          role="tablist"
          aria-label="Deployment settings"
          className="flex gap-1 overflow-x-auto border-b border-silver-200"
        >
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              id={`deploy-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={section === tab.id}
              aria-controls={`deploy-panel-${tab.id}`}
              tabIndex={section === tab.id ? 0 : -1}
              onClick={() => openTool("deploy", tab.id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === "ArrowRight")
                  next = (index + 1) % tabs.length;
                else if (event.key === "ArrowLeft")
                  next = (index + tabs.length - 1) % tabs.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = tabs.length - 1;
                else return;
                event.preventDefault();
                openTool("deploy", tabs[next].id);
                document.getElementById(`deploy-tab-${tabs[next].id}`)?.focus();
              }}
              className={cn(
                "shrink-0 border-b-2 px-3 py-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-ring",
                section === tab.id
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-silver-600 hover:text-silver-900",
              )}
            >
              {tab.label}
              {tab.id === "identity" && identityDirty && (
                <span
                  aria-label="Unsaved changes"
                  className="ml-2 inline-block size-1.5 rounded-full bg-amber-400"
                />
              )}
              {tab.id === "deployments" && busy && (
                <LoaderCircleIcon
                  aria-hidden="true"
                  className="ml-2 inline-block size-3 animate-spin"
                />
              )}
            </button>
          ))}
        </div>
        <div
          id="deploy-panel-overview"
          role="tabpanel"
          aria-labelledby="deploy-tab-overview"
          data-deploy-section="overview"
          tabIndex={-1}
          hidden={section !== "overview"}
          className="space-y-4 outline-none"
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-silver-200 bg-space-surface p-4">
            <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-silver-200 bg-space-overlay">
              <AppLogo projectId={projectId} icon={identity.data?.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{identityName}</p>
              <p className="mt-1 text-xs text-silver-600">
                App name, description and logo
              </p>
            </div>
            <button
              type="button"
              className={deployButtonClass}
              onClick={() => openTool("deploy", "identity")}
            >
              Edit name & logo
              <ArrowRightIcon className="size-3.5" />
            </button>
          </div>
          <section
            aria-label="Production deployment"
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
                  : "Your first deployment"}
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
                Deployed{" "}
                {deployedAgo(status.live.completedAt ?? status.live.createdAt)}{" "}
                · Version{" "}
                <span className="font-mono">{status.live.id.slice(0, 8)}</span>
                {status.live.fileCount > 0 &&
                  ` · ${status.live.fileCount} files · ${formatBytes(status.live.sizeBytes)}`}
              </p>
            ) : (
              <p className="mt-2 text-xs text-silver-600">
                {status.url
                  ? "This address is reserved. There is no live version."
                  : "Your preview stays separate from the deployed app."}
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
              {url && status.live && !status.suspended && (
                <DeployedUrlActions url={url} />
              )}
            </div>
            <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-silver-600">
              <p>
                {feeDue
                  ? `First successful deployment: ${status.publishFee.credits} credits. Failed attempts are not charged. Future updates are free.`
                  : status.live
                    ? "Deploying updates is free. Your current version stays live while the new one is prepared."
                    : "Deploying updates is free. Your app goes online when the deploy succeeds."}
              </p>
              {generating && (
                <p>
                  Wait for Tau to finish editing before deploying this project.
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
                  First deployment needs {status.publishFee.credits} credits.
                  You have {balance.data!.credits.available}.
                </BuyCredits>
              )}
              <DeployBadge />
            </div>
          </section>
          {(busy || status.lastFailure) && (
            <button
              type="button"
              className={deployButtonClass}
              onClick={() => openTool("deploy", "deployments")}
            >
              {busy
                ? "View deployment progress"
                : review
                  ? "Review database changes"
                  : "View last deployment"}
              <ArrowRightIcon className="size-3.5" />
            </button>
          )}
          {url && (
            <section className="rounded-xl border border-silver-200 bg-space-surface p-4">
              <h2 className="text-sm font-medium">Address & domains</h2>
              <p className="mt-2 break-all text-xs text-silver-600">
                Tau address: {status.url}
              </p>
              {status.primaryUrl && status.primaryUrl !== status.url && (
                <p className="mt-1 break-all text-xs text-silver-600">
                  Primary address: {status.primaryUrl}
                </p>
              )}
              <p className="mt-2 text-[11px] text-silver-600">
                Your Tau address stays reserved for this project.
              </p>
              <button
                type="button"
                onClick={() => openTool("domains")}
                className={cn(deployButtonClass, "mt-3")}
              >
                {!status.live && <LockIcon className="size-3.5" />}Manage custom
                domains
              </button>
            </section>
          )}
          {(status.live || status.suspended) && (
            <section className="rounded-xl border border-silver-200 bg-space-surface p-4">
              <h2 className="mb-2 text-sm font-medium">Site access</h2>
              {status.suspended ? (
                <p className="text-xs text-silver-600">
                  Deployment actions are unavailable while this site is
                  suspended.
                </p>
              ) : (
                <TakeOffline
                  projectId={projectId}
                  blocked={blocked || identityDirty}
                />
              )}
            </section>
          )}
        </div>
        <div
          id="deploy-panel-identity"
          role="tabpanel"
          aria-labelledby="deploy-tab-identity"
          data-deploy-section="identity"
          tabIndex={-1}
          hidden={section !== "identity"}
          className="rounded-xl border border-silver-200 bg-space-surface p-4 outline-none sm:p-5"
        >
          <IdentitySection
            projectId={projectId}
            blocked={busy || generating || !!status.suspended}
            onDirtyChange={setIdentityDirty}
            url={url}
          />
        </div>
        {available?.deployments && (
          <div
            id="deploy-panel-deployments"
            role="tabpanel"
            aria-labelledby="deploy-tab-deployments"
            data-deploy-section="deployments"
            tabIndex={-1}
            hidden={section !== "deployments"}
            className="space-y-4 outline-none"
          >
            <DeploymentList
              projectId={projectId}
              status={status}
              blocked={blocked || identityDirty}
              requesting={deploy.isPending}
              confirmDisabled={cannotDeploy}
              onConfirmSchema={() => start(true)}
            />
          </div>
        )}
        {available?.resources && (
          <div
            id="deploy-panel-resources"
            role="tabpanel"
            aria-labelledby="deploy-tab-resources"
            data-deploy-section="resources"
            tabIndex={-1}
            hidden={section !== "resources"}
            className="space-y-4 outline-none"
          >
            <div>
              <h2 className="text-sm font-medium">Production resources</h2>
              <p className="mt-1 text-xs text-silver-600">
                The server, database and files used by your deployed app.
              </p>
            </div>
            <div className="space-y-5">
              {status.backendPublished && (
                <div className="rounded-xl border border-silver-200 bg-space-surface p-4">
                  <h3 className="text-xs font-medium">Server</h3>
                  <p className="my-2 text-xs leading-relaxed text-silver-600">
                    Apply updated secrets to the live server or inspect recent
                    runtime output.
                  </p>
                  <div className="mb-2">
                    <button
                      type="button"
                      onClick={() => openTool("secrets")}
                      className={deployButtonClass}
                    >
                      Manage secrets
                    </button>
                  </div>
                  <RefreshSecrets
                    projectId={projectId}
                    blocked={blocked || identityDirty || !status.live}
                  />
                  <ServerLogs projectId={projectId} />
                </div>
              )}
              {status.databasePublished && (
                <div className="rounded-xl border border-silver-200 bg-space-surface p-4">
                  <h3 className="text-xs font-medium">Database</h3>
                  <p className="my-2 text-xs leading-relaxed text-silver-600">
                    Production data is separate from preview data. Restoring a
                    deployed version does not restore this data.
                  </p>
                  <ExportData
                    projectId={projectId}
                    blocked={!!status.suspended}
                  />
                </div>
              )}
              {status.storagePublished && (
                <div className="rounded-xl border border-silver-200 bg-space-surface p-4">
                  <h3 className="text-xs font-medium">File storage</h3>
                  <p className="my-2 text-xs text-silver-600">
                    Inspect files uploaded to the deployed app.
                  </p>
                  <button
                    type="button"
                    onClick={() => openTool("storage", undefined, true)}
                    className={deployButtonClass}
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
          </div>
        )}
      </ToolPaneContent>
    </div>
  );
}
