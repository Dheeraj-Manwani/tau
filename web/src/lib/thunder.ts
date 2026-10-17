/** How one clap of thunder plays: which clip, how fast, how loud, how late. */
export interface ThunderTake {
  index: number;
  /** Below 1 is lower and longer (further away); above, closer and sharper. */
  rate: number;
  volume: number;
  /** After the flash: light arrives before sound. */
  delayMs: number;
}

const between = (a: number, b: number, random: () => number) => a + random() * (b - a);

/**
 * A varied take on one of `count` clips, never the same clip twice running
 * (when there is more than one), so three clips do not sound like a loop.
 */
export function thunderTake(count: number, last: number | null, random: () => number = Math.random): ThunderTake {
  let index = Math.floor(random() * count);
  if (count > 1 && index === last) index = (index + 1 + Math.floor(random() * (count - 1))) % count;
  return {
    index,
    rate: between(0.85, 1.1, random),
    volume: between(0.45, 0.8, random),
    delayMs: Math.round(between(250, 1200, random)),
  };
}

/** Thunder is heard only when the storm shows lightning and sound is on. */
export function stormSounds({
  sound,
  rain,
  lightning,
  reduceMotion,
}: {
  sound: boolean;
  rain: boolean;
  lightning: boolean;
  reduceMotion: boolean;
}): { rain: boolean; thunder: boolean } {
  // Under reduced motion the storm is still, so it makes no noise either.
  return { rain: sound && rain && !reduceMotion, thunder: sound && lightning && !reduceMotion };
}
