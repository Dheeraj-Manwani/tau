import { describe, expect, test } from "bun:test";
import {
  CONCEPT_QUESTIONS,
  QUESTIONS,
  composeReport,
  conceptNote,
  designReviewAvailable,
  measuredFaults,
  nextStep,
  parseAnswers,
  questionsFor,
  reviewBrief,
  systemPrompt,
} from "@/worker/design/review";
import {
  MEASURE_GATE_TIMEOUT_MS,
  createWorkLog,
  finishItems,
  gateMessage,
  noteWork,
  type GateInput,
  type GateItem,
  type RenderFault,
} from "@/worker/agent/finishGate";
import type { PageFirstScreen, PageMeasure, PageSurface, PageView } from "@/worker/lib/screenshot";
import type { Concept } from "@/worker/design/types";

// Two things that used to depend on effort in a way nobody chose
// (doc/DESIGN_COMPARISON_HOT_DATE.md §5e).
//
// What tau measures on a page needs a browser and no model, but it was done
// inside the design review, which a quick build never gets. And a MAX build
// had the same review as a HIGH one. No browser and no model is started here.

const surfaces = (...colours: (string | null)[]): PageSurface[] =>
  colours.map((background) => ({ height: 700, background }));

// The page the measurements were written for, as it measured at each width.
const SLAB = surfaces("#090707", "#1a1515", "#090707", "#1a1515", "#090707", "#1a1515", "#090707", "#090707");
const BELOW: PageFirstScreen = {
  fold: 800,
  sections: 8,
  headline: { words: "Not everyone gets in.", lines: 3, size: 141, top: 249, bottom: 629 },
  action: { words: "BEGIN YOUR APPLICATION", top: 903, bottom: 959 },
};
const ON_SCREEN: PageFirstScreen = { ...BELOW, fold: 844, action: { words: "BEGIN YOUR APPLICATION", top: 783, bottom: 839 } };

const LOUD = "- **Energy 9/10** — loud: say it at full volume.";
const QUIET = "- **Energy 3/10** — quiet.";

/** Stands in for the browser: what each width of the page measures as. */
const page = (desktop: Partial<PageMeasure> | Error, phone: Partial<PageMeasure> | Error) => {
  const seen: string[] = [];
  const measure = async (url: string, view: PageView): Promise<PageMeasure> => {
    seen.push(`${url} ${view.width}`);
    const found = view.mobile ? phone : desktop;
    if (found instanceof Error) throw found;
    return { overflowX: 0, surfaces: [], firstScreen: null, ...found };
  };
  return { measure, seen };
};

describe("what tau measures on a page, with no reviewer", () => {
  test("the page it was written for: the action below the first screen, and one background", async () => {
    const { measure, seen } = page({ surfaces: SLAB, firstScreen: BELOW }, { surfaces: SLAB, firstScreen: ON_SCREEN });
    const faults = await measuredFaults("https://5173-abc.e2b.app/", "/", LOUD, measure);
    expect(seen.sort()).toEqual(["https://5173-abc.e2b.app/ 1280", "https://5173-abc.e2b.app/ 390"]);
    expect(faults).toHaveLength(2);
    // What must be fixed comes first.
    expect(faults[0]!.startsWith('[broken] First screen — `/` desktop: tau measured "BEGIN YOUR APPLICATION" as starting 903px')).toBe(true);
    expect(faults[1]!.startsWith("[polish] Bands — `/` desktop: tau measured sections 1 to 8 of 8")).toBe(true);
  });

  test("one background is the design, on a page that is not loud", async () => {
    const { measure } = page({ surfaces: SLAB }, { surfaces: SLAB });
    expect(await measuredFaults("https://x.e2b.app", "/", QUIET, measure)).toEqual([]);
    expect(await measuredFaults("https://x.e2b.app", "/", null, measure)).toEqual([]);
  });

  test("a page wider than its window is found at the width where it is", async () => {
    const { measure } = page({ overflowX: 4 }, { overflowX: 212 });
    const faults = await measuredFaults("https://x.e2b.app", "pricing", null, measure);
    expect(faults).toHaveLength(1);
    expect(faults[0]!.startsWith("[broken] Overflow — `/pricing` phone: tau measured the page as 212px wider than the window")).toBe(true);
  });

  test("a width that could not be measured is left out, and the other still counts", async () => {
    const { measure } = page(new Error("the browser went away"), { overflowX: 90 });
    expect(await measuredFaults("https://x.e2b.app", "/", LOUD, measure)).toHaveLength(1);
    const neither = page(new Error("gone"), new Error("gone"));
    expect(await measuredFaults("https://x.e2b.app", "/", LOUD, neither.measure)).toEqual([]);
  });

  test("a page with nothing wrong says nothing", async () => {
    const fine = surfaces("#761528", "#f4eee4", "#28191a", "#e7d8ca");
    const { measure } = page({ surfaces: fine, firstScreen: { ...BELOW, action: { words: "Apply", top: 601, bottom: 654 } } }, { surfaces: fine, firstScreen: ON_SCREEN });
    expect(await measuredFaults("https://x.e2b.app", "/", LOUD, measure)).toEqual([]);
  });
});

describe("a run nobody reviewed has its page measured before it finishes", () => {
  const FIRST = '[broken] First screen — `/` desktop: tau measured "Apply" as starting 903px down the page.';
  const BANDS = "[polish] Bands — `/` desktop: tau measured sections 1 to 8 of 8 as sitting on one background.";

  /** A run that built a page. */
  const built = () => {
    const work = createWorkLog();
    noteWork(work, "create_file", { path: "src/pages/Home.tsx" }, { success: true });
    return work;
  };

  const counting = (faults: string[]) => {
    const calls: { url: string; path: string; prose: string | null }[] = [];
    const measure = async (url: string, path: string, prose: string | null) => {
      calls.push({ url, path, prose });
      return faults;
    };
    return { measure, calls };
  };

  const input = (over: Partial<GateInput> = {}): GateInput => ({
    generation: 2,
    effort: "LOW",
    work: built(),
    filesChanged: true,
    verifierRan: false,
    reviewerRan: false,
    design: null,
    reported: new Set<string>(),
    sandbox: {
      files: {
        read: async (path: string) => {
          if (path.endsWith(".tau/DESIGN.md")) return `# Hot Date\n\n${LOUD}\n`;
          throw new Error("no such file");
        },
      },
    },
    projectId: "p",
    userId: "u",
    previewUrl: "https://5173-abc123.e2b.app",
    renderCheck: async () => null,
    ...over,
  });
  const state = () => new Set<GateItem["kind"]>();
  const kinds = (items: GateItem[]) => items.map((item) => item.kind);

  test("a quick build is sent back with what was measured, before its memory is written", async () => {
    const { measure, calls } = counting([FIRST, BANDS]);
    const owed = await finishItems(input({ measure }), state());
    expect(kinds(owed)).toEqual(["measure", "memory"]);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://5173-abc123.e2b.app");
    expect(calls[0]!.path).toBe("/");
    // The design is read for how loud it is.
    expect(calls[0]!.prose).toContain("Energy 9/10");

    const item = owed[0]!;
    expect(item.reason).toBe("2 findings");
    expect(item.text.startsWith("**Fix what tau measured on the page.**")).toBe(true);
    expect(item.text).toContain(`- ${FIRST}\n- ${BANDS}`);
    expect(item.text).toContain("A `[polish]` finding is optional.");
    expect(item.text).toContain("tau will not measure the page again this run.");
    expect(gateMessage(owed)).toContain("1. **Fix what tau measured on the page.**");
  });

  test("a point of taste alone is put as optional", async () => {
    const owed = await finishItems(input({ measure: counting([BANDS]).measure }), state());
    const item = owed.find((i) => i.kind === "measure")!;
    expect(item.reason).toBe("1 finding");
    expect(item.text.startsWith("**Look at what tau measured on the page.**")).toBe(true);
    expect(item.text).toContain("take it if it is a small change, leave it otherwise");
    expect(item.text).not.toContain("Fix each");
  });

  test("a page with nothing to report owes nothing, and it is measured once", async () => {
    const { measure, calls } = counting([]);
    expect(kinds(await finishItems(input({ measure }), state()))).toEqual(["memory"]);

    const raised = state();
    const again = counting([FIRST]);
    expect(kinds(await finishItems(input({ measure: again.measure }), raised))).toContain("measure");
    expect(kinds(await finishItems(input({ measure: again.measure }), raised))).not.toContain("measure");
    expect(again.calls).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  test("it comes after the faults found in the source", async () => {
    const drifted = {
      files: {
        read: async (path: string) => {
          if (path.endsWith("src/pages/Home.tsx")) return '<p className="text-blue-500">Opening hours</p>';
          throw new Error("no such file");
        },
      },
    };
    const owed = await finishItems(input({ design: {}, sandbox: drifted, measure: counting([FIRST]).measure }), state());
    expect(kinds(owed)).toEqual(["design_check", "measure", "memory"]);
  });

  test("not for a run that only adjusted a screen, one a reviewer saw, or an older app", async () => {
    const { measure, calls } = counting([FIRST]);
    const adjusted = createWorkLog();
    noteWork(adjusted, "edit_file", { path: "src/pages/Home.tsx" }, { success: true });
    expect(kinds(await finishItems(input({ measure, work: adjusted }), state()))).toEqual([]);
    expect(kinds(await finishItems(input({ measure, reviewerRan: true }), state()))).toEqual(["memory"]);
    expect(kinds(await finishItems(input({ measure, previewUrl: null }), state()))).toEqual(["memory"]);
    expect(kinds(await finishItems(input({ measure, generation: 1 }), state()))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("a build that is to be reviewed is not measured as well", async () => {
    const { measure, calls } = counting([FIRST]);
    for (const effort of ["HIGH", "MAX"] as const) {
      const owed = kinds(await finishItems(input({ effort, measure, verifierRan: true }), state()));
      // With no model that reads images set up there is no review to ask for,
      // and measuring is what is left.
      expect(owed).toEqual(designReviewAvailable() ? ["design_review", "memory"] : ["measure", "memory"]);
    }
    expect(calls).toHaveLength(designReviewAvailable() ? 0 : 2);
    // Nor on the pass after the review was asked for, whether or not it was done.
    const asked = new Set<GateItem["kind"]>(["design_review"]);
    expect(kinds(await finishItems(input({ effort: "HIGH", measure }), asked))).not.toContain("measure");
  });

  test("an app that does not work is not measured, then or after it was sent back", async () => {
    const { measure, calls } = counting([FIRST]);
    const fault: RenderFault = { status: "crashed", summary: "Nothing rendered.", findings: "- TypeError", canInspect: true };
    const raised = state();
    expect(kinds(await finishItems(input({ measure, renderCheck: async () => fault }), raised))).toEqual(["render", "memory"]);
    expect(kinds(await finishItems(input({ measure, renderCheck: async () => null }), raised))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  test("an app that could not be opened in time is not opened twice more", async () => {
    const { measure, calls } = counting([FIRST]);
    const never = () => new Promise<RenderFault | null>(() => {});
    expect(kinds(await finishItems(input({ measure, renderCheck: never }), state(), 2_000, 40))).toEqual(["memory"]);
    expect(calls).toHaveLength(0);
  });

  test("a measurement that fails, or never comes back, costs itself and not the run", async () => {
    const throwing = async (): Promise<string[]> => {
      throw new Error("the browser went away");
    };
    expect(kinds(await finishItems(input({ measure: throwing }), state()))).toEqual(["memory"]);

    const raised = state();
    const started = Date.now();
    const owed = await finishItems(input({ measure: () => new Promise<string[]>(() => {}) }), raised, 2_000, 2_000, 40);
    expect(kinds(owed)).toEqual(["memory"]);
    expect(Date.now() - started).toBeLessThan(2_000);
    // Nothing was asked for, so it may still be asked for.
    expect(raised.has("measure")).toBe(false);
    expect(MEASURE_GATE_TIMEOUT_MS).toBeLessThanOrEqual(20_000);
  });

  test("a design that cannot be read costs the measurement its reading of how loud the page is", async () => {
    const { measure, calls } = counting([FIRST]);
    const unreadable = { files: { read: async (): Promise<string> => { throw new Error("no such file"); } } };
    expect(kinds(await finishItems(input({ measure, sandbox: unreadable }), state()))).toContain("measure");
    expect(calls[0]!.prose).toBeNull();
  });
});

describe("a MAX build is also held against its concept", () => {
  const concept: Concept = {
    idea: "Door policy: the page is the list on the door.",
    kind: "page",
    voice: "Talks like a bouncer who has heard every excuse. Never cruel about a body or an age.",
    moment: "A refusal slip, stamped and dated, with the reason written in by hand.",
    opening: "The headline takes the angle of a verdict already given; beside it, a fan of refusal slips.",
    picture: "none: the slips are the picture.",
    glance: "This is not for everyone, and it knows it.",
  };
  const clean = (n: number) => Array.from({ length: n }, (_, i) => `Q${i + 1}: no`).join("\n");

  test("three more questions, all of taste, after the usual ones and the reference", () => {
    expect(CONCEPT_QUESTIONS.map((q) => q.label)).toEqual(["Opening", "Voice", "Moment"]);
    expect(CONCEPT_QUESTIONS.every((q) => q.kind === "polish")).toBe(true);
    expect(questionsFor(false, true)).toHaveLength(10);
    expect(questionsFor(true, true).map((q) => q.label).slice(7)).toEqual(["Reference", "Opening", "Voice", "Moment"]);
    expect(systemPrompt(false, true)).toContain("exactly 10 lines");
    expect(systemPrompt(false, true)).toContain("Q8. Opening.");
    expect(systemPrompt(true, true)).toContain("exactly 11 lines");
    expect(systemPrompt(true, true)).toContain("Q11. Moment.");
    // A review that is not given the concept asks what it always asked.
    expect(questionsFor(false)).toEqual([...QUESTIONS]);
    expect(systemPrompt(false)).not.toContain("Opening.");
  });

  test("none names a number of things to find", () => {
    for (const q of CONCEPT_QUESTIONS) {
      expect(q.ask).not.toMatch(/\b(two|three|four|five|\d+)\b/i);
    }
  });

  test("the reviewer is shown the lines a picture can be held against, and told what they are for", () => {
    const note = conceptNote(concept);
    expect(note).toContain("It is for questions 8 to 10 only");
    expect(note).toContain("- Voice: Talks like a bouncer");
    expect(note).toContain("- The moment: A refusal slip");
    expect(note).toContain("- The first screen: The headline takes the angle");
    // The picture is left out: shown it, the reviewer compared the two in detail.
    expect(note).not.toContain("the slips are the picture");
    expect(note).toContain("nothing about its style");
    expect(note).not.toContain("Door policy");
    expect(note).not.toContain("not for everyone");
    expect(conceptNote(concept, true)).toContain("It is for questions 9 to 11 only");

    const brief = reviewBrief({ designProse: null, recheck: [], earlier: [], concept });
    expect(brief).toContain("The concept note:");
    expect(reviewBrief({ designProse: null, recheck: [], earlier: [] })).not.toContain("concept note");
  });

  test("taste is asked about once: on a re-check every question of it is answered no", () => {
    const brief = (over: { reference?: boolean; concept?: Concept }) =>
      reviewBrief({ designProse: null, recheck: ["/"], earlier: ["VERDICT: fix"], ...over });
    expect(brief({})).toContain('Answer "no" to the last question for a re-check screen.');
    expect(brief({ reference: true })).toContain('Answer "no" to the Template and Reference questions for a re-check screen.');
    expect(brief({ concept })).toContain('Answer "no" to the Template, Opening, Voice and Moment questions for a re-check screen.');
  });

  test("answers past the ninth are read, and each is reported under its own name", () => {
    const written = clean(10).replace("Q10: no", "Q10: yes — `/` desktop, the three steps: could be any dating app. Fix: show a refusal slip there.");
    const answers = parseAnswers(written, 10);
    expect(answers).toHaveLength(10);
    expect(answers[9]).toEqual({ question: 10, yes: true, detail: "`/` desktop, the three steps: could be any dating app. Fix: show a refusal slip there." });

    const { review, verdict } = composeReport(answers, [], true, questionsFor(false, true));
    // Taste does not make a screen need fixing.
    expect(verdict).toBe("pass");
    expect(review).toBe("VERDICT: pass\n1. [polish] Moment — `/` desktop, the three steps: could be any dating app. Fix: show a refusal slip there.");
    // With a reference the same question is the eleventh.
    const eleventh = parseAnswers(clean(11).replace("Q11: no", "Q11: yes — `/`: stock steps."), 11);
    expect(composeReport(eleventh, [], true, questionsFor(true, true)).review).toContain("1. [polish] Moment — `/`: stock steps.");
    // And none of it is said on a re-check.
    expect(composeReport(answers, [], false, questionsFor(false, true)).review).toBe("VERDICT: pass");
    // An answer to a question that was not asked is not an answer to anything.
    expect(parseAnswers("Q9: yes — `/`: no such question.")).toEqual([]);
    expect(parseAnswers("Q11: yes — `/`: no such question.", 10)).toEqual([]);
    expect(composeReport(parseAnswers(clean(7) + "\nQ8: yes — `/`: something."), [], true, questionsFor(false)).review).toBe("VERDICT: pass");
  });

  test("what it finds is work to do at MAX, and an option otherwise", () => {
    const plan = { fresh: ["/"], recheck: [] };
    expect(nextStep(plan, "pass")).toContain("A [polish] point is optional");
    expect(nextStep(plan, "pass", true)).toContain("take each [polish] point too");
    expect(nextStep(plan, "pass", true)).toContain("will not be judged again");
    expect(nextStep(plan, "pass", true)).not.toContain("optional");
    expect(nextStep(plan, "fix")).toContain("A [polish] finding is optional.");
    const fix = nextStep(plan, "fix", true);
    expect(fix).toContain("Fix every [broken] finding");
    expect(fix).toContain("take each [polish] point too");
    // The limit on looks is the same at every effort.
    expect(fix).toContain("You may call this once more for `/` to confirm the fixes");
  });
});
