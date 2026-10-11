/**
 * Deciding what an app is about, before it is built.
 *
 * The director (`director.ts`) chooses how an app looks: a style, a colour, how
 * loud. That is not the same as what it says. Two dating apps in one style
 * with one accent are the same page until something decides that this one is a
 * door policy and that one is a slow-dating club — and left to the agent that
 * builds the app, nothing does: it is given a look, and fills it with the
 * sections a page of that kind usually has.
 *
 * So one more model call, with the look already chosen, commits to an idea:
 * what the app is about, how it talks and what it must never say, the one
 * thing a visitor would describe to a friend, what the first screen holds and
 * the picture it opens with. It is written into `.tau/DESIGN.md` as its own
 * section, where the builder reads it with every request and a later one
 * inherits it.
 *
 * ## What it is not allowed to do
 *
 * Hold anything up. It runs while the sandbox boots and the fonts install,
 * which together take longer than it does, and is waited for only at the point
 * the design file is written. Past its deadline, or on any failure, the app is
 * built without a concept section, exactly as it was before this existed.
 *
 * ## Asked twice, at once
 *
 * The model reasons before it answers unless told not to. Measured on five
 * briefs: with reasoning it took 7 to 20 seconds and its ideas were the more
 * particular ("an index of the sentences people say on the phone", where
 * without it the same brief got "one clear next step"), but one reply in eleven
 * was empty, the reasoning having used the whole token limit. Without, 2 to 3
 * seconds and every reply usable. So both are asked together and the
 * considered answer is the one used; the quick one is there for when it has
 * nothing to say. The second call is a few hundred tokens.
 *
 * Choose anything about the look. The style, the colours and the layouts are
 * settled before it is asked, and it is told what they are so that what it
 * describes can be built in them.
 *
 * ## The name and the line under it
 *
 * The same call says what the app calls itself and what it is in a sentence,
 * and tau writes those into `index.html` as the tab title and the description
 * (`apply.ts`). Eight of twelve apps built before this shipped with the
 * scaffold's title, "app", because nothing asks the builder to open that file.
 *
 * See doc/DESIGN_COMPARISON_HOT_DATE.md §5d.
 */
import { clientForModel } from "@/lib/kimi";
import { env } from "@/lib/env";
import { log } from "@/worker/lib/log";
import { energyOf } from "./bands";
import { leadLayout } from "./designMd";
import type { LayoutSpec } from "./layouts";
import { STYLES } from "./styles";
import type { Concept, DesignChoice } from "./types";

/**
 * From the moment the look is chosen. The sandbox is seeded and the fonts are
 * installed in about twenty-five seconds, and the design file is written after
 * both, so a reply inside this costs the build nothing.
 */
export const CONCEPT_TIMEOUT_MS = 22_000;
/** About what the model writes in that time, reasoning included. */
const CONSIDERED_MAX_TOKENS = 5_000;
const QUICK_TIMEOUT_MS = 12_000;
const QUICK_MAX_TOKENS = 900;
const MAX_BRIEF_CHARS = 4_000;

/** The longest each part may be. Together they are a paragraph, read with every request. */
const LIMITS = {
  title: 60,
  description: 160,
  idea: 220,
  voice: 280,
  moment: 220,
  opening: 220,
  picture: 280,
  glance: 120,
} as const;

/** The instructions. `page` and `app` are the structures the app would open with as either. */
export function conceptPrompt(choice: DesignChoice): string {
  const style = STYLES[choice.style];
  const page = leadLayout(style, choice.read, "page");
  const app = leadLayout(style, choice.read, "app");
  const structure = (l: LayoutSpec) => `${l.name} (${l.summary.replace(/\.$/, "").split(". ")[0]})`;

  return `You are the creative director for an app builder. A web app is about to be built from the brief you are given. How it looks is already decided. Decide what it is about: the one idea that makes it this brand's, and not a template with the name changed.

The safe version of this exists a thousand times over, and it is what gets built when nobody decides. Commit to one specific idea and say it plainly. Take everything from the world of this brief — its subject, the people it is for, the words they use — and nothing from what websites usually say.

What is already decided, which your answer has to fit:
- The look: ${style.name} — ${style.look}
- It opens ${choice.mode}, and the brand is ${energyOf(choice)}/10 for loudness (1 hushed, 5 plain-spoken, 10 brash). A quiet brand's idea is quiet and exact; a loud one's is loud. Do not turn the volume up or down.
- If it is a page, its first screen is built as: ${structure(page)}. If it is a tool: ${structure(app)}.

Reply with:
- kind: "page" if people read it and decide — a landing page, a site, a portfolio, a menu, an article — or "app" if people operate it — a tool, a tracker, a dashboard, a game.
- title: the words for the browser tab: what it calls itself, then a dash and what it is. Use the name the brief gives; if it gives none, describe it plainly rather than inventing a brand. Under ${LIMITS.title} characters.
- description: one sentence for a search result or a shared link: what it is and who it is for, in its own voice. Under ${LIMITS.description} characters.
- idea: a name for the idea in a few words, then a colon, then one sentence on what it means for this app.
- voice: one sentence on how it talks to people. Then one sentence beginning "Never" on what it must not be. A brand that teases, mocks or provokes aims at what people choose — effort, taste, excuses, behaviour — and never at a body, an age, a race, a religion, a disability or anything else a person did not choose; say so in its own terms when the brief is that kind of brand.
- moment: the one thing someone would describe to a friend afterwards, that only this app would have. For a page, something shown as an object in its own right, with real content in it. For a tool, the one interaction that has to feel right. Concrete enough to build from this sentence alone.
- opening: for a page, what the first screen says and shows: the angle the headline takes (not its wording) and the one thing beside it, fitted to the structure named above. For a tool, null.
- picture: for a page, the one photograph it opens with, described so that a picture researcher could find it in a photo library: who or what is in it, where, in what light, how it is framed, what mood. Describe a scene, not a category, and one that exists to be found — people, a place, an object — rather than one that would have to be staged for this brand. Or the single word "none" followed by a few words of why, only when the first screen shows an object built for it — the moment itself — that a photograph beside it would compete with. Words and colour alone are not a reason, and a brand that is about people, a place, food or something made is not one to leave without a picture. For a tool, null.
- glance: what a stranger should think five seconds after it loads, as their own thought, in quotation marks.

Each of idea, moment and opening is one or two plain sentences of at most 30 words; voice and picture may run to 40. A sentence that runs over is cut off, so stop in time. No lists, no markdown, and no word of praise for the idea itself. Name no colour and no typeface: those are chosen already, and a colour named here would be a second accent nobody chose.

Reply with one JSON object and nothing else:
{"kind": "page", "title": "…", "description": "…", "idea": "…: …", "voice": "… Never …", "moment": "…", "opening": "…", "picture": "…", "glance": "\\"…\\""}`;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").replace(/^[-*\s]+/, "").trim();
  if (clean.length < 3 || /^(?:null|none|n\/a)\.?$/i.test(clean)) return undefined;
  if (clean.length <= max) return clean;
  // Cut at the end of a sentence where there is one, so nothing stops mid-thought.
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * The model's reply as a concept, or null when it does not say what the app is
 * about. Lenient about the rest: a part that is missing or unusable is left
 * out, and a page with no picture named is simply told nothing about one.
 */
export function parseConceptReply(reply: string): Concept | null {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;

  const idea = text(raw.idea, LIMITS.idea);
  if (!idea) return null;
  const kind = raw.kind === "page" || raw.kind === "app" ? raw.kind : undefined;
  const page = kind !== "app";
  const picture = typeof raw.picture === "string" && /^none\b/i.test(raw.picture.trim())
    ? raw.picture.replace(/\s+/g, " ").trim().slice(0, LIMITS.picture)
    : text(raw.picture, LIMITS.picture);
  const parts = {
    kind,
    title: text(raw.title, LIMITS.title),
    description: text(raw.description, LIMITS.description),
    voice: text(raw.voice, LIMITS.voice),
    moment: text(raw.moment, LIMITS.moment),
    opening: page ? text(raw.opening, LIMITS.opening) : undefined,
    picture: page ? picture : undefined,
    glance: text(raw.glance, LIMITS.glance),
  };
  return {
    idea,
    ...Object.fromEntries(Object.entries(parts).filter(([, value]) => value !== undefined)),
  };
}

export interface Conceived {
  concept: Concept | null;
  /** What the call cost, when one was made — the caller meters it. */
  usage: { model: string; inputTokens: number; outputTokens: number } | null;
}

/**
 * Decide the concept for a new app. Never throws and never takes longer than
 * `CONCEPT_TIMEOUT_MS`: the quick answer, if it is the one needed, is long
 * since in.
 *
 * @param brief   what is being built, as the director was given it
 * @param choice  the look that was chosen for it
 */
export async function conceive(brief: string, choice: DesignChoice, projectId: string): Promise<Conceived> {
  const said = brief.trim().slice(0, MAX_BRIEF_CHARS);
  if (!said || !env.DESIGN_CONCEPT) return { concept: null, usage: null };

  const messages = [
    { role: "system" as const, content: conceptPrompt(choice) },
    { role: "user" as const, content: `The brief:\n\n${said}\n\n${choice.read}` },
  ];
  const started = Date.now();
  // Both at once. The quick one is back in three seconds and is only used if
  // the considered one, which is the better of the two, comes back with nothing.
  const quick = ask(messages, false);
  const considered = await ask(messages, true);
  const answer = considered.concept ? considered : await quick;
  const other = considered.concept ? await quick : considered;

  log.info("design.concept", {
    projectId,
    made: answer.concept !== null,
    considered: considered.concept !== null,
    kind: answer.concept?.kind ?? null,
    picture: answer.concept?.picture ? !/^none\b/i.test(answer.concept.picture) : null,
    ms: Date.now() - started,
    ...(considered.concept ? {} : { why: considered.why }),
  });
  const spent = [answer.usage, other.usage].filter((u) => u !== null);
  return {
    concept: answer.concept,
    usage:
      spent.length > 0
        ? {
            model: env.DEEPSEEK_MODEL_FLASH,
            inputTokens: spent.reduce((sum, u) => sum + u.inputTokens, 0),
            outputTokens: spent.reduce((sum, u) => sum + u.outputTokens, 0),
          }
        : null,
  };
}

/** One attempt, with the model's reasoning on or off. Never throws. */
async function ask(
  messages: { role: "system" | "user"; content: string }[],
  thinking: boolean,
): Promise<Conceived & { why?: string }> {
  const model = env.DEEPSEEK_MODEL_FLASH;
  try {
    const completion = await clientForModel(model).chat.completions.create(
      {
        model,
        // Reasoning counts against the limit, so it is given room.
        max_tokens: thinking ? CONSIDERED_MAX_TOKENS : QUICK_MAX_TOKENS,
        temperature: 1,
        response_format: { type: "json_object" },
        ...(thinking ? {} : ({ thinking: { type: "disabled" } } as object)),
        messages,
      },
      { timeout: thinking ? CONCEPT_TIMEOUT_MS : QUICK_TIMEOUT_MS, maxRetries: 0 },
    );
    const concept = parseConceptReply(completion.choices[0]?.message.content ?? "");
    return {
      concept,
      usage: {
        model,
        inputTokens: completion.usage?.prompt_tokens ?? 0,
        outputTokens: completion.usage?.completion_tokens ?? 0,
      },
      ...(concept ? {} : { why: `nothing usable (finish_reason: ${completion.choices[0]?.finish_reason ?? "unknown"})` }),
    };
  } catch (err) {
    return { concept: null, usage: null, why: String(err).slice(0, 160) };
  }
}
