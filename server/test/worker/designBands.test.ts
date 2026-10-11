import { describe, expect, test } from "bun:test";
import { readThemeTokens } from "@/api/lib/themeEdit";
import { designFiles, designProse, resolveDesign } from "@/worker/design";
import { BAND_HUE_REACH, BAND_KEYS, BAND_TOKENS, buildBands, energyOf, neighbourHue } from "@/worker/design/bands";
import { contrast, hexToOklch, isHexColor, oklchToHex } from "@/worker/design/color";
import { describeDesign } from "@/worker/design/config";
import { describeEnergy, readDesignMeta } from "@/worker/design/designMd";
import { chooseFrom, directorPrompt, parseDirectorReply, type DirectorOptions } from "@/worker/design/director";
import { parseImportedDesign } from "@/worker/design/importDesign";
import { carryOverCss, readOf, restyledChoice } from "@/worker/design/restyle";
import {
  QUESTIONS,
  composeReport,
  designForReview,
  energyIn,
  longestSlab,
  parseAnswers,
  slabFault,
} from "@/worker/design/review";
import { ALL_STYLES, STYLES } from "@/worker/design/styles";
import type { DesignChoice, StyleKey } from "@/worker/design/types";
import { PAGE_SURFACES_SCRIPT, type PageSurface } from "@/worker/lib/screenshot";
import { guideText } from "@/worker/agent/docs";

// Two changes that came out of one comparison (doc/DESIGN_COMPARISON_HOT_DATE.md):
// a brief for a dating app that "roasts and is unapologetic" was given a hushed
// near-black style, and built as one long dark page. The style was matched to
// the subject and not to the voice; and a palette of one accent gave the page
// nothing to mark its chapters with.

const READ = "Reading this as: a dating app for the very attractive, which should feel sharp and unapologetic.";

const choiceFor = (style: StyleKey, over: Partial<DesignChoice> = {}): DesignChoice => ({
  style,
  accent: "#be123c",
  accentExact: false,
  mode: STYLES[style].defaultMode,
  dials: STYLES[style].dials,
  read: READ,
  source: "director",
  ...over,
});

const filesFor = (choice: DesignChoice) => designFiles(resolveDesign(choice), { fontsInstalled: true });

describe("the director rates a style for the brand's voice as well as its subject", () => {
  const reply = (extra: object) =>
    JSON.stringify({ styles: ["luxe", "maximalism", "editorial"], accents: ["#be123c"], ...extra });

  test("a style that suits the subject and not the voice is dropped, even when it was listed first", () => {
    // The brief this was written for: exclusive, so luxe; unapologetic, so not luxe.
    expect(parseDirectorReply(reply({ fits: [5, 4, 4], voices: [2, 5, 4] }))!.styles).toEqual(["maximalism", "editorial"]);
    expect(parseDirectorReply(reply({ fits: [5, 4, 4], voices: [5, 5, 3] }))!.styles).toEqual(["luxe", "maximalism"]);
  });

  test("either rating can rule a style out; when both rule out everything, the first is the answer", () => {
    expect(parseDirectorReply(reply({ fits: [5, 2, 5], voices: [5, 5, 2] }))!.styles).toEqual(["luxe"]);
    expect(parseDirectorReply(reply({ fits: [3, 3, 3], voices: [1, 2, 1] }))!.styles).toEqual(["luxe"]);
  });

  test("a reply that does not rate the voice is read as it always was", () => {
    expect(parseDirectorReply(reply({ fits: [5, 4, 4] }))!.styles).toEqual(["luxe", "maximalism", "editorial"]);
    expect(parseDirectorReply(reply({ voices: ["loud", null] }))!.styles).toEqual(["luxe", "maximalism", "editorial"]);
  });

  // Seen on the brief a real build sent, six replies in eight: energy 9, and
  // full marks for the voice of a style whose own description begins "Quiet".
  test("a brand it calls loud is not carried by a style that calls itself quiet, whatever it rated", () => {
    const loud = { fits: [5, 4, 4], voices: [5, 5, 4], energy: 9 };
    expect(parseDirectorReply(reply(loud))!.styles).toEqual(["maximalism", "editorial"]);
    // Below loud, or not said, the quiet style stays.
    expect(parseDirectorReply(reply({ ...loud, energy: 6 }))!.styles).toEqual(["luxe", "maximalism", "editorial"]);
    expect(parseDirectorReply(reply({ fits: [5, 4, 4], voices: [5, 5, 4] }))!.styles).toEqual(["luxe", "maximalism", "editorial"]);
    // Listed alone — the user named it, or nothing else fits — it is the answer.
    expect(parseDirectorReply(JSON.stringify({ styles: ["luxe"], energy: 10, accents: [] }))!.styles).toEqual(["luxe"]);
    // And a user's own choice of it is never the director's to refuse.
    const options = parseDirectorReply(reply(loud))!;
    expect(chooseFrom(options, "p", { style: "luxe" }).style).toBe("luxe");
  });

  test("the styles marked quiet are the ones that say so of themselves", () => {
    const quiet = ALL_STYLES.filter((s) => s.quiet).map((s) => s.key);
    expect(quiet).toEqual(["luxe", "wabisabi"]);
    for (const key of quiet) expect(STYLES[key].look.startsWith("Quiet")).toBe(true);
  });

  test("how loud the brand is comes back as a number in range, or not at all", () => {
    expect(parseDirectorReply(reply({ energy: 9 }))!.energy).toBe(9);
    expect(parseDirectorReply(reply({ energy: "7" }))!.energy).toBe(7);
    expect(parseDirectorReply(reply({ energy: 40 }))!.energy).toBe(10);
    expect("energy" in parseDirectorReply(reply({}))!).toBe(false);
    expect("energy" in parseDirectorReply(reply({ energy: "very" }))!).toBe(false);
  });

  test("the prompt asks both questions, and says they are different ones", () => {
    const prompt = directorPrompt("p");
    expect(prompt).toContain("- voices:");
    expect(prompt).toContain("which is a different question from its subject");
    expect(prompt).toContain("- energy:");
    expect(prompt).toContain("not from the industry");
    expect(prompt).toContain('"voices": [5, 4, 4], "energy": 5');
  });
});

describe("how loud the brand is stays with the design", () => {
  const offer = (over: Partial<DirectorOptions> = {}): DirectorOptions => ({
    styles: ["maximalism"],
    accents: ["#be123c"],
    accentExact: false,
    mode: "dark",
    dials: { variance: 8, motion: 6, density: 4 },
    energy: 9,
    read: READ,
    ...over,
  });

  test("what the director read is kept as read", () => {
    expect(chooseFrom(offer(), "p").energy).toBe(9);
    expect(chooseFrom(offer({ energy: undefined }), "p").energy).toBeUndefined();
    // A style the user picked is still theirs; how loud the brand is was not asked of them.
    expect(chooseFrom(offer(), "p", { style: "luxe" })).toMatchObject({ style: "luxe", energy: 9 });
  });

  test("someone who set the feel, or brought a design, has already said how loud", () => {
    expect(chooseFrom(offer(), "p", { dials: { variance: 2, motion: 2 } }).energy).toBeUndefined();
    expect(chooseFrom(offer(), "p", { dials: { density: 8 } }).energy).toBe(9);
    const imported = parseImportedDesign("---\ncolors:\n  primary: \"#0b5fff\"\n---\n\n# Mine\nPlain and blue.\n");
    expect(chooseFrom(offer(), "p", {}, imported).energy).toBeUndefined();
  });

  test("with nothing read, it follows the two dials that already say how loud a look is", () => {
    expect(energyOf({ dials: { variance: 2, motion: 2, density: 5 } })).toBe(2);
    expect(energyOf({ dials: { variance: 9, motion: 7, density: 5 } })).toBe(8);
    expect(energyOf({ energy: 3, dials: { variance: 9, motion: 9, density: 5 } })).toBe(3);
    expect(energyOf({ energy: 99, dials: STYLES.luxe.dials })).toBe(10);
  });

  test("is written into the file, read back from it, and survives a change of style", () => {
    const md = filesFor(choiceFor("maximalism", { energy: 9 })).designMd;
    expect(readDesignMeta(md)!.energy).toBe("9");
    expect(describeDesign(md)!.energy).toBe(9);
    expect(md).toContain("- **Energy 9/10** — loud:");

    const next = restyledChoice(describeDesign(md), { style: "editorial" }, readOf(md), "p");
    expect(next).toMatchObject({ style: "editorial", energy: 9 });
    // Setting the feel says it afresh.
    expect(restyledChoice(describeDesign(md), { dials: { motion: 2 } }, readOf(md), "p").energy).toBeUndefined();
  });

  test("a file that never recorded it says nothing, and the app still has an answer", () => {
    const md = filesFor(choiceFor("luxe")).designMd;
    expect(readDesignMeta(md)!.energy).toBeUndefined();
    expect(describeDesign(md)!.energy).toBeNull();
    expect(md).toContain(`- **Energy ${energyOf({ dials: STYLES.luxe.dials })}/10**`);
  });

  test("is told to the builder as what to do, at three levels, without a count of anything", () => {
    expect(describeEnergy(2)).toContain("quiet:");
    expect(describeEnergy(5)).toContain("confident:");
    expect(describeEnergy(9)).toContain("loud:");
    expect(describeEnergy(9)).toContain("neighbouring sections sit on different backgrounds");
    for (const e of [2, 5, 9]) {
      expect(describeEnergy(e).replace(`Energy ${e}/10`, "")).not.toMatch(/\d/);
    }
  });
});

// The colours `color-mix(in oklab, a p%, b)` gives, near enough to check contrast with.
function mixOklab(a: string, b: string, share: number): string {
  const lab = (hex: string) => {
    const { l, c, h } = hexToOklch(hex);
    return { l, a: c * Math.cos((h * Math.PI) / 180), b: c * Math.sin((h * Math.PI) / 180) };
  };
  const p = lab(a);
  const q = lab(b);
  const m = { l: p.l * share + q.l * (1 - share), a: p.a * share + q.a * (1 - share), b: p.b * share + q.b * (1 - share) };
  return oklchToHex({ l: m.l, c: Math.hypot(m.a, m.b), h: (Math.atan2(m.b, m.a) * 180) / Math.PI });
}

describe("bands: colour fields for whole sections", () => {
  const ACCENTS = ["#be123c", "#0f766e", "#fde047", "#1d4ed8", "#8a6f4e", "#777777", "#111111"];

  for (const style of ALL_STYLES) {
    test(`${style.key}: every band can be told from the page, and read on`, () => {
      for (const accent of ACCENTS) {
        for (const energy of [1, 5, 10]) {
          const choice = choiceFor(style.key, { accent, energy });
          const { theme, bands } = resolveDesign(choice);
          for (const mode of ["light", "dark"] as const) {
            const page = theme[mode].background;
            for (const key of BAND_KEYS) {
              const band = bands[mode][key];
              const text = bands[mode][`${key}-foreground`];
              expect(isHexColor(band)).toBe(true);
              expect(contrast(band, page)).toBeGreaterThanOrEqual(1.3);
              expect(contrast(text, band)).toBeGreaterThanOrEqual(7);
              // The quiet text the stylesheet mixes for inside a band.
              expect(contrast(mixOklab(text, band, 0.72), band)).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      }
    });
  }

  test("a band is never more saturated than its style lets the accent be", () => {
    for (const style of ALL_STYLES) {
      const { bands } = resolveDesign(choiceFor(style.key, { accent: "#ff0055", energy: 10 }));
      for (const mode of ["light", "dark"] as const) {
        for (const key of ["band-1", "band-3"] as const) {
          expect(hexToOklch(bands[mode][key]).c).toBeLessThanOrEqual(style.palette[mode].primary.c + 0.005);
        }
      }
    }
  });

  // A red brand built in Brutalist had a mint-green section: the style's second
  // colour is 150 degrees round the wheel, which is right for telling two bars
  // of a chart apart and wrong for a whole section of a page.
  test("the second hue is a neighbour of the accent, on the accent's own side of the wheel", () => {
    const hueOf = (hex: string) => hexToOklch(hex).h;
    const apart = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
    expect(BAND_HUE_REACH).toBe(60);
    for (const style of ALL_STYLES) {
      // Saturated accents round the wheel; a few degrees are lost fitting a colour to the screen.
      for (const accent of ["#ff2d55", "#e8380d", "#16a34a", "#0e7490", "#2563eb", "#9333ea"]) {
        const { bands } = resolveDesign(choiceFor(style.key, { accent, energy: 9 }));
        for (const mode of ["light", "dark"] as const) {
          const band = bands[mode]["band-3"];
          if (hexToOklch(band).c < 0.03) continue; // a quiet style's is a tinted neutral
          expect([style.key, accent, mode, apart(hueOf(band), hueOf(accent)) <= BAND_HUE_REACH + 8]).toEqual([style.key, accent, mode, true]);
        }
      }
    }
    // The page this was found on: red, and its second colour is now amber.
    const red = hueOf(resolveDesign(choiceFor("brutalist", { accent: "#ff2d55", energy: 9, mode: "dark" })).bands.dark["band-3"]);
    expect(red).toBeGreaterThan(60);
    expect(red).toBeLessThan(100);
    // Sixty degrees from yellow is green. The first page built with the reach
    // alone had a gold accent and a mint-green closing section, so a step that
    // would leave the warm side of the wheel is taken the other way.
    for (const warm of ["#d4af37", "#ffd400", "#f97316"]) {
      for (const style of ["brutalist", "maximalism", "neon", "playful"] as const) {
        const h = hueOf(resolveDesign(choiceFor(style, { accent: warm, energy: 9 })).bands.light["band-3"]);
        expect([warm, style, h >= 335 || h <= 104]).toEqual([warm, style, true]);
      }
    }
    expect(neighbourHue(93, 150)).toBe(33);
    expect(neighbourHue(20, 150)).toBe(80);
    // Leaning the other way from red would land in purple, so it does not.
    expect(neighbourHue(20, -150)).toBe(80);
    expect(neighbourHue(60, -150)).toBe(0);
    // A cool accent keeps a cool neighbour: green goes to teal, not to yellow.
    expect(neighbourHue(145, -150)).toBe(205);
    expect(neighbourHue(260, 150)).toBe(320);
    const own = STYLES.luxe.palette.chartHues[0];
    expect(Math.abs(own)).toBeLessThan(BAND_HUE_REACH);
    const luxe = resolveDesign(choiceFor("luxe", { accent: "#2563eb", energy: 9 }));
    const asBefore = buildBands({ ...STYLES.luxe.palette, chartHues: [own, 0, 0, 0] }, luxe.choice, luxe.theme);
    expect(luxe.bands.light["band-3"]).toBe(asBefore.light["band-3"]);
    // The charts keep the far colour: bars still have to be told apart.
    expect(apart(hueOf(resolveDesign(choiceFor("brutalist", { accent: "#ff2d55" })).theme.light["chart-2"]), hueOf("#ff2d55"))).toBeGreaterThan(100);
  });

  test("a louder brand gets more colour in them; a quiet style stays quiet however loud the brand", () => {
    const chroma = (style: StyleKey, energy: number) =>
      hexToOklch(resolveDesign(choiceFor(style, { energy, mode: "light" })).bands.light["band-3"]).c;
    expect(chroma("maximalism", 10)).toBeGreaterThan(chroma("maximalism", 1) * 2);
    expect(chroma("luxe", 10)).toBeLessThan(chroma("maximalism", 10));
    expect(chroma("luxe", 10)).toBeLessThanOrEqual(STYLES.luxe.palette.light.primary.c + 0.005);
  });

  test("the inverted band is the other mode's page, with its text", () => {
    const { theme, bands } = resolveDesign(choiceFor("editorial"));
    expect(bands.light["band-2"]).toBe(theme.dark.background);
    expect(bands.light["band-2-foreground"]).toBe(theme.dark.foreground);
    expect(bands.dark["band-2"]).toBe(theme.light.background);
  });

  test("a grey accent gets bands with no colour of their own", () => {
    const { bands } = resolveDesign(choiceFor("swiss", { accent: "#777777", energy: 10 }));
    expect(hexToOklch(bands.light["band-1"]).c).toBeLessThan(0.01);
    expect(hexToOklch(bands.light["band-3"]).c).toBeLessThan(0.01);
  });

  test("is the same for the same design", () => {
    const choice = choiceFor("playful", { energy: 8 });
    expect(buildBands(STYLES.playful.palette, choice, resolveDesign(choice).theme)).toEqual(resolveDesign(choice).bands);
  });
});

describe("bands in the stylesheet", () => {
  const design = resolveDesign(choiceFor("maximalism", { energy: 9 }));
  const { css } = designFiles(design, { fontsInstalled: true });

  test("each palette block declares them, flat and in hex, after the palette", () => {
    const block = (selector: string) => new RegExp(`(?:^|\\n)${selector} \\{([^}]*)\\}`).exec(css)![1]!;
    for (const [selector, mode] of [[":root", "light"], ["\\.dark", "dark"]] as const) {
      for (const name of BAND_TOKENS) {
        expect(block(selector)).toContain(`\n  --${name}: ${design.bands[mode][name]};`);
      }
      expect(block(selector).indexOf("--band-1:")).toBeGreaterThan(block(selector).indexOf("--sidebar-ring:"));
    }
    // The theme panel still finds what it offers.
    expect(readThemeTokens(css).root["--primary"]).toBe(design.theme.light.primary);
    expect(readThemeTokens(css).dark["--background"]).toBe(design.theme.dark.background);
  });

  test("they are colours a class can name", () => {
    for (const name of BAND_TOKENS) expect(css).toContain(`  --color-${name}: var(--${name});`);
  });

  test("a band class is a scope: it paints the section and re-points the page's tokens inside it", () => {
    for (const key of BAND_KEYS) {
      expect(css).toContain(`.${key} { --band: var(--${key}); --on-band: var(--${key}-foreground); }`);
    }
    const scope = /\.band-1, \.band-2, \.band-3 \{([^}]*)\}/.exec(css)![1]!;
    for (const line of [
      "background-color: var(--band);",
      "color: var(--on-band);",
      "--background: var(--band);",
      "--foreground: var(--on-band);",
      "--muted-foreground: color-mix(in oklab, var(--on-band) 72%, var(--band));",
      "--primary: var(--on-band);",
      "--primary-foreground: var(--band);",
    ]) {
      expect(scope).toContain(line);
    }
    // In the base layer, so a utility written on the section still wins.
    expect(css.indexOf(".band-1 {")).toBeGreaterThan(css.indexOf("@layer base {"));
    expect(css.indexOf(".band-1 {")).toBeLessThan(css.indexOf("@layer skin {"));
    expect(css.split("{").length).toBe(css.split("}").length);
  });

  test("a restyle writes the new style's bands and carries none of the old ones over", () => {
    const next = designFiles(resolveDesign(choiceFor("editorial", { energy: 9 })), { fontsInstalled: true }).css;
    const carried = carryOverCss(css, next);
    expect(carried).toBe(next);
    expect(carried.match(/--band-1:/g)).toHaveLength(2);
    // An app from before bands gains them at its next restyle.
    const older = css.replace(/\n\n  --band-[\s\S]*?(?=\n\})/g, "").replace(/  --color-band-[^\n]*\n/g, "");
    expect(older).not.toContain("--band-1:");
    expect(carryOverCss(older, next)).toBe(next);
  });
});

describe("bands in DESIGN.md", () => {
  const choice = choiceFor("maximalism", { energy: 9 });
  const design = resolveDesign(choice);
  const prose = designProse(designFiles(design, { fontsInstalled: true }).designMd);

  test("the builder is told what they are, in the colours the app opens with, and how to use one", () => {
    const b = design.bands[choice.mode];
    expect(prose).toContain(
      `- Bands: a full-width section may sit on a colour field of its own — \`band-1\` \`${b["band-1"]}\` (the accent, deep), \`band-2\` \`${b["band-2"]}\` (the page inverted) or \`band-3\` \`${b["band-3"]}\` (a second hue). Surfaces, not accents.`,
    );
    expect(prose).toContain("- A band is one class on the `<section>` (`band-1`).");
    expect(prose.indexOf("- Bands:")).toBeGreaterThan(prose.indexOf("## Colors"));
    expect(prose.indexOf("- Bands:")).toBeLessThan(prose.indexOf("## Typography"));
  });

  test("the reviewer is told they exist, and none of the instructions", () => {
    const seen = designForReview(prose);
    expect(seen).toContain("- Bands: a full-width section may sit on a colour field of its own");
    expect(seen).not.toContain("A band is one class");
    expect(seen).not.toContain("Energy");
    expect(QUESTIONS.find((q) => q.label === "Off-style")!.ask).toContain("band colours the design names");
  });

  test("the guides say the same", () => {
    expect(guideText("layouts")).toContain("`band-1`, `band-2`, `band-3`");
    expect(guideText("layouts")).toContain("A band class is a scope");
    expect(guideText("theme")).toContain("`band-1`, `band-2`, `band-3`, each with a `-foreground`");
  });
});

describe("a loud page that runs on one background", () => {
  const surfaces = (...colours: (string | null)[]): PageSurface[] =>
    colours.map((background) => ({ height: 700, background }));

  // Both measured from real pages, with the script below, for the brief above:
  // the one tau built, and the one it was compared with.
  const SLAB = surfaces("#090707", "#1a1515", "#090707", "#1a1515", "#090707", "#1a1515", "#090707", "#090707");
  const BLOCKED = surfaces("#761528", "#f4eee4", "#28191a", "#e7d8ca", "#b41d37", "#f4eee4", "#e7d8ca", "#28191a");

  test("the page and its muted fill, alternating, are one surface to the eye", () => {
    expect(longestSlab(SLAB)).toEqual({ first: 1, last: 8 });
    expect(longestSlab(BLOCKED)).toBeNull();
  });

  test("two neighbours may share a background; a picture or another hue ends a stretch", () => {
    expect(longestSlab(surfaces("#ffffff", "#ffffff", "#be123c", "#ffffff", "#ffffff"))).toBeNull();
    expect(longestSlab(surfaces("#ffffff", "#f5f5f5", "#ffffff", "#be123c"))).toEqual({ first: 1, last: 3 });
    expect(longestSlab(surfaces("#ffffff", "#ffffff", null, "#ffffff", "#ffffff"))).toBeNull();
    // The same lightness in two hues is two surfaces.
    expect(longestSlab(surfaces("#c4302b", "#2f7d32", "#c4302b", "#2f7d32"))).toBeNull();
    // The longest stretch is the one reported.
    expect(longestSlab(surfaces("#111111", "#111111", "#111111", "#be123c", "#ffffff", "#ffffff", "#ffffff", "#ffffff"))).toEqual({ first: 5, last: 8 });
    expect(longestSlab([])).toBeNull();
  });

  test("is mentioned only to a design that asks for colour, and only as polish", () => {
    const screen = { path: "/", view: "desktop" as const };
    expect(slabFault(screen, SLAB, 3)).toBeNull();
    expect(slabFault(screen, SLAB, 6)).toBeNull();
    expect(slabFault(screen, SLAB, null)).toBeNull();
    expect(slabFault(screen, BLOCKED, 9)).toBeNull();
    const fault = slabFault(screen, SLAB, 9)!;
    expect(fault.startsWith("[polish] Bands — `/` desktop: tau measured sections 1 to 8 of 8")).toBe(true);
    expect(fault).toContain("leave alone any that belong together");
  });

  test("how loud a design is can be read from what the reviewer is given", () => {
    expect(energyIn(designProse(filesFor(choiceFor("maximalism", { energy: 9 })).designMd))).toBe(9);
    expect(energyIn("# A design from somewhere else")).toBeNull();
    expect(energyIn(null)).toBeNull();
  });

  test("it does not make a screen need fixing, and comes after what does", () => {
    const clean = QUESTIONS.map((_, i) => `Q${i + 1}: no`).join("\n");
    const fault = slabFault({ path: "/", view: "desktop" }, SLAB, 9)!;
    expect(composeReport(parseAnswers(clean), [fault])).toEqual({ review: `VERDICT: pass\n1. ${fault}`, verdict: "pass" });
    const broken = parseAnswers(clean.replace("Q2: no", "Q2: yes — `/` phone: the logo sits on the menu."));
    expect(composeReport(broken, [fault]).review.split("\n").map((l) => l.slice(0, 12))).toEqual([
      "VERDICT: fix", "1. [broken] ", "2. [polish] ",
    ]);
  });

  test("the script that measures it parses", () => {
    expect(() => new Function(`return ${PAGE_SURFACES_SCRIPT}`)).not.toThrow();
  });
});
