import * as React from "react";
import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

/**
 * boards/Surfaces.dc.html §01. One meaning per colour: blue is selection and
 * "modified", green is live or added, orange is waiting, unpublished and Pro,
 * red is failed or deleted. `mono` is the quiet admin-only tag.
 */
const toneClass = {
  neutral: "border-line-strong bg-space-surface text-silver-600",
  blue: "border-blue-500/34 bg-blue-500/12 text-blue-500",
  green: "border-green-400/32 bg-green-400/11 text-green-400",
  orange: "border-orange-400/34 bg-orange-400/11 text-orange-400",
  red: "border-red-400/32 bg-red-400/10 text-red-400",
  pro: "border-orange-400 bg-orange-400 font-semibold text-orange-ink",
  mono: "h-[18px] border-line-strong bg-space-surface px-1.5 font-mono text-[10px] tracking-[0.08em] text-silver-600 uppercase",
} as const;

export type BadgeTone = keyof typeof toneClass;

function Badge({
  tone = "neutral",
  dot = false,
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-xs border px-2 text-[11px] leading-none font-medium whitespace-nowrap [&_svg]:size-3 [&_svg]:shrink-0",
        toneClass[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/**
 * Status dots (boards/Controls.dc.html §03): live and current is green, live
 * with unpublished changes is orange, deploying is a small blue spinner,
 * failed is red, offline is grey.
 */
const dotClass = {
  live: "bg-green-400",
  unpublished: "bg-orange-400",
  waiting: "bg-orange-400",
  failed: "bg-red-400",
  offline: "bg-line-hover",
} as const;

export type StatusTone = keyof typeof dotClass | "deploying";

function StatusDot({
  tone,
  size = 8,
  className,
  label,
}: {
  tone: StatusTone;
  size?: 6 | 8;
  className?: string;
  /** Read out instead of the dot; leave empty when visible text says it. */
  label?: string;
}) {
  if (tone === "deploying")
    return (
      <LoaderCircleIcon
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className={cn("size-3.5 shrink-0 animate-spin text-blue-500 motion-reduce:animate-none", className)}
      />
    );
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 rounded-full", size === 6 ? "size-1.5" : "size-2", dotClass[tone], className)}
    />
  );
}

export { Badge, StatusDot };
