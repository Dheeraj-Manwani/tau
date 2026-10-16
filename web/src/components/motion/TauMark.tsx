import type { CSSProperties } from "react";

import { cn } from "@/src/lib/utils";

export type TauMarkState = "rain" | "still" | "done";

/**
 * The brand mark as a loader (boards/Chat-Loader.dc.html "Rain in a tube"):
 * a tile with rain falling through it and the τ catching a flash twice in a
 * blink every 7s. `still` is the quiet tile (writing, stopped, idle); `done`
 * fires one flash and stays blue. CSS only; reduced motion leaves a still
 * tile (index.css).
 */
export function TauMark({
  size = 28,
  state = "rain",
  label,
  className,
}: {
  size?: number;
  state?: TauMarkState;
  /** Read out instead of the tile; leave empty when nearby text says it. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn(
        "tau-mark",
        state === "still" && "tau-mark--still",
        state === "done" && "tau-mark--done",
        className,
      )}
      style={{ "--s": `${size}px` } as CSSProperties}
    >
      <span className="tau-mark__rain" />
      <span className="tau-mark__glyph">τ</span>
    </span>
  );
}
