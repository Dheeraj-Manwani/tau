import { useEffect, useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, ExternalLinkIcon, RocketIcon, XIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Alert } from "@/src/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import {
  bare,
  deployedAgo,
  errorMessage,
  formatBytes,
  historyLabel,
  useRollbackDeploy,
  type DeploymentSummary,
  type DeployStatus,
} from "./deploy";
import {
  deploymentDuration,
  deploymentIsActive,
  deploymentSteps,
  newestDeployments,
  pipelineLine,
} from "./deployPresentation";
import { DeployedUrlActions, DeployFailureNotice } from "./DeployOperations";
import { rememberDeployStage, rememberedDeployStage } from "./deployStageMemory";
import { DeployPipeline } from "@/src/components/motion/DeployPipeline";
import { TauMark } from "@/src/components/motion/TauMark";
import { useNow } from "@/src/hooks/useNow";

function DeploymentCard({ title, subtitle, state, latest, defaultOpen = false, openUrl, children }: {
  title: string;
  subtitle: ReactNode;
  state: "live" | "done" | "active" | "failed" | "review";
  latest?: boolean;
  defaultOpen?: boolean;
  /** The live app's address: an open-link sits beside the chevron, outside the toggle button. */
  openUrl?: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const reducedMotion = useReducedMotion();
  return (
    <li className={cn("relative overflow-hidden rounded-lg border bg-space-surface", state === "active" ? "border-blue-500/34" : "border-line")}>
      {openUrl && (
        <Button variant="ghost" size="icon" asChild className="absolute top-3 right-11 z-10 text-silver-600 hover:text-green-400 sm:top-[18px] sm:right-[46px]">
          <a href={openUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${bare(openUrl)}`} title={bare(openUrl)}>
            <ExternalLinkIcon />
          </a>
        </Button>
      )}
      <button
        type="button"
        id={`${id}-toggle`}
        aria-expanded={open}
        aria-controls={`${id}-details`}
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-space-raised/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 sm:items-center sm:px-5.5"
      >
        {state === "active" ? (
          // A deploy in flight is the card's one mover: the raining mark.
          <TauMark size={36} className="mt-0.5 sm:mt-0" />
        ) : (
          <span aria-hidden="true" className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border sm:mt-0",
            state === "live" ? "border-green-400/32 bg-green-400/11 text-green-400"
              : state === "done" ? "border-line-strong bg-space-overlay text-silver-600"
                : state === "review" ? "border-orange-400/34 bg-orange-400/11 text-orange-400"
                  : "border-red-400/32 bg-red-400/10 text-red-400",
          )}>
            {state === "failed" ? <XIcon className="size-4" />
              : state === "review" ? <CircleAlertIcon className="size-4" />
                : state === "live" ? <RocketIcon className="size-4" /> : <CheckIcon className="size-4" />}
          </span>
        )}
        <span className={cn("min-w-0 flex-1", openUrl && "pr-10")}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-silver-900">{title}</span>
            {latest && <Badge>Latest</Badge>}
            {state === "active" && <Badge tone="blue">Deploying</Badge>}
            {state === "live" && <Badge tone="green" dot>Live</Badge>}
            {state === "failed" && <Badge tone="red">Failed</Badge>}
            {state === "review" && <Badge tone="orange">Needs review</Badge>}
          </span>
          <span className="mt-1 block font-mono text-xs leading-relaxed text-silver-500">{subtitle}</span>
        </span>
        <ChevronDownIcon aria-hidden="true" className={cn("mt-1 size-4 shrink-0 text-silver-600 transition-transform duration-200 motion-reduce:transition-none sm:mt-0", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            id={`${id}-details`}
            role="region"
            aria-labelledby={`${id}-toggle`}
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export function DeploymentList({ projectId, status, blocked, requesting, confirmDisabled, onConfirmSchema }: {
  projectId: string;
  status: DeployStatus;
  blocked: boolean;
  requesting: boolean;
  confirmDisabled: boolean;
  onConfirmSchema: () => void;
}) {
  const rollback = useRollbackDeploy(projectId);
  const [restoring, setRestoring] = useState<string | null>(null);
  const deployments = newestDeployments(status);
  const target = deployments.find((deployment) => deployment.id === restoring && deployment.canRollback);
  const awaitingWorker = (status.inProgress || requesting) && !deployments.some(deploymentIsActive);
  const unrecordedFailure = !awaitingWorker && !status.inProgress && !!status.lastFailure && deployments[0]?.status !== "FAILED";
  const failureNotice = status.lastFailure && (
    <DeployFailureNotice projectId={projectId} failure={status.lastFailure} blocked={blocked} confirmDisabled={confirmDisabled} onConfirmSchema={onConfirmSchema} />
  );
  const failureDetails = status.lastFailure && (
    <>
      <div className="px-4 py-4 sm:px-5.5">{failureNotice}</div>
      {status.lastFailure.buildLog && (
        <details className="px-4 pb-4 sm:px-5.5">
          <summary className="cursor-pointer text-[13px] text-blue-500 hover:text-blue-hi">View failed build output</summary>
          <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-line bg-space-void px-4 py-3.5 font-mono text-[12.5px] leading-[1.7] break-words whitespace-pre-wrap text-silver-600">{status.lastFailure.buildLog}</pre>
        </details>
      )}
    </>
  );

  // The address belongs where the deploy is watched, not only on Overview.
  const liveUrl = status.suspended ? null : (status.primaryUrl ?? status.url);

  const anyActive = deployments.some(deploymentIsActive);
  // Elapsed time on an active card counts up by the second.
  const now = useNow(anyActive);
  // Remember where each watched attempt got to: if it fails, its track stops
  // there instead of collapsing to a single "stopped" row.
  useEffect(() => {
    for (const deployment of deployments) {
      if (deploymentIsActive(deployment)) rememberDeployStage(deployment.id, deployment.status);
    }
  }, [deployments]);

  const stateFor = (deployment: DeploymentSummary, review: boolean) =>
    review ? "review" as const : deployment.status === "FAILED" ? "failed" as const
      : deploymentIsActive(deployment) ? "active" as const : deployment.isLive ? "live" as const : "done" as const;

  return (
    <>
      <ul aria-label="Deployments, newest first" className="space-y-3">
        {awaitingWorker && (
          <DeploymentCard key="request" title="New deployment" subtitle="Waiting to start" state="active" latest defaultOpen>
            <DeployPipeline steps={[{ id: "request", label: "Waiting to start", detail: requesting ? "Sending your deploy request…" : "Waiting for the deployment worker to report the first stage.", state: "active" }]} />
          </DeploymentCard>
        )}
        {unrecordedFailure && (
          <DeploymentCard key="unrecorded-failure" title="Latest deployment" subtitle="Deployment stopped" state={status.lastFailure?.schemaChanges?.length && !status.lastFailure.changedSince ? "review" : "failed"} latest defaultOpen>
            {failureDetails}
          </DeploymentCard>
        )}
        {deployments.map((deployment, index) => {
          const latest = index === 0 && !awaitingWorker && !unrecordedFailure;
          const failure = latest && deployment.status === "FAILED" && !status.inProgress ? status.lastFailure : null;
          const review = !!failure?.schemaChanges?.length && !failure.changedSince;
          const steps = deploymentSteps(
            deployment,
            review,
            deployment.status === "FAILED" ? rememberedDeployStage(deployment.id) : null,
          );
          const completed = steps.filter((step) => step.state === "done").length;
          const active = deploymentIsActive(deployment);
          const duration = deploymentDuration(deployment, now);
          const openUrl = deployment.isLive && !active ? liveUrl : null;
          return (
            <DeploymentCard
              key={deployment.id}
              title={`Deployment ${deployment.id.slice(0, 8)}`}
              subtitle={<>{review ? "Needs database review" : deployment.isLive ? "Deployed" : historyLabel(deployment)} · <time dateTime={deployment.createdAt} title={new Date(deployment.createdAt).toLocaleString()}>{deployedAgo(deployment.createdAt)}</time>{duration && ` · ${duration}${active ? " elapsed" : ""}`}</>}
              state={stateFor(deployment, review)}
              latest={latest}
              defaultOpen={latest && (active || !!failure)}
              openUrl={openUrl}
            >
              <div aria-live={latest ? "polite" : "off"} role="status" className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 text-[13px] text-silver-600 sm:px-5.5">
                <span className={cn(openUrl && "font-medium text-green-400")}>{review ? "Review required" : deployment.status === "FAILED" ? "Deployment stopped" : active ? "Deployment in progress" : openUrl ? "Your app is live" : "Deployment complete"}</span>
                {deployment.status !== "FAILED" && <span className="font-mono text-xs tabular-nums text-silver-500">{completed} / {steps.length} complete</span>}
              </div>
              <DeployPipeline
                steps={steps}
                showDetail={!failure}
                console={
                  latest && active
                    ? {
                        done: [`request accepted · ${deployment.target === "FULLSTACK" ? "server & frontend" : "static site"}`],
                        current: pipelineLine(deployment),
                      }
                    : null
                }
              />
              {latest && active && (
                <p className="px-4 pb-4 text-xs leading-relaxed text-silver-500 sm:px-5.5">
                  {status.live ? "Your previous version stays live while this deployment is prepared." : "Your site will go live when this deployment succeeds."} Deployment continues if you leave this tab.
                </p>
              )}
              {openUrl && (
                <div className="mx-4 mb-4 flex flex-wrap items-center gap-3 rounded-md border border-green-400/24 bg-green-400/6 px-4 py-3 sm:mx-5.5">
                  <a
                    href={openUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 flex-1 basis-48 font-mono text-sm break-all text-silver-900 underline-offset-3 hover:underline"
                  >
                    {bare(openUrl)}
                  </a>
                  <div className="flex flex-wrap gap-2.5">
                    <DeployedUrlActions url={openUrl} />
                  </div>
                </div>
              )}
              {failure && failureDetails}
              {deployment.error && deployment.status !== "FAILED" && <div className="px-4 pb-4 sm:px-5.5"><Alert tone="warning">{deployment.error}</Alert></div>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5.5">
                <div className="space-y-1 font-mono text-[11.5px] text-silver-500">
                  <p>{deployment.target === "FULLSTACK" ? "Server & frontend" : deployment.target === "STATIC" ? "Static site" : "Deployment"}{deployment.fileCount > 0 && ` · ${deployment.fileCount} files · ${formatBytes(deployment.sizeBytes)}`}</p>
                  <p>Requested {new Date(deployment.createdAt).toLocaleString()}</p>
                  {deployment.completedAt && <p>Completed {new Date(deployment.completedAt).toLocaleString()}</p>}
                  {!deployment.isLive && !deployment.canRollback && deployment.status === "SUPERSEDED" && <p>This version's files are no longer available to restore.</p>}
                </div>
                {deployment.canRollback && (
                  <Button variant="secondary" size="sm" disabled={blocked || rollback.isPending} onClick={() => setRestoring(deployment.id)}>
                    {status.live ? "Roll back" : "Restore"}
                  </Button>
                )}
              </div>
            </DeploymentCard>
          );
        })}
      </ul>
      <AlertDialog open={!!target} onOpenChange={(open) => !open && setRestoring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore this version?</AlertDialogTitle>
            <AlertDialogDescription>
              The public app switches to version <span className="font-mono text-silver-900">{target?.id.slice(0, 8)}</span>.
              Your editor files and production database data are not restored.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rollback.isError && <Alert tone="danger">{errorMessage(rollback.error, "Couldn't restore this version.")}</Alert>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollback.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={blocked || rollback.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (target) rollback.mutate(target.id, { onSuccess: () => setRestoring(null) });
              }}
            >
              {rollback.isPending ? "Restoring…" : "Restore this version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
