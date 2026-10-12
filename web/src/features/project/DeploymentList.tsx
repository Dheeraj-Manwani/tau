import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, LoaderCircleIcon, RocketIcon, XIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import {
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
} from "./deployPresentation";
import { DeployFailureNotice, deployButtonClass, deployPrimaryClass } from "./DeployOperations";
import { DeploymentTimeline } from "./DeploymentTimeline";

function DeploymentCard({ title, subtitle, state, latest, defaultOpen = false, children }: {
  title: string;
  subtitle: ReactNode;
  state: "live" | "done" | "active" | "failed" | "review";
  latest?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const reducedMotion = useReducedMotion();
  return (
    <li className={cn("overflow-hidden rounded-xl border bg-space-surface", state === "active" ? "border-blue-400/30" : "border-silver-200")}>
      <button
        type="button"
        id={`${id}-toggle`}
        aria-expanded={open}
        aria-controls={`${id}-details`}
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-space-overlay/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:items-center sm:px-5"
      >
        <span aria-hidden="true" className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border sm:mt-0",
          state === "live" || state === "done" ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-400"
            : state === "active" ? "border-blue-400/20 bg-blue-400/5 text-blue-400"
              : state === "review" ? "border-amber-400/20 bg-amber-400/5 text-amber-300"
                : "border-red-400/20 bg-red-400/5 text-red-300",
        )}>
          {state === "active" ? <LoaderCircleIcon className="size-4 motion-safe:animate-spin" />
            : state === "failed" ? <XIcon className="size-4" />
              : state === "review" ? <CircleAlertIcon className="size-4" />
                : state === "live" ? <RocketIcon className="size-4" /> : <CheckIcon className="size-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-silver-900">{title}</span>
            {latest && <span className="rounded bg-space-overlay px-1.5 py-0.5 text-[10px] text-silver-600">Latest</span>}
            {state === "live" && <span className="text-[10px] text-emerald-400">Live</span>}
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-silver-600">{subtitle}</span>
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
            <div className="border-t border-silver-200">{children}</div>
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
      <div className="px-4 py-4 sm:px-5">{failureNotice}</div>
      {status.lastFailure.buildLog && (
        <details className="px-4 pb-4 sm:px-5">
          <summary className="cursor-pointer text-xs text-blue-500">View failed build output</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-space-void p-3 font-mono text-xs text-silver-600">{status.lastFailure.buildLog}</pre>
        </details>
      )}
    </>
  );

  const stateFor = (deployment: DeploymentSummary, review: boolean) =>
    review ? "review" as const : deployment.status === "FAILED" ? "failed" as const
      : deploymentIsActive(deployment) ? "active" as const : deployment.isLive ? "live" as const : "done" as const;

  return (
    <>
      <ul aria-label="Deployments, newest first" className="space-y-3">
        {awaitingWorker && (
          <DeploymentCard key="request" title="New deployment" subtitle="Waiting to start" state="active" latest defaultOpen>
            <DeploymentTimeline steps={[{ id: "request", label: "Waiting to start", detail: requesting ? "Sending your deploy request…" : "Waiting for the deployment worker to report the first stage.", state: "active" }]} />
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
          const steps = deploymentSteps(deployment, review);
          const completed = steps.filter((step) => step.state === "done").length;
          const active = deploymentIsActive(deployment);
          const duration = deploymentDuration(deployment);
          return (
            <DeploymentCard
              key={deployment.id}
              title={`Deployment ${deployment.id.slice(0, 8)}`}
              subtitle={<>{review ? "Needs database review" : deployment.isLive ? "Deployed" : historyLabel(deployment)} · <time dateTime={deployment.createdAt} title={new Date(deployment.createdAt).toLocaleString()}>{deployedAgo(deployment.createdAt)}</time>{duration && ` · ${duration}${active ? " elapsed" : ""}`}</>}
              state={stateFor(deployment, review)}
              latest={latest}
              defaultOpen={latest && (active || !!failure)}
            >
              <div aria-live={active ? "polite" : "off"} role="status" className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 text-[11px] text-silver-600 sm:px-5">
                <span>{review ? "Review required" : deployment.status === "FAILED" ? "Deployment stopped" : active ? "Deployment in progress" : "Deployment complete"}</span>
                {deployment.status !== "FAILED" && <span className="font-mono tabular-nums">{completed} / {steps.length} complete</span>}
              </div>
              <DeploymentTimeline steps={steps} stagger={latest} />
              {latest && active && (
                <p className="px-4 pb-4 text-[11px] leading-relaxed text-silver-600 sm:px-5">
                  {status.live ? "Your previous version stays live while this deployment is prepared." : "Your site will go live when this deployment succeeds."} Deployment continues if you leave this tab.
                </p>
              )}
              {failure && failureDetails}
              {deployment.error && deployment.status !== "FAILED" && <p className="px-4 pb-4 text-xs text-amber-200 sm:px-5">{deployment.error}</p>}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-silver-200 px-4 py-3 sm:px-5">
                <div className="space-y-1 text-[11px] text-silver-600">
                  <p>{deployment.target === "FULLSTACK" ? "Server & frontend" : deployment.target === "STATIC" ? "Static site" : "Deployment"}{deployment.fileCount > 0 && ` · ${deployment.fileCount} files · ${formatBytes(deployment.sizeBytes)}`}</p>
                  <p>Requested {new Date(deployment.createdAt).toLocaleString()}</p>
                  {deployment.completedAt && <p>Completed {new Date(deployment.completedAt).toLocaleString()}</p>}
                  {!deployment.isLive && !deployment.canRollback && deployment.status === "SUPERSEDED" && <p>This version's files are no longer available to restore.</p>}
                </div>
                {deployment.canRollback && (
                  <button type="button" disabled={blocked || rollback.isPending} onClick={() => setRestoring(deployment.id)} className={deployButtonClass}>
                    {status.live ? "Roll back" : "Restore"}
                  </button>
                )}
              </div>
            </DeploymentCard>
          );
        })}
      </ul>
      {target && (
        <div className="mt-3 rounded-xl border border-silver-200 bg-space-surface p-4">
          <p className="text-sm font-medium">Restore version {target.id.slice(0, 8)}?</p>
          <p className="mt-2 text-xs leading-relaxed text-silver-600">The public app switches to this available version. Your editor files and production database data are not restored.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={rollback.isPending} onClick={() => setRestoring(null)} className={deployButtonClass}>Cancel</button>
            <button type="button" disabled={blocked || rollback.isPending} onClick={() => rollback.mutate(target.id, { onSuccess: () => setRestoring(null) })} className={cn(deployButtonClass, deployPrimaryClass)}>{rollback.isPending ? "Restoring…" : "Restore this version"}</button>
          </div>
          {rollback.isError && <p role="alert" className="mt-2 text-xs text-red-300">{errorMessage(rollback.error, "Couldn't restore this version.")}</p>}
        </div>
      )}
    </>
  );
}
