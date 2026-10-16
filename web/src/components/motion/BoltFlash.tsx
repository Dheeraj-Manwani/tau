import { useEffect, useState } from "react";

import { useReduceMotion } from "@/src/hooks/useReduceMotion";
import { BOLT_FLASH_EVENT } from "@/src/lib/bolt";

const FLASH_MS = 1200;

/** Listens for `boltFlash()` and plays the flash once (index.css `.bolt-flash`). */
export function BoltFlash() {
  const reduceMotion = useReduceMotion();
  const [strike, setStrike] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const fire = () => setStrike((n) => n + 1);
    window.addEventListener(BOLT_FLASH_EVENT, fire);
    return () => window.removeEventListener(BOLT_FLASH_EVENT, fire);
  }, [reduceMotion]);

  useEffect(() => {
    if (strike === 0) return;
    const timer = window.setTimeout(() => setStrike(0), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [strike]);

  // A new key per strike restarts the animation if two land close together.
  return strike > 0 && !reduceMotion ? <div key={strike} aria-hidden="true" className="bolt-flash" /> : null;
}
