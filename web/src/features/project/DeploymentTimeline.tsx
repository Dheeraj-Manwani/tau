import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, CircleAlertIcon, LoaderCircleIcon, XIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import type { DeployStep } from "./deployPresentation";

const stepLabels = {
  done: "Complete",
  active: "In progress",
  pending: "Waiting",
  failed: "Failed",
  review: "Needs your decision",
};

export function DeploymentTimeline({ steps, stagger = true }: { steps: DeployStep[]; stagger?: boolean }) {
  const reducedMotion = useReducedMotion();
  return (
    <ol aria-label="Deployment stages" className="px-4 py-2 sm:px-5">
      {steps.map((step, index) => (
        <motion.li
          key={step.id}
          layout={!reducedMotion}
          initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.22, delay: reducedMotion || !stagger ? 0 : index * 0.055 }}
          className="relative flex min-h-12 gap-3 py-3"
        >
          {index < steps.length - 1 && (
            <span aria-hidden="true" className="absolute top-8 bottom-[-0.75rem] left-[9px] w-px overflow-hidden bg-silver-200">
              <motion.span
                initial={{ scaleY: reducedMotion ? 1 : 0 }}
                animate={{ scaleY: step.state === "done" ? 1 : 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion || !stagger ? 0 : index * 0.055 + 0.15 }}
                className="absolute inset-0 origin-top bg-emerald-400/40"
              />
            </span>
          )}
          <span
            aria-hidden="true"
            className={cn(
              "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border bg-space-surface",
              step.state === "done" && "border-emerald-400/30 text-emerald-400",
              step.state === "active" && "border-blue-400/50 text-blue-400",
              step.state === "failed" && "border-red-400/30 text-red-300",
              step.state === "review" && "border-amber-400/30 text-amber-300",
              step.state === "pending" && "border-silver-200 text-silver-400",
            )}
          >
            {step.state === "active" && (
              <span className="absolute -inset-1 rounded-full border border-blue-400/20 motion-safe:animate-ping" />
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={step.state}
                initial={reducedMotion ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reducedMotion ? 1 : 0.6 }}
                transition={{ duration: reducedMotion ? 0 : 0.16 }}
                className="flex items-center justify-center"
              >
                {step.state === "done" ? <CheckIcon className="size-3" />
                  : step.state === "active" ? <LoaderCircleIcon className="size-3 motion-safe:animate-spin" />
                    : step.state === "failed" ? <XIcon className="size-3" />
                      : step.state === "review" ? <CircleAlertIcon className="size-3" />
                        : <span className="size-1 rounded-full bg-current" />}
              </motion.span>
            </AnimatePresence>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className={cn("text-xs font-medium", step.state === "pending" || step.state === "done" ? "text-silver-600" : "text-silver-900")}>
                {step.label}
              </p>
              <span className={cn(
                "text-[10px]",
                step.state === "active" ? "text-blue-400 motion-safe:animate-pulse"
                  : step.state === "failed" ? "text-red-300"
                    : step.state === "review" ? "text-amber-300" : "text-silver-600",
              )}>
                {stepLabels[step.state]}
              </span>
            </div>
            <AnimatePresence initial={false}>
              {(step.state === "active" || step.state === "failed" || step.state === "review") && (
                <motion.p
                  key="detail"
                  initial={reducedMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2 }}
                  className="overflow-hidden pt-1.5 text-[11px] leading-relaxed text-silver-600"
                >
                  {step.detail}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}
