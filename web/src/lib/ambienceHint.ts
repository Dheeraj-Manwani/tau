/** What the first-visit callout says; it only promises a soundtrack that exists. */
export function ambienceHintText(hasSound: boolean): string {
  return hasSound
    ? "Turn the rain, lightning or soundtrack on and off. tau remembers your choice."
    : "Turn the rain and lightning on and off. tau remembers your choice.";
}

/**
 * When Home points the first-time visitor at the ambience switches: once per
 * device, never on top of the first-run motion dialog or another dialog, and
 * only after the page has settled.
 */
export function shouldShowAmbienceHint(gate: {
  seen: boolean;
  motionIntroSeen: boolean;
  settled: boolean;
  blocked: boolean;
}): boolean {
  return !gate.seen && gate.motionIntroSeen && gate.settled && !gate.blocked;
}
