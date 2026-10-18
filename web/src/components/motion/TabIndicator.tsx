import * as React from "react";
import { motion } from "motion/react";

import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { cn } from "@/src/lib/utils";

/**
 * Smooth tabs, after motion.dev's "Smooth Tabs" example: the active marker
 * slides between tabs on a shared `layoutId`. Its panels slide with
 * `useSmoothPanels` (hooks/useSmoothPanels). The spring is the example's own.
 */
const TAB_INDICATOR_SPRING = { type: "spring", stiffness: 500, damping: 35 } as const;

/**
 * The marker under (or behind) the active tab. Render it only inside the
 * active tab, with one `id` per tab bar: Motion carries it from the old tab
 * to the new one. Each marker keys its layout on its own instance, so only a
 * tab change moves it; an unrelated re-render (a panel being resized) never
 * sets it springing after its tab.
 */
export function TabIndicator({
  id,
  className,
  radius,
}: {
  id: string;
  className?: string;
  /** Corner radius in px. Set here rather than in a class so Motion keeps it round while the marker stretches. */
  radius?: number;
}) {
  const reduceMotion = useReduceMotion();
  const instance = React.useId();
  return (
    <motion.span
      aria-hidden="true"
      layoutId={id}
      layoutDependency={instance}
      transition={reduceMotion ? { duration: 0 } : TAB_INDICATOR_SPRING}
      className={cn("pointer-events-none absolute", className)}
      style={radius === undefined ? undefined : { borderRadius: radius }}
    />
  );
}
