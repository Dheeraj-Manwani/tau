import { describe, expect, test } from "bun:test";
import { QUESTIONS, composeReport, firstScreenFault, parseAnswers } from "@/worker/design/review";
import {
  PAGE_FIRST_SCREEN_SCRIPT,
  PAGE_SURFACES_SCRIPT,
  type PageFirstScreen,
} from "@/worker/lib/screenshot";

// A landing page tau built opened with a headline 141 pixels tall on three
// lines, and its one button began 103 pixels below the bottom of the window
// (doc/DESIGN_COMPARISON_HOT_DATE.md). Nothing a model is shown says where a
// first screen ends, so tau measures it.
//
// Every measurement below was taken from a real page with the script that
// ships, at the two sizes a review uses.

const first = (
  fold: number,
  sections: number,
  headline: [lines: number, size: number, top: number, bottom: number],
  action: [words: string, top: number, bottom: number] | null,
): PageFirstScreen => ({
  fold,
  sections,
  headline: { words: "A headline", lines: headline[0], size: headline[1], top: headline[2], bottom: headline[3] },
  action: action ? { words: action[0], top: action[1], bottom: action[2] } : null,
});

const DESKTOP = { path: "/", view: "desktop" as const };
const PHONE = { path: "/", view: "phone" as const };

// The page this was written for.
const TAU_DESKTOP = first(800, 8, [3, 141, 249, 629], ["BEGIN YOUR APPLICATION", 903, 959]);
const TAU_PHONE = first(844, 8, [4, 48, 264, 437], ["BEGIN YOUR APPLICATION", 783, 839]);

// The page it was compared with, and published sites: all fine.
const FINE: [string, PageFirstScreen][] = [
  ["the other builder's page, desktop", first(800, 8, [3, 116, 160, 466], ["PUT YOUR NAME IN", 601, 654])],
  ["the other builder's page, phone", first(844, 8, [3, 66, 157, 332], ["PUT YOUR NAME IN", 456, 509])],
  // Four lines of headline at desktop width, and five on a phone: the number
  // of lines says nothing by itself.
  ["stripe.com, desktop", first(800, 8, [4, 48, 224, 445], ["Request an invite", 485, 533])],
  ["linear.app, phone", first(844, 9, [5, 38, 196, 363], ["New Loops", 451, 475])],
  ["tailwindcss.com, desktop", first(800, 5, [3, 96, 153, 441], ["Get started", 577, 617])],
  // The nearest any of them came: 51 pixels to spare.
  ["shopify.com, desktop", first(800, 14, [2, 96, 296, 503], ["Start for free", 693, 749])],
  ["vercel.com, phone", first(844, 2, [2, 48, 444, 556], ["Deploy now", 624, 664])],
  ["gumroad.com, desktop", first(800, 10, [1, 96, 304, 400], ["Start selling", 520, 584])],
];

describe("a call to action below the first screen", () => {
  test("the page it was written for is found, at the width where it is true", () => {
    const fault = firstScreenFault(DESKTOP, TAU_DESKTOP)!;
    expect(fault.startsWith('[broken] First screen — `/` desktop: tau measured "BEGIN YOUR APPLICATION" as starting 903px down the page, and the first screen ends at 800px, so a visitor has to scroll')).toBe(true);
    // What pushed it down, in numbers the builder can act on.
    expect(fault).toContain("set at 141px, runs to 3 lines and ends at 629px");
    expect(fault).toContain("do not move the action above the headline");
    // On a phone the same button ends five pixels inside the window.
    expect(firstScreenFault(PHONE, TAU_PHONE)).toBeNull();
  });

  test("pages that work are left alone", () => {
    for (const [name, measured] of FINE) {
      expect([name, firstScreenFault(DESKTOP, measured)]).toEqual([name, null]);
    }
  });

  test("a few pixels over is rounding; more is not", () => {
    expect(firstScreenFault(DESKTOP, first(800, 4, [2, 64, 200, 340], ["Join", 760, 808]))).toBeNull();
    expect(firstScreenFault(DESKTOP, first(800, 4, [2, 64, 200, 340], ["Join", 761, 809]))).not.toBeNull();
    // A button half out of the window is not on the first screen.
    expect(firstScreenFault(PHONE, first(844, 4, [3, 48, 200, 380], ["Join", 820, 868]))).not.toBeNull();
  });

  test("says nothing where there is no first screen to keep", () => {
    // No headline in a section of its own: the script reports nothing.
    expect(firstScreenFault(DESKTOP, null)).toBeNull();
    // A headline with nothing to press after it — a poster, an article.
    expect(firstScreenFault(DESKTOP, first(800, 8, [1, 80, 220, 304], null))).toBeNull();
    // One section: a screen of an app, where a button at the foot of a form is ordinary.
    expect(firstScreenFault(DESKTOP, first(800, 1, [1, 30, 40, 76], ["Save", 900, 940]))).toBeNull();
    // An action two screens down belongs to something lower in a tall section.
    expect(firstScreenFault(DESKTOP, first(800, 3, [2, 48, 120, 230], ["Subscribe", 1600, 1640]))).toBeNull();
    expect(firstScreenFault(DESKTOP, first(800, 3, [2, 48, 120, 230], ["Subscribe", 1599, 1639]))).not.toBeNull();
  });

  test("a headline on one line is said so, and an action with no words is still named", () => {
    const fault = firstScreenFault(PHONE, first(844, 3, [1, 40, 500, 548], ["", 900, 944]))!;
    expect(fault).toContain("tau measured the first thing to press as starting 900px");
    expect(fault).toContain("runs to one line");
  });

  // The first live review to report this: a button the window cut through,
  // which the builder then fixed by setting the headline at 104px on two lines.
  test("a button the window cuts through is said to be cut, not to be missing", () => {
    const fault = firstScreenFault(DESKTOP, first(800, 8, [3, 141, 142, 565], ["SEE THE STANDARD", 760, 810]))!;
    expect(fault).toContain('tau measured "SEE THE STANDARD" from 760px to 810px down the page, and the first screen ends at 800px, so the bottom of the window cuts through it');
    expect(fault).not.toContain("has to scroll");
    expect(firstScreenFault(DESKTOP, first(800, 8, [2, 104, 188, 384], ["SEE THE STANDARD", 570, 620]))).toBeNull();
  });

  test("it makes the screen need fixing, whatever the reviewer answered", () => {
    const clean = QUESTIONS.map((_, i) => `Q${i + 1}: no`).join("\n");
    const fault = firstScreenFault(DESKTOP, TAU_DESKTOP)!;
    const report = composeReport(parseAnswers(clean), [fault]);
    expect(report.verdict).toBe("fix");
    expect(report.review).toBe(`VERDICT: fix\n1. ${fault}`);
    // And on a re-check, where matters of taste are not raised, it still is.
    expect(composeReport(parseAnswers(clean), [fault], false).verdict).toBe("fix");
  });

  test("the scripts that measure a page parse, and share how they find its sections", () => {
    expect(() => new Function(`return ${PAGE_FIRST_SCREEN_SCRIPT}`)).not.toThrow();
    expect(() => new Function(`return ${PAGE_SURFACES_SCRIPT}`)).not.toThrow();
    const finder = "const wide = (el) => { const r = box(el); return r.width >= vw * 0.9 && r.height >= 160; };";
    expect(PAGE_FIRST_SCREEN_SCRIPT).toContain(finder);
    expect(PAGE_SURFACES_SCRIPT).toContain(finder);
    // A regular expression written in a template survives into the script.
    expect(PAGE_FIRST_SCREEN_SCRIPT).toContain('.replace(/\\s+/g, " ")');
  });
});
