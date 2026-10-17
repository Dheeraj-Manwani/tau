import { describe, expect, test } from "bun:test";

import { stormSounds, thunderTake } from "../src/lib/thunder";

// Each lightning strike plays one of three thunder clips a moment later, varied
// so the same few clips do not sound like a loop.

/** A fixed sequence of "random" numbers, cycled. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("thunderTake", () => {
  test("never plays the same clip twice running", () => {
    let last: number | null = null;
    for (let k = 0; k < 500; k++) {
      const take = thunderTake(3, last);
      expect(take.index).not.toBe(last);
      expect(take.index).toBeGreaterThanOrEqual(0);
      expect(take.index).toBeLessThan(3);
      last = take.index;
    }
  });

  test("moves off a repeat even when the dice land on it", () => {
    // 0.5 picks clip 1 of 3, the clip that just played.
    expect(thunderTake(3, 1, sequence(0.5, 0)).index).not.toBe(1);
  });

  test("a single clip is allowed to repeat", () => {
    expect(thunderTake(1, 0).index).toBe(0);
  });

  test("speed, volume and delay stay in their ranges", () => {
    for (const r of [0, 0.999]) {
      const take = thunderTake(3, null, () => r);
      expect(take.rate).toBeGreaterThanOrEqual(0.85);
      expect(take.rate).toBeLessThanOrEqual(1.1);
      expect(take.volume).toBeGreaterThanOrEqual(0.45);
      expect(take.volume).toBeLessThanOrEqual(0.8);
      expect(take.delayMs).toBeGreaterThanOrEqual(250);
      expect(take.delayMs).toBeLessThanOrEqual(1200);
    }
  });
});

describe("stormSounds", () => {
  const on = { sound: true, rain: true, lightning: true, reduceMotion: false };

  test("rain and thunder are heard with Sound and their own switch on", () => {
    expect(stormSounds(on)).toEqual({ rain: true, thunder: true });
    expect(stormSounds({ ...on, rain: false })).toEqual({ rain: false, thunder: true });
    expect(stormSounds({ ...on, lightning: false })).toEqual({ rain: true, thunder: false });
  });

  test("Sound off silences the storm", () => {
    expect(stormSounds({ ...on, sound: false })).toEqual({ rain: false, thunder: false });
  });

  test("a still storm under reduced motion makes no noise", () => {
    expect(stormSounds({ ...on, reduceMotion: true })).toEqual({ rain: false, thunder: false });
  });
});
