import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  CopyIcon,
  ArrowRightIcon,
  LockIcon,
  RocketIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { useIsMutating } from "@tanstack/react-query";
import { cn } from "@/src/lib/utils";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardHeader, CardRow, MetaLine } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { ToolPaneContent } from "./ToolPaneContent";
import { useProjectStore } from "@/src/stores/useProjectStore";
import { useBalance } from "@/src/features/billing/api";
import { AppLogo } from "./AppLogo";
import { DeploymentList } from "./DeploymentList";
import { AddressPicker, BuyCredits, IdentitySection } from "./IdentitySection";
import {
  bare,
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
  DeployedUrlActions,
} from "./DeployOperations";

/** All deploying actions live here; the topbar only summarizes and navigates.
 *  boards/Workspace-Deploy.dc.html, Workspace-Deployments.dc.html, Deploy-Tabs.dc.html. */
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
        <ToolPaneContent className="flex flex-col gap-[22px]" role="status">
          <PageHeader title="Deploy" description="Make your app live and manage every deployment." />
          {query.isError ? (
            <Alert
              tone="danger"
              action={
                <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
                  Try again
                </Button>
              }
            >
              Couldn&apos;t load deployment status.
            </Alert>
          ) : (
            <Card className="flex flex-col gap-3 p-5.5" aria-label="Loading deployment status">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-5 w-72" />
              <Skeleton className="h-3 w-56" />
            </Card>
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
  // The page's one primary while there is something to ship; a redeploy of an
  // up-to-date site is only a secondary.
  const deployIsPrimary =
    !status.live || !!status.lastFailure || status.unpublishedChanges > 0;

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
  const statusText =
    presentation.label === "Deployed"
      ? "Live"
      : presentation.label === "Deploy"
        ? "Not deployed"
        : presentation.label;
  return (
    <div
      ref={root}
      className="h-full overflow-y-auto text-silver-900 [scrollbar-gutter:stable]"
    >
      <ToolPaneContent className="flex flex-col gap-[22px]">
        <PageHeader
          title="Deploy"
          description="Make your app live and manage every deployment."
          actions={
            <>
              {/* While deploying, the button's own "Deploying…" says it. */}
              {!busy && (
                <span className="flex items-center gap-2 text-[13px] text-silver-600">
                  {/* The page's one loop: a live site breathes (boards/Main.dc.html). */}
                  <span className={cn("size-2 rounded-full", deployToneClass[presentation.tone], presentation.tone === "live" && "status-pulse")} aria-hidden="true" />
                  {statusText}
                </span>
              )}
              {review ? (
                <Button variant="secondary" onClick={() => openTool("deploy", "deployments")}>
                  Review database changes
                </Button>
              ) : (
                <Button
                  variant={deployIsPrimary ? "primary" : "secondary"}
                  disabled={cannotDeploy && !busy}
                  loading={busy}
                  onClick={() => start()}
                >
                  {!busy && <RocketIcon />}
                  {label}
                  {feeDue && !busy && (
                    <span className="font-mono text-[11px] font-medium opacity-80">
                      · {status.publishFee.credits} credits
                    </span>
                  )}
                </Button>
              )}
            </>
          }
        />
        {query.isError && (
          <DeployNotice
            tone="error"
            action={
              <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
                Retry
              </Button>
            }
          >
            Couldn&apos;t refresh status. These are the last known details. Last successful check:{" "}
            {new Date(query.dataUpdatedAt).toLocaleTimeString()}.
          </DeployNotice>
        )}
        {status.suspended && <DeployNotice tone="error">{presentation.detail}</DeployNotice>}
        {status.serverWarning && <DeployNotice>{status.serverWarning}</DeployNotice>}
        {deploy.isError && (
          <DeployNotice tone="error">{errorMessage(deploy.error, "Couldn't start deploying.")}</DeployNotice>
        )}
        {identityDirty && (
          <DeployNotice
            tone="info"
            action={
              <Button variant="secondary" size="sm" onClick={() => openTool("deploy", "identity")}>
                Name & logo
              </Button>
            }
          >
            You have unsaved appearance changes. Save them before deploying.
          </DeployNotice>
        )}

        <Tabs value={section} onValueChange={(id) => openTool("deploy", id as DeploySection)}>
          <TabsList aria-label="Deployment settings">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.label}
                {tab.id === "identity" && identityDirty && (
                  <span aria-label="Unsaved changes" className="size-1.5 rounded-full bg-orange-400" />
                )}
                {tab.id === "deployments" && busy && (
                  <span role="img" aria-label="Deploying" className="status-blink size-1.5 rounded-full bg-yellow-400" />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Panels stay mounted (forceMount + hidden): Name & logo keeps its
              unsaved draft while you look at another tab. */}
          <TabsContent
            value="overview"
            forceMount
            hidden={section !== "overview"}
            data-deploy-section="overview"
            className="mt-[22px] flex flex-col gap-[22px]"
          >
            <Card className="flex flex-wrap items-center gap-3.5 px-5.5 py-5">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line-strong bg-space-void">
                <AppLogo projectId={projectId} icon={identity.data?.icon} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{identityName}</p>
                <p className="text-[12.5px] text-silver-500">App name, description and logo</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => openTool("deploy", "identity")}>
                Edit name & logo
                <ArrowRightIcon />
              </Button>
            </Card>

            <Card aria-label="Production deployment" className="flex flex-col gap-4 p-5.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 tabIndex={-1} className="text-[15px] font-semibold outline-none">
                  {status.live ? "Production" : status.url ? "Your reserved address" : "Your first deployment"}
                </h2>
                {status.live && !status.suspended && (
                  <Badge tone="green" dot>
                    Live
                  </Badge>
                )}
              </div>
              <div>
                {url ? (
                  <a
                    href={status.live ? url : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[15px] break-all text-silver-900 underline-offset-3 hover:underline"
                  >
                    {bare(url)}
                  </a>
                ) : (
                  <p className="text-sm">Choose your app&apos;s public address</p>
                )}
                {status.live ? (
                  <MetaLine
                    className="mt-1.5"
                    items={[
                      `Deployed ${deployedAgo(status.live.completedAt ?? status.live.createdAt)}`,
                      `Version ${status.live.id.slice(0, 8)}`,
                      status.live.fileCount > 0 && `${status.live.fileCount} files`,
                      status.live.fileCount > 0 && formatBytes(status.live.sizeBytes),
                    ]}
                  />
                ) : (
                  <p className="mt-1.5 text-[13px] text-silver-500">
                    {status.url
                      ? "This address is reserved. There is no live version."
                      : "Your preview stays separate from the deployed app."}
                  </p>
                )}
              </div>
              {choosing && (
                <AddressPicker
                  projectId={projectId}
                  suggested={status.suggestedName!}
                  domain={status.domain}
                  value={address}
                  onChange={setAddress}
                />
              )}
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "text-[13px] leading-relaxed",
                  presentation.tone === "warning" ? "text-orange-400" : "text-silver-600",
                )}
              >
                {presentation.detail}
              </p>
              {status.live?.error && status.lastFailure && <Alert tone="warning">{status.live.error}</Alert>}
              {url && status.live && !status.suspended && (
                <div className="flex flex-wrap gap-2.5">
                  <DeployedUrlActions url={url} />
                </div>
              )}
              <div className="flex flex-col gap-2 border-t border-line pt-4 text-xs leading-relaxed text-silver-500">
                <p>
                  {feeDue
                    ? `First successful deployment: ${status.publishFee.credits} credits. Failed attempts are not charged. Future updates are free.`
                    : status.live
                      ? "Deploying updates is free. Your current version stays live while the new one is prepared."
                      : "Deploying updates is free. Your app goes online when the deploy succeeds."}
                </p>
                {generating && <p>Wait for Tau to finish editing before deploying this project.</p>}
                {feeDue && !balance.data && (
                  <p>
                    {balance.isError ? "Couldn't check your credit balance." : "Checking your credit balance…"}
                    {balance.isError && (
                      <Button variant="link" className="ml-1 text-xs" onClick={() => void balance.refetch()}>
                        Retry balance check
                      </Button>
                    )}
                  </p>
                )}
                {insufficient && (
                  <BuyCredits>
                    First deployment needs {status.publishFee.credits} credits. You have{" "}
                    {balance.data!.credits.available}.
                  </BuyCredits>
                )}
                <DeployBadge />
              </div>
            </Card>

            {(busy || status.lastFailure) && (
              <Button variant="secondary" className="self-start" onClick={() => openTool("deploy", "deployments")}>
                {busy ? "View deployment progress" : review ? "Review database changes" : "View last deployment"}
                <ArrowRightIcon />
              </Button>
            )}

            {url && (
              <Card>
                <CardHeader title="Address & domains" description="Where people can reach your app." className="pb-0" />
                <CardRow
                  label="Tau address"
                  detail={
                    <>
                      <span className="font-mono text-blue-500 break-all">{status.url ? bare(status.url) : ""}</span>
                      <span className="block text-silver-500">Stays reserved for this project.</span>
                    </>
                  }
                  action={
                    status.url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Copy address"
                        onClick={() => {
                          void navigator.clipboard.writeText(status.url!).then(
                            () => toast.success("Address copied"),
                            () => toast.error("Couldn't copy"),
                          );
                        }}
                      >
                        <CopyIcon />
                      </Button>
                    )
                  }
                />
                {status.primaryUrl && status.primaryUrl !== status.url && (
                  <CardRow
                    label="Primary address"
                    detail={<span className="font-mono break-all">{bare(status.primaryUrl)}</span>}
                  />
                )}
                <CardRow
                  label="Custom domains"
                  detail="Use a domain you own."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => openTool("domains")}>
                      {!status.live && <LockIcon />}
                      Manage custom domains
                    </Button>
                  }
                />
              </Card>
            )}

            {(status.live || status.suspended) && (
              <Card>
                <CardHeader title="Site access" className="pb-0" />
                <div className="px-5.5 pt-3 pb-5">
                  {status.suspended ? (
                    <p className="text-[13px] text-silver-500">
                      Deployment actions are unavailable while this site is suspended.
                    </p>
                  ) : (
                    <TakeOffline projectId={projectId} blocked={blocked || identityDirty} />
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent
            value="identity"
            forceMount
            hidden={section !== "identity"}
            data-deploy-section="identity"
            className="mt-[22px]"
          >
            <Card className="p-5.5">
              <IdentitySection
                projectId={projectId}
                blocked={busy || generating || !!status.suspended}
                onDirtyChange={setIdentityDirty}
                url={url}
              />
            </Card>
          </TabsContent>

          {available?.deployments && (
            <TabsContent
              value="deployments"
              forceMount
              hidden={section !== "deployments"}
              data-deploy-section="deployments"
              className="mt-[22px] flex flex-col gap-4"
            >
              <DeploymentList
                projectId={projectId}
                status={status}
                blocked={blocked || identityDirty}
                requesting={deploy.isPending}
                confirmDisabled={cannotDeploy}
                onConfirmSchema={() => start(true)}
              />
            </TabsContent>
          )}

          {available?.resources && (
            <TabsContent
              value="resources"
              forceMount
              hidden={section !== "resources"}
              data-deploy-section="resources"
              className="mt-[22px]"
            >
              <Card>
                <CardHeader
                  title="Production resources"
                  description="The server, database and files used by your deployed app."
                />
                {status.backendPublished && (
                  <ResourceRow
                    title="Server"
                    text="Apply updated secrets to the live server or inspect recent runtime output."
                  >
                    <Button variant="secondary" size="sm" onClick={() => openTool("secrets")}>
                      Manage secrets
                    </Button>
                    <RefreshSecrets projectId={projectId} blocked={blocked || identityDirty || !status.live} />
                    <ServerLogs projectId={projectId} />
                  </ResourceRow>
                )}
                {status.databasePublished && (
                  <ResourceRow
                    title="Database"
                    text="Production data is separate from preview data. Restoring a deployed version does not restore this data."
                  >
                    <ExportData projectId={projectId} blocked={!!status.suspended} />
                  </ResourceRow>
                )}
                {status.storagePublished && (
                  <ResourceRow title="File storage" text="Inspect files uploaded to the deployed app.">
                    <Button variant="secondary" size="sm" onClick={() => openTool("storage", undefined, true)}>
                      Open production storage
                    </Button>
                  </ResourceRow>
                )}
                {!status.backendPublished && !status.databasePublished && !status.storagePublished && (
                  <p className="border-t border-line px-5.5 py-4 text-[13px] text-silver-500">
                    No production server, database or storage has been reported for this project.
                  </p>
                )}
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </ToolPaneContent>
    </div>
  );
}

/** One resource in the Resources card, split from the next by a hairline. */
function ResourceRow({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mx-5.5 flex flex-col gap-3 border-t border-line py-4.5">
      <div>
        <h3 className="text-[13.5px] font-semibold">{title}</h3>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-silver-500">{text}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
