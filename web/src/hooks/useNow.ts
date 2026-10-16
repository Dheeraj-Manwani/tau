import { useEffect, useState } from "react";

/** `Date.now()`, re-read every `intervalMs` while `enabled`. For live
 *  elapsed-time labels; text that changes, not an animation. */
export function useNow(enabled: boolean, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Until the first tick it may be up to one interval stale; callers clamp.
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs]);
  return now;
}
