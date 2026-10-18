import { useEffect, useRef, useState } from "react";

import {
  isRunningView,
  loaderSwapDelay,
  loaderViewKey,
  type ChatLoaderView,
} from "@/src/features/project/chatLoaderState";

/**
 * The chat loader's line, held steady. Tools can start and finish several
 * times a second; showing each one makes the line flicker. While a run is
 * live, a new line replaces the shown one only after that one has been up for
 * LOADER_MIN_HOLD_MS, and only if the new one has lasted LOADER_MIN_LIFE_MS.
 * Only the latest waiting line is kept. Starting a run, stopping it, and
 * finishing it show at once: the end of a run must never lag.
 */
export function useSteadyLoaderView(view: ChatLoaderView | null): ChatLoaderView | null {
  const key = loaderViewKey(view);
  const [held, setHeld] = useState({ view, key });
  const shownAtRef = useRef(0);
  const latestRef = useRef(view);

  const steady = isRunningView(view) && isRunningView(held.view);
  // Outside a live run there is nothing to hold: follow the view at once.
  if (!steady && held.key !== key) setHeld({ view, key });

  useEffect(() => {
    latestRef.current = view;
  });

  useEffect(() => {
    shownAtRef.current = Date.now();
  }, [held.key]);

  useEffect(() => {
    if (key === held.key) return;
    // A newer view clears this timer, so a step shorter than the minimum life
    // is skipped and only the latest waiting line is shown.
    const timer = setTimeout(() => {
      const next = latestRef.current;
      setHeld({ view: next, key: loaderViewKey(next) });
    }, loaderSwapDelay(shownAtRef.current, Date.now()));
    return () => clearTimeout(timer);
  }, [key, held.key]);

  return steady ? held.view : view;
}
