import { describe, expect, test } from "bun:test";

import { ambienceHintText, shouldShowAmbienceHint } from "../src/lib/ambienceHint";
import { DEFAULT_AMBIENCE, useSettingsStore } from "../src/stores/useSettingsStore";

// Home points a first-time visitor at the ambience switches once per device,
// and never on top of the first-run motion dialog or another dialog.

const ready = { seen: false, motionIntroSeen: true, settled: true, blocked: false };

describe("shouldShowAmbienceHint", () => {
  test("shows once the page has settled and nothing else is open", () => {
    expect(shouldShowAmbienceHint(ready)).toBe(true);
  });

  test("stays hidden once dismissed", () => {
    expect(shouldShowAmbienceHint({ ...ready, seen: true })).toBe(false);
  });

  test("waits for the motion intro, the delay and any open dialog", () => {
    expect(shouldShowAmbienceHint({ ...ready, motionIntroSeen: false })).toBe(false);
    expect(shouldShowAmbienceHint({ ...ready, settled: false })).toBe(false);
    expect(shouldShowAmbienceHint({ ...ready, blocked: true })).toBe(false);
  });
});

describe("ambienceHintText", () => {
  test("only mentions the soundtrack when there is one", () => {
    expect(ambienceHintText(true)).toContain("soundtrack");
    expect(ambienceHintText(false)).not.toContain("soundtrack");
  });
});

describe("ambience settings", () => {
  test("start with the storm on and the sound off", () => {
    expect(DEFAULT_AMBIENCE).toEqual({ rain: true, lightning: true, sound: false });
  });

  test("remember the dismissed hint on this device", () => {
    expect(useSettingsStore.getState().ambienceHintSeen).toBe(false);
    useSettingsStore.getState().markAmbienceHintSeen();
    expect(useSettingsStore.getState().ambienceHintSeen).toBe(true);
  });
});
