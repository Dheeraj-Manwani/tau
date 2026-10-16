import type { CSSProperties } from "react";

import { cn } from "@/src/lib/utils";

/**
 * The brand's rain (tier A only: Home, splash, auth, 404, the building
 * loader). Two CSS layers of streaks, masked so they fade out before readable
 * content; it costs no JavaScript and stops under reduced motion (index.css).
 * Place inside a `relative overflow-hidden` parent. `fill` covers the whole
 * parent instead of the hero's 900px band.
 */
export function RainLayer({
  fill = false,
  className,
}: {
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("rain-layer", fill && "rain-layer--fill", className)}
    />
  );
}

const SPLASH = [
  [4, -8, 0],
  [9, 7, 0.7],
  [15, -6, 1.3],
  [22, 9, 0.3],
  [28, -9, 1.9],
  [35, 6, 1],
  [41, -7, 0.15],
  [48, 8, 1.6],
  [55, -6, 0.55],
  [61, 9, 2.1],
  [68, -8, 1.15],
  [74, 7, 0.4],
  [81, -9, 1.75],
  [87, 6, 0.9],
  [93, -7, 1.45],
  [97, 8, 0.05],
] as const;

/** Drops striking the top edge of the element it sits in (the composer). */
export function RainSplash() {
  return (
    <div aria-hidden="true" className="rain-splash">
      {SPLASH.map(([left, dx, delay]) => (
        <i
          key={left}
          style={
            {
              left: `${left}%`,
              "--dx": `${dx}px`,
              "--d": `${delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
