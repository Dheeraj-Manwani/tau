export const BOLT_FLASH_EVENT = "tau:bolt-flash";

/**
 * One strike of light across the screen for a tier A event: the first build
 * finishing, a deploy going live. Call it from the event itself, never on a
 * timer. Reduced motion skips it (components/motion/BoltFlash.tsx).
 */
export function boltFlash(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(BOLT_FLASH_EVENT));
}
