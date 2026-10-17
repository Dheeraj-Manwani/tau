import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ComposerSettings, type StyleSetting } from "../src/features/composer/ComposerSettings";
import type { Effort } from "../src/features/project/types";

// The composer's settings chip says what the next build will use: the look
// (Home only) and the effort, without opening the menu.

const auto: StyleSetting = {
  label: "Auto",
  isAuto: true,
  detail: "",
  onAuto: () => {},
  onBrowse: () => {},
};

function chip(effort: Effort, style: StyleSetting | null = null): string {
  const html = renderToStaticMarkup(<ComposerSettings effort={effort} onEffortChange={() => {}} style={style} />);
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("ComposerSettings", () => {
  test("shows the look and the effort side by side on Home", () => {
    expect(chip("MAX", auto)).toBe("Auto Max");
    expect(chip("LOW", { ...auto, label: "Brutalist", isAuto: false })).toBe("Brutalist Low");
  });

  test("shows effort alone where the look is already set", () => {
    expect(chip("HIGH")).toBe("High");
  });

  test("names both settings for screen readers", () => {
    const html = renderToStaticMarkup(<ComposerSettings effort="MAX" onEffortChange={() => {}} style={auto} />);
    expect(html).toContain('aria-label="Build settings. Style: Auto. Effort: Max"');
  });
});
