import * as React from "react";
// The WAAPI-only animate: it commits the last frame itself on finish, where
// motion/react's would render it a frame later, over clearMotionStyles.
import { animate } from "motion/mini";
import type { AnimationPlaybackControls } from "motion/react";

import { useReduceMotion } from "@/src/hooks/useReduceMotion";

/**
 * The panel half of smooth tabs, after motion.dev's "Smooth Tabs" example:
 * the panel leaves the way you came from and enters from the side you went
 * to, with a short blur. The marker half is components/motion/TabIndicator.
 * The numbers are the example's own.
 */
const CONTENT_OFFSET = 50;
const CONTENT_DURATION = 0.3;
const CONTENT_EASE = [0.25, 1, 0.5, 1] as const;

// Safari drops frames animating `filter`, so it gets the slide without blur.
const BLUR = typeof navigator !== "undefined" && !/^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// A `transform` string rather than `x`: it runs on WAAPI with opacity and
// filter, off the main thread.
const slide = (axis: "x" | "y", px: number) => (axis === "x" ? `translateX(${px}px)` : `translateY(${px}px)`);

function clearMotionStyles(el: HTMLElement) {
  // Left in place, a transform or filter would trap `position: fixed` children.
  el.style.removeProperty("transform");
  el.style.removeProperty("opacity");
  el.style.removeProperty("filter");
}

/**
 * The panel half of smooth tabs (AnimatePresence `mode="wait"`, but for
 * panels that may stay mounted while hidden). Returns the value whose panel
 * is on screen, which trails `value` while the old panel leaves, and `panel`,
 * a ref for each panel's element. `indexOf` orders the tabs so the panels
 * know which way to slide; `axis` is "y" for a vertical tab list.
 */
export function useSmoothPanels<T extends string>(
  value: T,
  indexOf: (value: T) => number,
  axis: "x" | "y" = "x",
) {
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = React.useState(value);
  const panels = React.useRef(new Map<string, HTMLElement>());
  const latest = React.useRef(value);
  const direction = React.useRef(1);
  const leaving = React.useRef<Promise<unknown> | null>(null);
  const exit = React.useRef<AnimationPlaybackControls | null>(null);
  const enter = React.useRef<AnimationPlaybackControls | null>(null);
  const entered = React.useRef(shown);

  React.useLayoutEffect(() => {
    latest.current = value;
  }, [value]);

  React.useEffect(() => {
    if (value === shown) {
      // Back to the open tab before its panel finished leaving: bring it back.
      if (leaving.current) {
        leaving.current = null;
        exit.current?.stop();
        const el = panels.current.get(shown);
        if (el) clearMotionStyles(el);
      }
      return;
    }
    // Already leaving: the end of that exit opens whichever tab is latest.
    if (leaving.current) return;

    const el = panels.current.get(shown);
    enter.current?.stop();
    enter.current = null;
    const dir = Math.sign(indexOf(value) - indexOf(shown)) || 1;
    const offset = -dir * CONTENT_OFFSET;
    let done: Promise<unknown> = Promise.resolve();
    if (el && !reduceMotion) {
      exit.current = animate(
        el,
        { transform: slide(axis, offset), opacity: 0, ...(BLUR ? { filter: "blur(4px)" } : {}) },
        { duration: CONTENT_DURATION * 0.5, ease: CONTENT_EASE },
      );
      done = exit.current.finished;
    }
    const current = done.then(() => {
      if (leaving.current !== current) return;
      leaving.current = null;
      const next = latest.current;
      direction.current = Math.sign(indexOf(next) - indexOf(shown)) || 1;
      setShown(next);
    });
    leaving.current = current;
  }, [value, shown, indexOf, axis, reduceMotion]);

  React.useLayoutEffect(() => {
    if (entered.current === shown) return;
    entered.current = shown;
    const el = panels.current.get(shown);
    if (!el) return;
    if (reduceMotion) {
      clearMotionStyles(el);
      return;
    }
    const from = direction.current * CONTENT_OFFSET;
    // Set the first frame now, before paint, so the panel never flashes in place.
    el.style.opacity = "0";
    el.style.transform = slide(axis, from);
    if (BLUR) el.style.filter = "blur(4px)";
    const controls = animate(
      el,
      {
        transform: [slide(axis, from), slide(axis, 0)],
        opacity: [0, 1],
        ...(BLUR ? { filter: ["blur(4px)", "blur(0px)"] } : {}),
      },
      { duration: CONTENT_DURATION, ease: CONTENT_EASE },
    );
    enter.current = controls;
    void controls.finished.then(() => {
      if (enter.current === controls) clearMotionStyles(el);
    });
  }, [shown, axis, reduceMotion]);

  const panel = React.useCallback(
    (key: T) => (el: HTMLElement | null) => {
      if (el) panels.current.set(key, el);
      else panels.current.delete(key);
    },
    [],
  );

  return { shown: reduceMotion ? value : shown, panel };
}
