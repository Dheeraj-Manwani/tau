/**
 * Design review: a model looks at the app and says what is wrong with it.
 *
 * The mechanical checks (`checks.ts`) read source and catch what a regular
 * expression can. What they cannot see is the result: a heading that wraps
 * into the image beside it, a column that collapses to nothing on a phone, a
 * page that is technically inside the design and still looks like every other
 * generated page. That takes eyes. The agent building the app has none — it
 * writes markup and never sees it rendered — so this step renders the app,
 * takes pictures of it at desktop and phone width, and asks a model that can
 * read images about them.
 *
 * It is one model call, not a tool-using sub-agent: everything the reviewer
 * needs is in the pictures, and there is nothing for it to go and look up.
 *
 * Three things here were learned from the first real runs, in which the
 * builder reviewed the same three pages four times, each report at the
 * maximum length, the third undoing what the first had asked for and the
 * fourth asking for it back.
 *
 * ## Questions, not "what is wrong?"
 *
 * Asked what is wrong with a screen, the model always finds something: on an
 * app with nothing wrong it returned as many findings as it was allowed, a
 * different set each run. Asked seven yes-or-no questions (`QUESTIONS`), each
 * about a fault that is either in the picture or is not, the same model
 * answers "no" six or seven times on that app, the same way every run, and
 * still says "yes" to every planted fault on a broken one. "No" has to be an
 * answer it can give. The report the builder reads is put together here from
 * the answers, so its shape and its verdict do not depend on the model's prose.
 *
 * ## The reviewer is told what shows, and what tau measured
 *
 * A `DESIGN.md` is written for the builder, and most of it is instruction no
 * picture can confirm. Given all of it, the reviewer reported a "violation"
 * for each line it could loosely attach to something on screen. It now gets
 * only what the app is, its colours, its typefaces, its depth and its shapes
 * (`designForReview`). And what a still picture cannot show — that a table
 * scrolls sideways rather than being cut off, that the whole page is wider
 * than its window — is measured in the browser and written into the caption.
 *
 * Three measurements go to the builder as findings of their own, whatever the
 * reviewer answered: a page wider than its window, a call to action that
 * begins below the first screen (`firstScreenFault`), and, for a loud design,
 * a long stretch of sections on one background (`slabFault`). Each is a
 * position or a colour read from the page, which a model shown a picture cut
 * to fit can only guess at. Others were tried against published sites and
 * left out because they could not tell a good page from a bad one: the
 * contrast of text with what is behind it, text under a fixed size, and how
 * much longer a page is on a phone (doc/DESIGN_COMPARISON_HOT_DATE.md §5c).
 * None of the three needs the reviewer, so a run that had no review has them
 * taken without one before it finishes (`measuredFaults`).
 *
 * ## Two looks per screen, and no more
 *
 * How many times a screen is looked at is tau's decision, not either model's
 * (`planReview`): the first look is a review, the second a re-check against
 * what the first one said, and there is no third.
 *
 * Needs two things an installation may lack — a headless browser and a model
 * that reads images — so `designReviewAvailable` is checked before anything
 * asks for a review. Which model is `DESIGN_REVIEW_MODEL`, and the call goes to
 * whichever client serves that model (`clientForModel`), as the director's does.
 *
 * See doc/CONTEXT_AND_MEMORY_PLAN.md §5.
 */
import type OpenAI from "openai";
import { env } from "@/lib/env";
import { clientForModel, isKimiModel, kimi } from "@/lib/kimi";
import {
  capturePageView,
  describeAction,
  measurePageView,
  type PageAction,
  type PageCapture,
  type PageFirstScreen,
  type PageMeasure,
  type PageSurface,
  type PageView,
} from "../lib/screenshot";
import { LOUD_ENERGY } from "./bands";
import { contrast, hexToOklch } from "./color";
import type { Concept } from "./types";

/**
 * A browser to take the pictures and a model to look at them. A Kimi model
 * needs the Kimi key; without it `clientForModel` would hand the pictures to
 * a client that was never meant to have them.
 */
export function designReviewAvailable(): boolean {
  return env.SCREENSHOT_ENABLED && (kimi !== null || !isKimiModel(designReviewModel()));
}

/** The model that looks. Has to be one that accepts images. */
export function designReviewModel(): string {
  return env.DESIGN_REVIEW_MODEL ?? env.KIMI_EXTRACT_MODEL;
}

/** Screens in one review. Each is two pictures. */
export const MAX_REVIEW_PATHS = 4;
/** A review, then a re-check. */
export const MAX_LOOKS_PER_SCREEN = 2;
/** Reviews in one run, however many screens the app has. */
export const MAX_REVIEWS_PER_RUN = 4;

/**
 * The two views of each screen.
 *
 * Sized for a model's eyes rather than a person's: an image much taller than
 * it is wide gets shrunk until its text cannot be read, so each view keeps the
 * top of the page — the first two or three screens — at a scale where body
 * text is still legible, rather than the whole of a long page as a ribbon.
 */
const DESKTOP: PageView = { width: 1280, height: 800, mobile: false, maxHeight: 2000, scale: 0.8 };
const PHONE: PageView = { width: 390, height: 844, mobile: true, maxHeight: 1500, scale: 1.3 };
const VIEWS = [["desktop", DESKTOP], ["phone", PHONE]] as const;

/** Pictures in one review, across all its screens. */
const MAX_PICTURES = 12;
/** Pictures of one view of one screen, however long the page is. */
const MAX_SECTIONS = 4;

/**
 * How many pictures each view of each screen may take. A long page is
 * photographed in sections, top to bottom; the fewer screens a review covers,
 * the further down each one it can go. One screen gets four pictures a view —
 * 8,000 pixels of a desktop page — and four screens get one each.
 */
export function sectionsPerView(screens: number): number {
  return Math.max(1, Math.min(MAX_SECTIONS, Math.floor(MAX_PICTURES / (Math.max(1, screens) * VIEWS.length))));
}

/** Pages photographed at once. They share one browser and one dev server. */
const CAPTURE_CONCURRENCY = 3;
// Includes time spent waiting for a turn at Moonshot (lib/kimi.ts).
const REVIEW_TIMEOUT_MS = 300_000;
const REVIEW_MAX_TOKENS = 1_200;
/** With the questions about the concept: three more lines, each of which may run long. */
const REVIEW_MAX_TOKENS_CONCEPT = 1_800;
const REVIEW_MAX_TOKENS_THINKING = 6_000;
/** A page this much wider than its window is rounding, not a fault. */
const PAGE_OVERFLOW_TOLERANCE = 8;

// ── The questions ────────────────────────────────────────────────────────────

/**
 * What the reviewer is asked. Each is a fault that is either visible in a
 * picture or is not; none asks for an opinion of the screen as a whole.
 *
 * `broken` answers must be fixed and make the verdict "fix". `polish` is the
 * one matter of taste asked about, and is optional for the builder.
 */
export const QUESTIONS = [
  {
    label: "Overflow",
    kind: "broken",
    ask: "Is any content cut off by its container or running off the side of the screen, or is a page wider than its window? Captions say when an area scrolls sideways: content stopping at the right edge of such an area is reached by scrolling and is not cut off. Captions say when a picture shows only part of a longer page: content stopping at the top or bottom edge of such a picture is not cut off.",
  },
  {
    label: "Overlap",
    kind: "broken",
    ask: "Does anything sit on top of something it should not: text over text, text running into an image, a control covering content?",
  },
  {
    label: "Missing at one width",
    kind: "broken",
    ask: "Is there something in the desktop picture of a screen with no counterpart at all in the phone picture, or the reverse? The same content arranged differently is not missing: a table that becomes stacked rows, a nav bar that becomes a menu button, anything inside an area that scrolls sideways.",
  },
  {
    label: "Unreadable",
    kind: "broken",
    ask: "Is any text too small, too pale against its background, or laid over too busy an image, to be read?",
  },
  {
    label: "Bad content",
    kind: "broken",
    ask: 'Is there placeholder text (lorem ipsum, "Feature one", "John Doe"), a broken image, an image with a watermark, or an empty area where content plainly failed to load? Embedded maps and videos from other sites often fail in these captures and work for real users: ignore them.',
  },
  {
    label: "Off-style",
    kind: "broken",
    ask: "Does a screen depart from the intended look in a way anyone would see at a glance: corners rounded where the style is square or the reverse, soft heavy shadows where it is flat, a serif where it names a sans, a second accent colour, gradient-filled text? A whole section on one of the band colours the design names is part of the look, not a second accent. Not shades of one colour, and never the size of type or the amount of spacing: neither can be judged from these pictures.",
  },
  {
    label: "Template",
    kind: "polish",
    ask: "Does a screen look like a stock template rather than something made for its subject: a centred headline over three equal cards, every section built the same way?",
  },
] as const;

/**
 * Asked only when the user gave a picture to make the app look like. Optional
 * for the builder like the other matter of taste: a difference from a
 * reference is a judgement, and the content of the two will always differ.
 */
export const REFERENCE_QUESTION = {
  label: "Reference",
  kind: "polish",
  ask: "The first picture is a reference the user gave, and the app is meant to look like it. Leave the content aside: the words, the photographs and the logos will differ. Does any screen of the app differ from the reference at a glance in what it is made of — light or dark page, the main colour, square or round corners, serif or sans type, how packed it is, how the page is arranged?",
} as const;

/**
 * Asked only of a build someone asked to be done as well as it can be (MAX
 * effort), about an app that has a concept (`design/concept.ts`), and only
 * when its opening screen is among those shown.
 *
 * The seven above ask whether a screen is broken. These ask whether it is the
 * page its concept described, which is the one thing the other questions
 * cannot get at: a page can pass all seven and still be any page of its kind.
 * Each is judged against a line of the concept, which the reviewer is shown
 * for these questions alone, so that "no" stays an answer it can give.
 *
 * Two wordings were tried on real builds (doc/DESIGN_COMPARISON_HOT_DATE.md
 * §5e), and the first is why these read as they do. Asked whether what the
 * concept names was "plainly not there", and whether any part of the page
 * "could sit unchanged on any other page of its kind", the reviewer said yes
 * on a page that had just been fixed for both: the picture was there but not
 * as described, the applicants in a list "read as fictional". So each now asks
 * whether there is nothing of the kind at all, and says that a thing of the
 * kind counts however it differs in detail. The picture the concept describes
 * is not shown to the reviewer for the same reason: it compared the two.
 *
 * All three are `polish`. What a concept asked for is a matter of taste, and a
 * model's reading of a picture is not grounds for calling a page broken.
 */
export const CONCEPT_QUESTIONS = [
  {
    label: "Opening",
    kind: "polish",
    ask: "The concept note says what the first screen of `/` shows beside its headline. Going only by what a visitor sees before scrolling, is there nothing of that kind there at all: a headline and text alone, where the note names something to show? A thing of the kind the note names counts as there, however it differs from the note in its details. If the note names nothing to show, the answer is no.",
  },
  {
    label: "Voice",
    kind: "polish",
    ask: "Going only by the first screen of `/`, its words and how it looks, would a stranger take this for a different kind of brand from the one the concept note describes: hushed where the note is loud, playful where it is severe, corporate where it is personal?",
  },
  {
    label: "Moment",
    kind: "polish",
    ask: "The concept note names one moment: the thing on `/` that only this brand would have. Is there nothing of that kind anywhere in the pictures of `/`? A thing of that kind counts as there, however it differs from the note in its details, and so does one that would only appear when something is hovered or pressed: a still picture cannot show that. What lies below the last picture of a long page is not missing. If it is missing, say which part of the page is the place for it.",
  },
] as const;

interface Question {
  label: string;
  kind: "broken" | "polish";
  ask: string;
}

/**
 * The questions a review asks: the usual seven, one about the reference when
 * there is one, and the three about the concept when the review is given it.
 */
export function questionsFor(hasReference: boolean, hasConcept = false): readonly Question[] {
  return [
    ...QUESTIONS,
    ...(hasReference ? [REFERENCE_QUESTION] : []),
    ...(hasConcept ? CONCEPT_QUESTIONS : []),
  ];
}

export function systemPrompt(hasReference = false, hasConcept = false): string {
  const questions = questionsFor(hasReference, hasConcept);
  return `You are checking screenshots of a web app as it actually renders — each screen at desktop width, then at phone width. The app's builder cannot see what it builds; your answers are how it finds out whether something is broken. A note on what the app is meant to look like comes first, so you know the intended style.

Most screens you are shown are fine. A wrong "yes" costs the builder a rewrite of a screen that worked, so answer "yes" only to what is plainly visible in a picture and "no" to everything else. "No" to every question is the usual result.

Answer these ${questions.length} questions about the screenshots as a set, in order.

${questions.map((q, i) => `Q${i + 1}. ${q.label}. ${q.ask}`).join("\n")}

Reply in plain text with exactly ${questions.length} lines, one per question, each in one of these two shapes:
Q1: no
Q1: yes — \`/route\` phone, which part of the page: what is wrong. Fix: the smallest change that fixes it.

If a question has more than one "yes", put the clearest two on its line, separated by " | ". Add nothing before or after the ${questions.length} lines. Do not report what you cannot see in the pictures, or the blue notice bar at the very top of a screenshot if there is one. A caption says when a screen is shown after someone pressed or typed something: judge it in that state. If the screenshots show an app with no data yet, judge the empty state as a user would first meet it.`;
}

function recheckRules(hasReference: boolean, hasConcept: boolean): string {
  // Taste is asked about once, on the first look.
  const taste = questionsFor(hasReference, hasConcept)
    .filter((q) => q.kind === "polish")
    .map((q) => q.label);
  return `For a re-check screen, answer "yes" only for a fault that is in the picture now: one from the earlier report that is still there, or one that was not there before. A change made to fix an earlier finding is not itself a fault — a table that now scrolls sideways or stacks, filters that now wrap onto two lines. ${
    taste.length === 1
      ? 'Answer "no" to the last question for a re-check screen.'
      : `Answer "no" to the ${taste.slice(0, -1).join(", ")} and ${taste[taste.length - 1]} questions for a re-check screen.`
  }`;
}

export type Verdict = "pass" | "fix" | "unknown";

export interface Answer {
  /** 1-based, matching `QUESTIONS`. */
  question: number;
  yes: boolean;
  /** Where, what, and the fix, as the reviewer wrote it. Empty for a "no". */
  detail: string;
}

/**
 * The reviewer's answers, read line by line. Lines that are not an answer are
 * ignored; a question it skipped is simply absent.
 *
 * @param asked  how many questions were put; an answer numbered past that is
 *               not an answer to anything
 */
export function parseAnswers(text: string, asked = QUESTIONS.length + 1): Answer[] {
  const answers: Answer[] = [];
  for (const line of text.split("\n")) {
    const m = /^\s*\**Q(\d{1,2})\**\s*[:.]\s*\**\s*(yes|no)\b\**\s*[—–:-]*\s*(.*)$/i.exec(line);
    if (!m) continue;
    const question = Number(m[1]);
    if (question < 1 || question > asked) continue;
    if (answers.some((a) => a.question === question)) continue;
    const yes = m[2]!.toLowerCase() === "yes";
    answers.push({ question, yes, detail: yes ? m[3]!.trim() : "" });
  }
  return answers;
}

/**
 * The report the builder reads: a verdict, then one numbered finding for each
 * "yes", each marked `[broken]` or `[polish]`.
 *
 * @param measured     faults tau measured itself, already written as findings
 * @param withPolish   false on a re-check, where taste is not asked about
 * @param questions    the questions that were asked, in the order asked
 */
export function composeReport(
  answers: readonly Answer[],
  measured: readonly string[] = [],
  withPolish = true,
  questions: readonly Question[] = questionsFor(true),
): { review: string; verdict: Verdict } {
  const findings = [...measured];
  for (const kind of ["broken", "polish"] as const) {
    if (kind === "polish" && !withPolish) continue;
    for (const a of answers) {
      const q = questions[a.question - 1];
      if (!q || !a.yes || q.kind !== kind) continue;
      findings.push(`[${kind}] ${q.label} — ${a.detail || "the reviewer did not say where."}`);
    }
  }
  // What must be fixed comes first, whoever found it.
  const rank = (f: string) => (f.startsWith("[broken]") ? 0 : 1);
  findings.sort((a, b) => rank(a) - rank(b));
  const verdict: Verdict = findings.some((f) => f.startsWith("[broken]")) ? "fix" : "pass";
  return {
    review: [`VERDICT: ${verdict}`, ...findings.map((f, i) => `${i + 1}. ${f}`)].join("\n"),
    verdict,
  };
}

/**
 * The verdict of a report whose answers could not be read — the reviewer
 * ignored the format. A `[broken]` mark means fix, a `[polish]` mark alone
 * means pass, and otherwise a line announcing the verdict decides.
 */
export function parseVerdict(review: string): Verdict {
  if (/\[broken\]/i.test(review)) return "fix";
  if (/\[polish\]/i.test(review)) return "pass";
  const m = /VERDICT:\s*(pass|fix)/i.exec(review);
  return m ? (m[1]!.toLowerCase() as "pass" | "fix") : "unknown";
}

export interface ReviewedScreen {
  path: string;
  /** What was done first, as words, for a screen shown after someone pressed or typed something. */
  state?: string;
  view: "desktop" | "phone";
  /** The page's full height, and how much of it the pictures show, in CSS pixels. */
  pageHeight: number;
  capturedHeight: number;
  /** How far the page is wider than its window, in CSS pixels. */
  overflowX: number;
}

export interface DesignReview {
  /** The report for the builder: a verdict and the findings. */
  review: string;
  verdict: Verdict;
  screens: ReviewedScreen[];
  /** Screens that could not be photographed, and why. */
  skipped: string[];
  /** The questions about the app's concept were asked as well. */
  concept: boolean;
  usage: { model: string; inputTokens: number; outputTokens: number };
  /** How long the pictures took, and the model. */
  captureMs: number;
  modelMs: number;
}

/** `/about`, `about`, `https://…/about` → `/about`. */
export function normalizeRoute(path: string): string {
  let p = path.trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
  } catch {
    // not a URL after all — treat it as a path
  }
  p = p.split(/[?#]/)[0] ?? "";
  if (!p.startsWith("/")) p = `/${p}`;
  return p.replace(/\/{2,}/g, "/");
}

/** The routes asked for, tidied and de-duplicated; `/` when none were. */
export function reviewRoutes(paths: unknown): string[] {
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === "string" && p.trim() !== "") : [];
  const unique = [...new Set(list.map(normalizeRoute))];
  return unique.length > 0 ? unique : ["/"];
}

// ── How many looks a screen gets ─────────────────────────────────────────────

/** A review made earlier in the same run. */
export interface PastReview {
  routes: string[];
  review: string;
}

export interface ReviewPlan {
  /** Screens being looked at for the first time. */
  fresh: string[];
  /** Screens looked at once already: checked against what was said then. */
  recheck: string[];
  /** Screens that have had both looks. Not looked at again. */
  closed: string[];
  /** Screens that did not fit in this review. */
  overLimit: string[];
  /** What was said about the re-check screens, oldest first. */
  earlier: string[];
  /** The run has had all the reviews it gets. */
  exhausted: boolean;
}

/**
 * Decide what a review request gets, given the reviews already made this run.
 * Pure, so the limits can be tested without a browser or a model.
 */
export function planReview(requested: unknown, past: readonly PastReview[]): ReviewPlan {
  const routes = reviewRoutes(requested);
  const looks = (route: string) => past.filter((p) => p.routes.includes(route)).length;

  const closed = routes.filter((r) => looks(r) >= MAX_LOOKS_PER_SCREEN);
  const open = routes.filter((r) => looks(r) < MAX_LOOKS_PER_SCREEN);
  const taken = open.slice(0, MAX_REVIEW_PATHS);
  const recheck = taken.filter((r) => looks(r) > 0);

  return {
    fresh: taken.filter((r) => looks(r) === 0),
    recheck,
    closed,
    overLimit: open.slice(MAX_REVIEW_PATHS),
    earlier: past.filter((p) => p.routes.some((r) => recheck.includes(r))).map((p) => p.review),
    exhausted: past.length >= MAX_REVIEWS_PER_RUN,
  };
}

function listed(routes: readonly string[]): string {
  return routes.map((r) => `\`${r}\``).join(", ");
}

/**
 * What the builder should do with a report, said by tau rather than left to it.
 *
 * @param thorough  the build was asked to be done as well as it can be (MAX
 *                  effort): a point of taste is then work to do, not an option.
 *                  It is still looked at once, so the cap on looks holds.
 */
export function nextStep(
  plan: Pick<ReviewPlan, "fresh" | "recheck">,
  verdict: Verdict,
  thorough = false,
): string {
  const polish = thorough
    ? "This build is at MAX effort, so take each [polish] point too: change the part it names, to what it says belongs there, without rebuilding the rest of the screen. Leave one only if it is wrong about the page. Polish is looked at once and will not be judged again."
    : null;
  if (verdict === "pass") {
    return polish
      ? `Nothing on these screens is broken, so they need no second look. ${polish}`
      : "Nothing on these screens is broken, so they need no second look. A [polish] point is optional: take it if it is a small change, leave it otherwise.";
  }
  const parts = [
    `Fix every [broken] finding with the smallest change that does it — do not rebuild a screen that mostly works. ${polish ?? "A [polish] finding is optional."}`,
  ];
  if (plan.fresh.length > 0) {
    parts.push(
      `You may call this once more for ${listed(plan.fresh)} to confirm the fixes; that will be the last look ${plan.fresh.length === 1 ? "it gets" : "they get"} this run.`,
    );
  }
  if (plan.recheck.length > 0) {
    parts.push(
      `${listed(plan.recheck)} ${plan.recheck.length === 1 ? "has" : "have"} now had both looks and will not be reviewed again this run: fix what is still listed, if it is a small change, and move on.`,
    );
  }
  return parts.join(" ");
}

/** Why nothing was looked at, when a request asks only for what it cannot have. */
export function refusal(plan: ReviewPlan): string | null {
  if (plan.exhausted) {
    return "Not reviewed: this run has had all its design reviews. Do not call this again. If the last report still lists something broken that is a small fix, make it, then finish.";
  }
  if (plan.fresh.length + plan.recheck.length === 0) {
    return `Not reviewed: a screen gets one review and one re-check in a run, and ${listed(plan.closed)} ${plan.closed.length === 1 ? "has" : "have"} had both. Do not call this again for ${plan.closed.length === 1 ? "it" : "them"}. If the last report still lists something broken that is a small fix, make it, then finish.`;
  }
  return null;
}

// ── What the reviewer is told ────────────────────────────────────────────────

/** The sections of a DESIGN.md that say what the app looks like at a glance. */
const VISIBLE_SECTIONS = ["overview", "colors", "typography", "elevation & depth", "shapes"];

/**
 * The part of a design a reviewer of pictures can use: what the app is, its
 * colours, its typefaces, its depth and its shapes.
 *
 * Left out is everything written as instruction to the builder — which
 * classes to use, which layouts are allowed, how much variance a screen should
 * have, what size the type is in pixels. None of it can be confirmed from a
 * picture, and all of it reads as a rule to find a breach of.
 *
 * A design that does not use those section names — one a user brought from
 * another tool — is passed whole.
 */
export function designForReview(prose: string): string {
  const [head, ...sections] = prose.split(/^(?=## )/m);
  const kept: string[] = [];
  for (const section of sections) {
    const title = /^## (.*)$/m.exec(section)?.[1]?.trim().toLowerCase() ?? "";
    if (!VISIBLE_SECTIONS.includes(title)) continue;
    if (title !== "typography") {
      kept.push(section);
      continue;
    }
    // The typefaces are named in a list; the paragraph after it is about sizes.
    const lines = section.split("\n");
    const faces = lines.filter((line) => line.startsWith("- "));
    kept.push(faces.length > 0 ? `${lines[0]}\n${faces.join("\n")}\n\n` : section);
  }
  if (kept.length < 2) return prose;
  return [head, ...kept]
    .join("")
    // The dials, and how loud the brand is, are instructions on how to build,
    // scored out of ten.
    .replace(/^- \*\*(?:Variance|Motion|Density|Energy) \d+\/10\*\*.*\n?/gm, "")
    // So is which class carries which colour, and how a band is written. That
    // the bands exist, and what colours they are, stays: it is what keeps one
    // from being taken for a second accent.
    .replace(/^- Colour only through tokens:.*\n?/gm, "")
    .replace(/^- A band is one class on the .*\n?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** A page that is wider than its window, said as a finding; null when it fits. */
export function pageOverflowFault(screen: Pick<ReviewedScreen, "path" | "view" | "overflowX">): string | null {
  if (screen.overflowX <= PAGE_OVERFLOW_TOLERANCE) return null;
  return `[broken] Overflow — \`${screen.path}\` ${screen.view}: tau measured the page as ${screen.overflowX}px wider than the window, so the whole page scrolls sideways. Fix: find the element that is too wide and contain it (\`min-w-0\`, \`overflow-x-auto\` on that element, or let it wrap).`;
}

/**
 * Two backgrounds closer than this are one surface at a glance. It sits
 * between the two steps a tau palette is built with: the page and its muted
 * fill, which are meant to be a shade apart, and a band, which is built to be
 * at least `BAND_APART` (1.3) from the page.
 */
const SAME_SURFACE_CONTRAST = 1.2;
/** …unless they differ in hue: two colours of one lightness are two surfaces. */
const SAME_SURFACE_CHROMA = 0.04;
/**
 * How many neighbouring sections on one surface make a stretch worth
 * mentioning. Two are often one chapter told in two parts; more than that is a
 * length of page with nothing to say where its subjects change.
 */
const SLAB_SECTIONS = 3;

function sameSurface(a: string, b: string): boolean {
  if (contrast(a, b) >= SAME_SURFACE_CONTRAST) return false;
  const p = hexToOklch(a);
  const q = hexToOklch(b);
  const rad = Math.PI / 180;
  return (
    Math.hypot(
      p.c * Math.cos(p.h * rad) - q.c * Math.cos(q.h * rad),
      p.c * Math.sin(p.h * rad) - q.c * Math.sin(q.h * rad),
    ) < SAME_SURFACE_CHROMA
  );
}

/**
 * The longest stretch of neighbouring sections that sit on what is, to the
 * eye, one background: 1-based positions, or null when no stretch is long
 * enough to mention. A section on a picture ends a stretch.
 */
export function longestSlab(surfaces: readonly PageSurface[]): { first: number; last: number } | null {
  let best: { first: number; last: number } | null = null;
  let start = 0;
  for (let i = 1; i <= surfaces.length; i++) {
    const here = surfaces[i]?.background;
    const before = surfaces[i - 1]!.background;
    if (here && before && sameSurface(here, before)) continue;
    const length = i - start;
    if (length >= SLAB_SECTIONS && (!best || length > best.last - best.first + 1)) {
      best = { first: start + 1, last: i };
    }
    start = i;
  }
  return best;
}

/** How loud a written design says its app is, or null when it does not say. */
export function energyIn(designProse: string | null): number | null {
  const m = designProse ? /\*\*Energy (\d+)\/10\*\*/.exec(designProse) : null;
  return m ? Number(m[1]) : null;
}

/**
 * A loud design whose page runs on one background, said as a finding; null
 * otherwise.
 *
 * Only ever `[polish]`, and only for a design that asks for colour: a quiet
 * page on one background is the design, and sections that belong together may
 * share one in any design. The builder is told what was measured and is left
 * to decide.
 */
export function slabFault(
  screen: Pick<ReviewedScreen, "path" | "view">,
  surfaces: readonly PageSurface[],
  energy: number | null,
): string | null {
  if (energy === null || energy < LOUD_ENERGY) return null;
  const slab = longestSlab(surfaces);
  if (!slab) return null;
  return `[polish] Bands — \`${screen.path}\` ${screen.view}: tau measured sections ${slab.first} to ${slab.last} of ${surfaces.length} as sitting on one background, or on two a shade apart. This design is loud and marks where a long page changes subject with colour. Fix: put the sections that start a new subject on a band (\`band-1\`, \`band-2\`, \`band-3\`) or on \`bg-primary\`; leave alone any that belong together.`;
}

/** A box this far past the end of the first screen is rounding, not a fault. */
const FOLD_TOLERANCE = 8;
/**
 * An action further down than this many screens is not the headline's: it
 * belongs to something lower in a tall opening section, and a visitor was
 * never meant to find it without scrolling.
 */
const HEADLINE_REACH_SCREENS = 2;

/**
 * A page whose first screen ends before its call to action begins, said as a
 * finding; null when the action is on the first screen, or the page does not
 * open with a headline and something to press.
 *
 * `[broken]`, where the other measured judgement of a design is `[polish]`,
 * because there is nothing in it to weigh: the builder put an action under
 * the headline, and a visitor cannot see it. Measured on twenty published sites
 * at both widths, every one had its action on the first screen; the page this
 * was written for had it 103 pixels below.
 *
 * It says how big the headline is and where it ends, because that is nearly
 * always what pushed the action down, and nothing about what should be on a
 * first screen besides: whether it needs a picture is the design's question.
 */
export function firstScreenFault(
  screen: Pick<ReviewedScreen, "path" | "view">,
  first: PageFirstScreen | null,
): string | null {
  // One section is a screen of an app, not a page with a first screen to keep.
  if (!first?.action || first.sections < 2) return null;
  const { fold, headline, action } = first;
  if (action.bottom <= fold + FOLD_TOLERANCE) return null;
  if (action.top >= fold * HEADLINE_REACH_SCREENS) return null;
  const what = action.words ? `"${action.words}"` : "the first thing to press";
  const lines = headline.lines === 1 ? "one line" : `${headline.lines} lines`;
  // Said as it is: a button the window cuts through is not one a visitor has
  // to go looking for.
  const where =
    action.top >= fold
      ? `as starting ${action.top}px down the page, and the first screen ends at ${fold}px, so a visitor has to scroll before there is anything to press`
      : `from ${action.top}px to ${action.bottom}px down the page, and the first screen ends at ${fold}px, so the bottom of the window cuts through it`;
  return `[broken] First screen — \`${screen.path}\` ${screen.view}: tau measured ${what} ${where}. The headline above it is set at ${headline.size}px, runs to ${lines} and ends at ${headline.bottom}px. Fix: bring the action onto the first screen by setting the headline smaller or shortening it, and by taking out space above and between; do not move the action above the headline.`;
}

/**
 * What tau measures on one route with no reviewer: the three findings above,
 * at the two widths a review uses, and no picture taken.
 *
 * For a run that had no review, which is every quick (LOW) build and every
 * build on an installation with no model that reads images. A position or a
 * colour read from the page needs a browser and nothing else, so it does not
 * have to wait for a build someone paid to have looked at
 * (`agent/finishGate.ts`).
 *
 * A width that cannot be measured is left out; the other still counts.
 */
export async function measuredFaults(
  previewUrl: string,
  path: string,
  designProse: string | null,
  measure: (url: string, view: PageView) => Promise<PageMeasure> = measurePageView,
): Promise<string[]> {
  const route = normalizeRoute(path);
  const url = `${previewUrl.replace(/\/+$/, "")}${route}`;
  const energy = energyIn(designProse);
  const taken = await Promise.all(
    VIEWS.map(async ([view, size]) => ({ view, found: await measure(url, size).catch(() => null) })),
  );
  const faults: (string | null)[] = [];
  for (const { view, found } of taken) {
    if (!found) continue;
    const screen = { path: route, view, overflowX: found.overflowX };
    faults.push(pageOverflowFault(screen), firstScreenFault(screen, found.firstScreen));
    // At desktop width, where sections lie side by side with their backgrounds.
    if (view === "desktop") faults.push(slabFault(screen, found.surfaces, energy));
  }
  const rank = (f: string) => (f.startsWith("[broken]") ? 0 : 1);
  return faults.filter((f): f is string => f !== null).sort((a, b) => rank(a) - rank(b));
}

/** Which stretch of a page a picture shows, when the page took more than one. */
export interface SectionOf {
  /** 0-based. */
  index: number;
  count: number;
  from: number;
  to: number;
}

/**
 * The line of text that goes with a picture: which screen, at what width, how
 * much of it — and what tau measured that the picture cannot show.
 */
export function screenCaption(
  screen: ReviewedScreen & { width: number; sideScrollers: readonly string[]; hasOverview?: boolean },
  recheck: boolean,
  section?: SectionOf,
): string {
  const name = `Screen \`${screen.path}\`${recheck ? " (re-check)" : ""}${screen.state ? ` after you ${screen.state}` : ""} — ${screen.view}, ${screen.width}px wide`;
  const unseen = screen.capturedHeight < screen.pageHeight;
  if (section && section.count > 1) {
    const last = section.index === section.count - 1;
    const first = `${name}, part ${section.index + 1} of ${section.count}: from ${section.from}px to ${section.to}px down a page ${screen.pageHeight}px tall.${last && unseen ? (screen.hasOverview ? " The page goes on below this picture; a shrunken view of all of it follows." : " The page goes on below this picture.") : ""}`;
    // What was measured is about the whole screen; say it once.
    return section.index === 0 ? [first, ...measuredLines(screen)].join("\n") : first;
  }
  const cut = unseen
    ? `the top ${screen.capturedHeight}px of a page ${screen.pageHeight}px tall`
    : "the whole page";
  return [`${name}, ${cut}.`, ...measuredLines(screen)].join("\n");
}

function measuredLines(screen: { overflowX: number; sideScrollers: readonly string[] }): string[] {
  const lines: string[] = [];
  if (screen.overflowX > PAGE_OVERFLOW_TOLERANCE) {
    lines.push(
      `Measured: the page is ${screen.overflowX}px wider than the window, so the whole page scrolls sideways. That is a fault.`,
    );
  }
  if (screen.sideScrollers.length > 0) {
    const n = screen.sideScrollers.length;
    lines.push(
      `Measured: ${n === 1 ? "one area" : `${n} areas`} on this screen ${n === 1 ? "scrolls" : "scroll"} sideways, beginning ${screen.sideScrollers.map((w) => `"${w}"`).join("; ")}. What stops at the right edge there is reached by scrolling.`,
    );
  }
  return lines;
}

/**
 * The lines of a concept a picture can be held against, and which questions
 * they are for.
 *
 * Not the whole concept, for the reason the reviewer is not given the whole
 * design: every line it is shown is a rule it will look for a breach of. The
 * idea and the five-second impression are left out as restatements of these.
 */
export function conceptNote(concept: Concept, hasReference = false): string {
  const first = QUESTIONS.length + (hasReference ? 1 : 0) + 1;
  const lines = [
    concept.voice ? `- Voice: ${concept.voice}` : "",
    concept.moment ? `- The moment: ${concept.moment}` : "",
    concept.opening ? `- The first screen: ${concept.opening}` : "",
  ].filter(Boolean);
  return `The concept note: what this app was meant to be about, decided before it was built. It is for questions ${first} to ${first + CONCEPT_QUESTIONS.length - 1} only. It says what the page is about and nothing about its style: how a thing it names is drawn is not a departure from the look, and no earlier question is answered from it.\n\n${lines.join("\n")}`;
}

/** The text the reviewer reads before the pictures. */
export function reviewBrief(input: {
  designProse: string | null;
  focus?: string;
  recheck: readonly string[];
  earlier: readonly string[];
  /** The user gave a picture to make the app look like, and it is the first one shown. */
  reference?: boolean;
  /** What the app is about, when the questions about that are being asked. */
  concept?: Concept | null;
}): string {
  const parts = [
    input.designProse
      ? `What this app is meant to look like, from its written design:\n\n${designForReview(input.designProse)}`
      : "This app has no written design, so the answer to the question about style is \"no\".",
  ];
  if (input.concept) {
    parts.push(conceptNote(input.concept, Boolean(input.reference)));
  }
  if (input.recheck.length > 0 && input.earlier.length > 0) {
    parts.push(
      `Some of the screens below are marked "re-check": ${listed(input.recheck)}. They were reviewed earlier in this build, with the report that follows, and the builder has changed them since.\n\n<earlier_report>\n${input.earlier.join("\n\n---\n\n")}\n</earlier_report>\n\n${recheckRules(Boolean(input.reference), Boolean(input.concept))}`,
    );
  }
  if (input.focus?.trim()) {
    parts.push(`The builder asks you to look in particular at: ${input.focus.trim().slice(0, 500)}`);
  }
  if (input.reference) {
    parts.push(
      "The first picture below is a reference: a screenshot the user gave, and the look this app is meant to have. The app's own screenshots come after it.",
    );
  }
  parts.push("The screenshots follow.");
  return parts.join("\n\n");
}

// ── The review itself ────────────────────────────────────────────────────────

type Part = OpenAI.Chat.Completions.ChatCompletionContentPart;

/** Run `task` over `items`, a few at a time, keeping the results in order. */
async function pooled<T, R>(items: readonly T[], size: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

/**
 * Photograph the given screens and have them reviewed.
 *
 * @param previewUrl   the app's origin, e.g. `https://5173-….e2b.app`
 * @param fresh        routes being looked at for the first time
 * @param recheck      routes looked at before, judged against `earlier`
 * @param designProse  the app's `DESIGN.md` prose, or null when it has none
 * @param focus        what the agent wants looked at in particular
 *
 * Throws when no screen could be photographed or the model returned nothing;
 * the caller turns that into a tool result.
 */
/** Most things a person does on one screen before it is looked at. */
export const MAX_ACTIONS = 3;
/** Most screens that are also looked at after something was done to them. */
export const MAX_STEP_SCREENS = 2;

/** What to do on a screen before looking at it again, for a route. */
export interface ReviewStep {
  path: string;
  actions: PageAction[];
}

/**
 * The steps a builder asked for, tidied: a route, then up to three plain
 * actions — press something by what it says, or type into a field by its
 * label. Anything else is dropped, so nothing here can be turned into a
 * script. Only routes that are being reviewed count.
 */
export function reviewSteps(raw: unknown, routes: readonly string[]): ReviewStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: ReviewStep[] = [];
  for (const item of raw) {
    if (steps.length >= MAX_STEP_SCREENS) break;
    if (!item || typeof item !== "object") continue;
    const { path, do: done } = item as { path?: unknown; do?: unknown };
    if (typeof path !== "string" || !Array.isArray(done)) continue;
    const route = normalizeRoute(path);
    if (!routes.includes(route)) continue;
    const actions: PageAction[] = [];
    for (const a of done) {
      if (actions.length >= MAX_ACTIONS || !a || typeof a !== "object") continue;
      const { click, fill, with: value } = a as { click?: unknown; fill?: unknown; with?: unknown };
      if (typeof click === "string" && click.trim()) actions.push({ click: click.trim().slice(0, 80) });
      else if (typeof fill === "string" && fill.trim() && typeof value === "string") {
        actions.push({ fill: fill.trim().slice(0, 80), with: value.slice(0, 120) });
      }
    }
    if (actions.length > 0) steps.push({ path: route, actions });
  }
  return steps;
}

export async function reviewDesign(input: {
  previewUrl: string;
  fresh: readonly string[];
  recheck?: readonly string[];
  earlier?: readonly string[];
  designProse: string | null;
  focus?: string;
  /** Things to do on some of the screens, which are then looked at in that state too. */
  steps?: readonly ReviewStep[];
  /** A picture the user gave to make the app look like. */
  reference?: { bytes: Uint8Array; mimeType: string };
  /**
   * What the app is about, for a build that is also to be judged against it
   * (`CONCEPT_QUESTIONS`). Used only when it describes a first screen and
   * that screen is among those being looked at for the first time.
   */
  concept?: Concept | null;
  /** Let the model reason before it answers. Defaults to `DESIGN_REVIEW_THINKING`. */
  thinking?: boolean;
}): Promise<DesignReview> {
  if (!designReviewAvailable()) throw new Error("No model that reads images is configured");
  const base = input.previewUrl.replace(/\/+$/, "");
  const recheck = input.recheck ?? [];
  // A tool's concept names no first screen, and its moment is something done,
  // not something a picture shows.
  const concept = input.concept?.opening && input.fresh.includes("/") ? input.concept : null;

  const steps = input.steps ?? [];
  const shots = [
    ...[...input.fresh, ...recheck].flatMap((path) =>
      VIEWS.map(([name, view]) => ({ path, name, view, actions: [] as PageAction[] })),
    ),
    // The same screens again, after something was done to them: one picture each.
    ...steps.flatMap((step) =>
      VIEWS.map(([name, view]) => ({ path: step.path, name, view, actions: step.actions })),
    ),
  ];
  const perView = sectionsPerView(input.fresh.length + recheck.length);
  const captureStart = Date.now();
  const captured = await pooled(shots, CAPTURE_CONCURRENCY, async (shot) => {
    try {
      return await capturePageView(
        `${base}${shot.path}`,
        shot.view,
        shot.actions.length > 0 ? 1 : perView,
        shot.actions,
      );
    } catch (err) {
      return err instanceof Error ? err : new Error(String(err));
    }
  });
  const captureMs = Date.now() - captureStart;

  const parts: Part[] = [];
  const screens: ReviewedScreen[] = [];
  const skipped: string[] = [];
  // Measured on a first look at a screen as it loads, at desktop width, where
  // sections lie side by side with their backgrounds rather than stacked.
  const energy = energyIn(input.designProse);
  const slabs: string[] = [];
  // Measured at both widths and on a re-check too: an action that is still
  // below the first screen is still a fault.
  const firstScreens: string[] = [];
  shots.forEach((shot, i) => {
    const result = captured[i] as PageCapture | Error;
    if (result instanceof Error) {
      skipped.push(`${shot.path} (${shot.name}): ${result.message}`);
      return;
    }
    const state = shot.actions.map(describeAction).join(", then ");
    const screen: ReviewedScreen = {
      path: shot.path,
      ...(state ? { state } : {}),
      view: shot.name,
      pageHeight: result.pageHeight,
      capturedHeight: result.capturedHeight,
      overflowX: result.overflowX,
    };
    if (shot.name === "desktop" && shot.actions.length === 0 && input.fresh.includes(shot.path)) {
      const slab = slabFault(screen, result.surfaces, energy);
      if (slab) slabs.push(slab);
    }
    const below = firstScreenFault(screen, result.firstScreen);
    if (below) firstScreens.push(below);
    result.sections.forEach((section, index) => {
      parts.push({
        type: "text",
        text: screenCaption(
          { ...screen, width: shot.view.width, sideScrollers: result.sideScrollers, hasOverview: Boolean(result.overview) },
          recheck.includes(shot.path),
          { index, count: result.sections.length, from: section.from, to: section.to },
        ) +
          (result.actionsFailed.length > 0 && index === 0
            ? `\nCould not do: ${result.actionsFailed.join("; ")} — nothing on the page has that label, so this picture shows the screen as it loads.`
            : ""),
      });
      parts.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${section.jpeg.toString("base64")}` },
      });
    });
    if (result.overview) {
      parts.push({
        type: "text",
        text: `Screen \`${shot.path}\`${state ? ` after you ${state}` : ""} — ${shot.name}: the whole page in one picture, shrunk to fit. Judge how it is arranged and whether anything lower down is missing, cut off or overlapping. The text is too small to read here and is not a fault.`,
      });
      parts.push({
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${result.overview.toString("base64")}` },
      });
    }
    screens.push(screen);
  });
  if (screens.length === 0) {
    throw new Error(`No screen could be captured. ${skipped.join("; ")}`);
  }

  const brief = reviewBrief({
    designProse: input.designProse,
    focus: input.focus,
    recheck,
    earlier: input.earlier ?? [],
    reference: Boolean(input.reference),
    concept,
  });
  // The reference is shown first, so that "the first picture" is it.
  const referencePart: Part[] = input.reference
    ? [
        {
          type: "image_url",
          image_url: {
            url: `data:${input.reference.mimeType};base64,${Buffer.from(input.reference.bytes).toString("base64")}`,
          },
        },
      ]
    : [];
  const thinking = input.thinking ?? env.DESIGN_REVIEW_THINKING;

  const model = designReviewModel();
  const modelStart = Date.now();
  const completion = await clientForModel(model).chat.completions.create(
    {
      model,
      // Reasoning counts against the limit, so it is given room.
      max_tokens: thinking ? REVIEW_MAX_TOKENS_THINKING : concept ? REVIEW_MAX_TOKENS_CONCEPT : REVIEW_MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt(Boolean(input.reference), Boolean(concept)) },
        { role: "user", content: [{ type: "text", text: brief }, ...referencePart, ...parts] },
      ],
      // This model reasons before answering unless told not to, and the
      // reasoning counts against `max_tokens`: left on, it can spend the whole
      // limit thinking and return nothing (see api/lib/attachments.ts). Off by
      // default; `DESIGN_REVIEW_THINKING` turns it on.
      ...(thinking ? {} : ({ thinking: { type: "disabled" } } as object)),
    },
    // A rate limit is waited out by the Kimi client itself, not retried here.
    { timeout: REVIEW_TIMEOUT_MS, maxRetries: 0 },
  );

  const written = completion.choices[0]?.message.content?.trim();
  if (!written) {
    throw new Error(
      `The reviewer returned nothing (finish_reason: ${completion.choices[0]?.finish_reason ?? "unknown"})`,
    );
  }

  const questions = questionsFor(Boolean(input.reference), Boolean(concept));
  const answers = parseAnswers(written, questions.length);
  // A page wider than its window is a measurement, not an opinion: it is
  // reported whether or not the reviewer said so.
  const overflowSeen = answers.some((a) => a.question === 1 && a.yes);
  const measured = [
    ...(overflowSeen ? [] : screens.map(pageOverflowFault).filter((f): f is string => f !== null)),
    ...firstScreens,
  ];
  const report =
    answers.length > 0
      ? composeReport(
          answers,
          [...measured, ...slabs],
          input.fresh.length > 0,
          questions,
        )
      : // The format was ignored; pass on what was written rather than nothing.
        { review: [...measured, written].join("\n\n"), verdict: parseVerdict([...measured, written].join("\n")) };

  return {
    ...report,
    screens,
    skipped,
    concept: Boolean(concept),
    usage: {
      model,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    },
    captureMs,
    modelMs: Date.now() - modelStart,
  };
}
