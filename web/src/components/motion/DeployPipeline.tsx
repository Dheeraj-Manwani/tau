import { CheckIcon, CircleAlertIcon, XIcon } from "lucide-react";

import type { DeployStep } from "@/src/features/project/deployPresentation";
import { pipelineLabels } from "@/src/features/project/deployPresentation";
import { cn } from "@/src/lib/utils";

const stateWords: Record<DeployStep["state"], string> = {
  done: "complete",
  active: "in progress",
  pending: "waiting",
  failed: "failed",
  review: "needs your decision",
};

/**
 * The deploy track (boards/Workspace-Deployments.dc.html, Deploy-Tabs.dc.html):
 * QUEUE · CHECK · BUILD · UPLOAD · SERVER · VERIFY · LIVE, or four nodes for
 * a static site. Done nodes hold a blue check and fill the line after them;
 * the active node's ring turns and a blue segment travels the line it is
 * about to fill; a failed node is red and a review node orange. Node state is
 * the server's `DeploymentStatus` (deploymentSteps), never a timer.
 *
 * A failure whose stage nobody saw has no track to draw, so it renders as one
 * stopped row instead of inventing where it stopped.
 */
export function DeployPipeline({
  steps,
  console: lines,
  showDetail = true,
  className,
}: {
  steps: DeployStep[];
  /** The live console under an active track: earlier lines, then the current one. */
  console?: { done: string[]; current: string } | null;
  /** Say why a failed or waiting node stopped. Off when an alert below says it. */
  showDetail?: boolean;
  className?: string;
}) {
  if (steps.length === 1) {
    const step = steps[0];
    return (
      <div className={cn("flex items-start gap-3 px-4 py-4 sm:px-5.5", className)}>
        <PipelineNode state={step.state} />
        <div className="min-w-0 pt-1">
          <p className="text-[13px] font-semibold text-silver-900">{step.label}</p>
          <p className="mt-1 text-xs leading-relaxed text-silver-500">{step.detail}</p>
        </div>
      </div>
    );
  }

  const current = steps.find((s) => s.state !== "done" && s.state !== "pending");

  return (
    <div className={cn("flex flex-col gap-4 px-4 pt-4 pb-4.5 sm:px-5.5", className)}>
      <ol aria-label="Deployment stages" className="flex items-start pt-1.5">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const isCurrent = step === current;
          const lineState =
            step.state === "done" ? "done" : step.state === "active" ? "active" : "pending";
          return (
            <li key={step.id} className={cn("relative min-w-0", last ? "w-[72px] flex-none" : "flex-1")}>
              <div className="flex h-[30px] items-center">
                <PipelineNode state={step.state} />
                {!last && (
                  <span aria-hidden="true" className="pipeline-line" data-state={lineState}>
                    <i />
                  </span>
                )}
              </div>
              <p
                className={cn(
                  "mt-2.5 font-mono text-[11px] leading-none tracking-[0.1em] whitespace-nowrap uppercase",
                  step.state === "pending" ? "text-silver-500" : "text-silver-600",
                  step.state === "failed" && "text-red-400",
                  step.state === "review" && "text-orange-400",
                  // Phones show only the stage that matters; the rest are read out.
                  !isCurrent && "max-sm:sr-only",
                )}
              >
                {pipelineLabels[step.id] ?? step.label}
                <span className="sr-only">: {stateWords[step.state]}</span>
              </p>
            </li>
          );
        })}
      </ol>

      {showDetail && current && current.state !== "active" && (
        <p className="text-xs leading-relaxed text-silver-500">{current.detail}</p>
      )}

      {lines && (
        <div className="overflow-hidden rounded-md border border-line bg-[#070708] px-3.5 py-3 font-mono text-xs leading-[1.9] text-silver-500">
          {lines.done.map((line) => (
            <div key={line} className="truncate opacity-55">
              &gt; {line}
            </div>
          ))}
          <div className="stream-caret--inline truncate text-silver-900" aria-live="polite">
            <b className="mr-2 font-normal text-blue-500">&gt;</b>
            {lines.current}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineNode({ state }: { state: DeployStep["state"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-200",
        state === "pending" && "border-line-strong bg-space-overlay",
        state === "active" && "border-blue-500 bg-space-overlay",
        state === "done" && "border-blue-500/34 bg-blue-500/12 text-blue-500",
        state === "failed" && "border-red-400/32 bg-red-400/10 text-red-400",
        state === "review" && "border-orange-400/34 bg-orange-400/11 text-orange-400",
      )}
    >
      {state === "pending" && <i className="size-[5px] rounded-full bg-[#3a3a40]" />}
      {state === "active" && (
        <svg viewBox="0 0 24 24" className="pipeline-spin absolute -inset-px size-7 text-blue-500" fill="none">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {state === "done" && <CheckIcon className="size-3.5" strokeWidth={2.2} />}
      {state === "failed" && <XIcon className="size-3.5" strokeWidth={2.2} />}
      {state === "review" && <CircleAlertIcon className="size-3.5" strokeWidth={2} />}
    </span>
  );
}
