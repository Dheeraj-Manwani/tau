import * as React from "react";

import { cn } from "@/src/lib/utils";

const clamp = (value: number) => Math.min(100, Math.max(0, value));

/** A neutral track with a blue fill: uploads and other work with a known end.
 *  Waits with no known end show elapsed time instead, never a bar. */
function Progress({
  value,
  label,
  className,
}: {
  /** 0–100. */
  value: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const pct = clamp(value);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && (
        <div className="flex justify-between gap-3 text-[13px]">
          <span>{label}</span>
          <span className="font-mono text-xs text-silver-500">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        className="h-1.5 overflow-hidden rounded-[3px] bg-line"
      >
        <div className="h-full rounded-[3px] bg-blue-500 transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The segmented orange meter. It belongs to the credit balance only. */
function CreditMeter({ value, className, label }: { value: number; className?: string; label?: string }) {
  const pct = clamp(value);
  return (
    <div
      role="meter"
      aria-label={label ?? "Credits"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "relative h-2.5 rounded-[2px] bg-[repeating-linear-gradient(90deg,var(--line)_0_14px,transparent_14px_18px)]",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(90deg,var(--orange-400)_0_14px,transparent_14px_18px)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export { CreditMeter, Progress };
