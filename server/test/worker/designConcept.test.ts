import { describe, expect, test } from "bun:test";
import { readIdentity } from "@/api/lib/appIdentity";
import { designFiles, designProse, resolveDesign } from "@/worker/design";
import { applyDesignTo, isScaffoldTitle, namedHtml, type DesignTarget } from "@/worker/design/apply";
import { conceptPrompt, parseConceptReply } from "@/worker/design/concept";
import { describeDesign } from "@/worker/design/config";
import {
  CONCEPT_HEADING,
  DESIGN_PATH,
  DESIGN_PROSE_MAX_CHARS,
  conceptOf,
  leadLayout,
  readDesignMeta,
} from "@/worker/design/designMd";
import { parseImportedDesign } from "@/worker/design/importDesign";
import { keptNotes, readOf, restyledChoice } from "@/worker/design/restyle";
import { designForReview } from "@/worker/design/review";
import { ALL_STYLES, STYLES } from "@/worker/design/styles";
import type { Concept, DesignChoice, StyleKey } from "@/worker/design/types";
import { readDoc } from "@/worker/agent/docs";

// A style and a colour say how an app looks. Nothing said what it was about,
// so two apps on one subject came out as one page, and the builder filled a
// look with the sections a page of that kind usually has. One more model call
// when an app is created decides that (doc/DESIGN_COMPARISON_HOT_DATE.md §5d):
// the idea, the voice and what it must never be, the one thing a visitor would
// describe afterwards, the first screen and the picture on it. The same call
// names the app, because eight of twelve apps built before it shipped with the
// scaffold's tab title, "app".

const READ = "Reading this as: a dating app for the very attractive, which should feel sharp and unapologetic.";

// What the model returned for the brief this was written for, on its first run.
const REPLY = {
  kind: "page",
  title: "Hot Date — The Velvet Rope Dating App",
  description:
    "Hot Date is a dating app for people who already know they're hot. Apply, get roasted by the door, and maybe get in.",
  idea: "Bouncer-voiced velvet rope: the page is a door with a personality, and the only call to action is to prove you belong on the other side of it.",
  voice:
    "Talks like a bored bouncer who already read your profile, roasting bad bios, lazy photos and recycled captions. Never targets age, race, body, disability or religion — only effort, taste and excuses.",
  moment:
    "A rejection card you can screenshot, with a thick border, a stamp, and a real roast: 'Your bio says adventurous. Your photos say DMV.'",
  opening: "The headline is a verdict, not an invitation, beside a queue ticket stamped pending with a one-line roast.",
  picture:
    "Close-up of a doorman's forearm and clipboard at a rope outside a club, harsh flash, cropped so only the rope and a stamped hand are sharp.",
  glance: '"This app would reject me and I kind of want to prove it wrong."',
};
const CONCEPT = parseConceptReply(JSON.stringify(REPLY))!;

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
const mdFor = (choice: DesignChoice) => designFiles(resolveDesign(choice), { fontsInstalled: true }).designMd;

describe("reading the model's reply", () => {
  test("every part is kept, as one line each", () => {
    expect(CONCEPT).toEqual(REPLY as Concept);
  });

  test("a reply that does not say what the app is about is no concept", () => {
    expect(parseConceptReply(JSON.stringify({ ...REPLY, idea: "" }))).toBeNull();
    expect(parseConceptReply(JSON.stringify({ title: "Hot Date" }))).toBeNull();
    expect(parseConceptReply("I would suggest a velvet rope.")).toBeNull();
    expect(parseConceptReply("{not json}")).toBeNull();
  });

  test("anything else may be missing, and what is missing is left out rather than filled in", () => {
    const bare = parseConceptReply(JSON.stringify({ idea: REPLY.idea, voice: null, moment: 7, glance: "" }))!;
    expect(bare).toEqual({ idea: REPLY.idea });
    // Wrapped in prose or a code fence, as models sometimes do.
    expect(parseConceptReply("```json\n" + JSON.stringify(REPLY) + "\n```")!.idea).toBe(REPLY.idea);
  });

  test("a tool has no first screen to describe and no photograph to open with", () => {
    const tool = parseConceptReply(JSON.stringify({ ...REPLY, kind: "app" }))!;
    expect(tool.kind).toBe("app");
    expect(tool.opening).toBeUndefined();
    expect(tool.picture).toBeUndefined();
    expect(tool.moment).toBe(REPLY.moment);
  });

  test("a page that is better without a photograph says so, and why", () => {
    const typeOnly = parseConceptReply(JSON.stringify({ ...REPLY, picture: "none: the verdict in type is the picture" }))!;
    expect(typeOnly.picture).toBe("none: the verdict in type is the picture");
    // "null" and "n/a" are not a reason; they are nothing.
    expect(parseConceptReply(JSON.stringify({ ...REPLY, picture: "null" }))!.picture).toBeUndefined();
    expect(parseConceptReply(JSON.stringify({ ...REPLY, opening: "N/A" }))!.opening).toBeUndefined();
  });

  test("a part that runs long is cut at a sentence, and never mid-word", () => {
    const long = `${"A sentence that goes on for some time about the door. ".repeat(4)}And one more that is far too long to fit ${"x".repeat(80)}`;
    const idea = parseConceptReply(JSON.stringify({ ...REPLY, idea: long }))!.idea;
    expect(idea.length).toBeLessThanOrEqual(220);
    expect(idea.endsWith("door.")).toBe(true);
    const oneRun = parseConceptReply(JSON.stringify({ ...REPLY, idea: `One idea ${"word ".repeat(80)}` }))!.idea;
    expect(oneRun.length).toBeLessThanOrEqual(221);
    expect(oneRun.endsWith("word…")).toBe(true);
    // A title is for a browser tab.
    expect(parseConceptReply(JSON.stringify({ ...REPLY, title: `Hot Date — ${"very ".repeat(30)}selective` }))!.title!.length).toBeLessThanOrEqual(61);
  });

  test("line breaks and list marks do not survive into the design file", () => {
    const messy = parseConceptReply(JSON.stringify({ ...REPLY, voice: "- Blunt.\n  Never cruel." }))!;
    expect(messy.voice).toBe("Blunt. Never cruel.");
  });
});

describe("what the model is asked", () => {
  const choice = choiceFor("brutalist", { energy: 9 });
  const prompt = conceptPrompt(choice);

  test("it is told the look, how loud the brand is, and the structures it has to fit", () => {
    expect(prompt).toContain(`The look: Brutalist — ${STYLES.brutalist.look}`);
    expect(prompt).toContain("the brand is 9/10 for loudness");
    expect(prompt).toContain(`If it is a page, its first screen is built as: ${leadLayout(STYLES.brutalist, READ, "page").name} (`);
    expect(prompt).toContain(`If it is a tool: ${leadLayout(STYLES.brutalist, READ, "app").name} (`);
    // Told, not asked: the look is not this call's to change.
    expect(prompt).toContain("Name no colour and no typeface");
    expect(prompt).toContain("Do not turn the volume up or down");
  });

  test("a brand that mocks is told what it may aim at", () => {
    expect(prompt).toContain("aims at what people choose");
    expect(prompt).toContain("never at a body, an age, a race, a religion, a disability");
  });

  test("the picture is one that can be found, or none with a reason", () => {
    expect(prompt).toContain("described so that a picture researcher could find it in a photo library");
    expect(prompt).toContain("Describe a scene, not a category");
    expect(prompt).toContain('Or the single word "none" followed by a few words of why');
  });

  test("it gives no example of an idea to copy", () => {
    // An example in a prompt is what every answer then resembles.
    expect(prompt).not.toMatch(/velvet|bouncer|for example|e\.g\./i);
  });
});

describe("the concept in the design file", () => {
  const md = mdFor(choiceFor("brutalist", { energy: 9, concept: CONCEPT }));
  const prose = designProse(md);

  test("has a section of its own, after what the app is and before how it is coloured", () => {
    const at = prose.indexOf(CONCEPT_HEADING);
    expect(at).toBeGreaterThan(prose.indexOf("## Overview"));
    expect(at).toBeLessThan(prose.indexOf("## Colors"));
    for (const line of [
      `- **Idea** — ${REPLY.idea}`,
      `- **Voice** — ${REPLY.voice}`,
      `- **The moment** — ${REPLY.moment}`,
      `- **Opens with** — ${REPLY.opening}`,
      `- **Picture** — ${REPLY.picture}`,
      `- **At a glance** — ${REPLY.glance}`,
    ]) {
      expect(prose).toContain(line);
    }
    expect(prose).toContain("It stays when the style changes.");
  });

  test("the title and the description are for index.html, not for every request", () => {
    expect(md).not.toContain(REPLY.title);
    expect(md).not.toContain(REPLY.description);
  });

  test("an app with no concept has no such section, and its file is as it was", () => {
    const plain = mdFor(choiceFor("brutalist", { energy: 9 }));
    expect(plain).not.toContain(CONCEPT_HEADING);
    expect(plain).toContain("If this is a page people read, it opens with **");
    expect(conceptOf(plain)).toBeNull();
    expect(conceptOf(null)).toBeNull();
  });

  test("knowing which it is, the file names the one structure it opens with", () => {
    const page = leadLayout(STYLES.brutalist, READ, "page").name;
    expect(prose).toContain(`This page opens with **${page}**: build its first screen that way`);
    expect(prose).not.toContain("If this is a page people read");
    const tool = designProse(mdFor(choiceFor("brutalist", { concept: { ...CONCEPT, kind: "app" } })));
    expect(tool).toContain(`This app opens with **${leadLayout(STYLES.brutalist, READ, "app").name}**`);
    expect(readDesignMeta(md)!.kind).toBe("page");
    expect(describeDesign(md)!.style).toBe("brutalist");
  });

  test("fits what is sent with every request, at its fullest, in every style", () => {
    const fullest: Concept = {
      kind: "page",
      idea: "i".repeat(220),
      voice: "v".repeat(280),
      moment: "m".repeat(220),
      opening: "o".repeat(220),
      picture: "p".repeat(280),
      glance: "g".repeat(120),
    };
    const longRead = `Reading this as: ${"a very particular kind of shop ".repeat(11)}for people, which should feel a, b and c.`;
    for (const style of ALL_STYLES) {
      const text = designProse(mdFor(choiceFor(style.key, { concept: fullest, read: longRead, energy: 9 })));
      expect([style.key, text.length < DESIGN_PROSE_MAX_CHARS]).toEqual([style.key, true]);
      expect(text).not.toContain("is cut here to save space");
    }
  });

  test("a reviewer of pictures is not given it: none of it can be seen in one", () => {
    const shown = designForReview(prose);
    expect(shown).not.toContain(CONCEPT_HEADING);
    expect(shown).not.toContain("**The moment**");
    expect(shown).toContain("## Colors");
  });
});

describe("the concept belongs to the app, not to its style", () => {
  const before = mdFor(choiceFor("brutalist", { energy: 9, concept: CONCEPT }));

  test("it can be read back from the file, as the file now says it", () => {
    const { title: _title, description: _description, ...kept } = CONCEPT;
    expect(conceptOf(before)).toEqual(kept);
    // Someone rewrote the voice by hand: that is the voice now.
    const edited = before.replace(`- **Voice** — ${REPLY.voice}`, "- **Voice** — Dry, never loud.");
    expect(conceptOf(edited)!.voice).toBe("Dry, never loud.");
  });

  test("a change of style keeps it, word for word", () => {
    const current = describeDesign(before)!;
    const choice = restyledChoice(current, { style: "editorial" }, readOf(before), "p", undefined, conceptOf(before));
    const after = mdFor(choice);
    expect(conceptOf(after)).toEqual(conceptOf(before));
    expect(after).toContain(`This page opens with **${leadLayout(STYLES.editorial, READ, "page").name}**`);
    expect(describeDesign(after)!.style).toBe("editorial");
    // And it is not also carried as a note under the new design.
    expect(keptNotes(before)).toEqual([]);
    expect(keptNotes(before.replace(`- **Voice** — ${REPLY.voice}`, "- **Voice** — Dry, never loud."))).toEqual([]);
  });

  test("an app with none is restyled as it always was", () => {
    const plain = mdFor(choiceFor("brutalist"));
    const choice = restyledChoice(describeDesign(plain)!, { style: "editorial" }, readOf(plain), "p", undefined, conceptOf(plain));
    expect(choice.concept).toBeUndefined();
    expect(mdFor(choice)).not.toContain(CONCEPT_HEADING);
  });

  test("a design the user brought carries it too, ahead of their own words", () => {
    const imported = parseImportedDesign("---\nname: Theirs\n---\n# Theirs\n\n## Overview\nCalm and nautical.\n");
    const md = mdFor(choiceFor("swiss", { source: "import", imported, concept: CONCEPT }));
    expect(md.indexOf(CONCEPT_HEADING)).toBeGreaterThan(md.indexOf("## In this app"));
    expect(md.indexOf(CONCEPT_HEADING)).toBeLessThan(md.indexOf("Everything below this line is the design as the user wrote it."));
    expect(conceptOf(md)!.idea).toBe(REPLY.idea);
  });
});

// ── The name ─────────────────────────────────────────────────────────────────

const SCAFFOLD = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>app</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

describe("an app that nobody has named", () => {
  test("is recognised by the title the scaffold came with", () => {
    for (const title of ["app", "App", " app ", "Vite + React + TS", "vite app", null]) {
      expect([title, isScaffoldTitle(title)]).toEqual([title, true]);
    }
    for (const title of ["Hot Date", "Apply", "Apparel by Vita", "My app"]) {
      expect([title, isScaffoldTitle(title)]).toEqual([title, false]);
    }
  });

  test("gets its title, its description and the tags a shared link is drawn from", () => {
    const html = namedHtml(SCAFFOLD, CONCEPT);
    expect(readIdentity(html)).toEqual({ title: REPLY.title, description: REPLY.description, icon: "default" });
    expect(html).toContain(`<meta property="og:title" content="${REPLY.title}" />`);
    expect(html).toContain('<meta property="og:description" content="Hot Date is a dating app for people who already know they\'re hot.');
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
    // The icon is the owner's to choose when they publish; it is not touched.
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
    expect(html).not.toContain("og:image");
    // Doing it again changes nothing.
    expect(namedHtml(html, CONCEPT)).toBe(html);
  });

  test("a name somebody wrote is theirs", () => {
    const named = SCAFFOLD.replace("<title>app</title>", "<title>Curb Dogs</title>");
    expect(namedHtml(named, CONCEPT)).toBe(named);
  });

  test("a concept with no title names nothing, and one with no description writes none", () => {
    expect(namedHtml(SCAFFOLD, { idea: REPLY.idea })).toBe(SCAFFOLD);
    const titled = namedHtml(SCAFFOLD, { idea: REPLY.idea, title: "Curb Dogs — Lisbon skate shop" });
    expect(readIdentity(titled)).toEqual({ title: "Curb Dogs — Lisbon skate shop", description: null, icon: "default" });
  });

  test("what the model wrote cannot break out of the tag it is put in", () => {
    const html = namedHtml(SCAFFOLD, { idea: "x: y", title: 'A & B </title><script>alert("x")</script>' });
    expect(html).not.toContain("<script>alert");
    expect(readIdentity(html).title).toBe('A & B </title><script>alert("x")</script>');
  });
});

// ── Applied to an app ────────────────────────────────────────────────────────

const BUTTON = `function Button({ className, variant, size, ...props }) {
  return (
    <button
      data-slot="button"
      {...props}
    />
  );
}`;

function fakeApp() {
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ dependencies: {} }),
    "index.html": SCAFFOLD,
    "src/components/ui/button.tsx": BUTTON,
  };
  const target: DesignTarget = {
    installsNow: true,
    read: async (path) => files[path] ?? null,
    write: async (path, content) => {
      files[path] = content;
    },
    addPackages: async () => ({ ok: true }),
  };
  return { files, target };
}

describe("a new app is given its concept as it is designed", () => {
  test("decided in time, it is in the design file and the app is named", async () => {
    const app = fakeApp();
    const result = await applyDesignTo(app.target, choiceFor("brutalist", { energy: 9 }), {
      concept: Promise.resolve(CONCEPT),
    });
    expect(result.applied).toBe(true);
    expect(result.concept).toEqual(CONCEPT);
    expect(app.files[DESIGN_PATH]).toContain(`- **Idea** — ${REPLY.idea}`);
    expect(readIdentity(app.files["index.html"]!).title).toBe(REPLY.title);
    // Light or dark is still set on the same page.
    expect(app.files["index.html"]).toContain(STYLES.brutalist.defaultMode === "dark" ? 'class="dark"' : '<html lang="en">');
  });

  test("not decided, the app is designed exactly as before", async () => {
    for (const concept of [Promise.resolve(null), Promise.reject(new Error("timed out")), undefined]) {
      const app = fakeApp();
      const result = await applyDesignTo(app.target, choiceFor("brutalist"), concept ? { concept } : {});
      expect(result.applied).toBe(true);
      expect(result.concept).toBeUndefined();
      expect(app.files[DESIGN_PATH]).not.toContain(CONCEPT_HEADING);
      expect(readIdentity(app.files["index.html"]!).title).toBe("app");
    }
  });

  test("a restyle carries the concept and leaves the name alone", async () => {
    const app = fakeApp();
    await applyDesignTo(app.target, choiceFor("editorial", { concept: CONCEPT }), { restyle: true });
    expect(app.files[DESIGN_PATH]).toContain(`- **Idea** — ${REPLY.idea}`);
    expect(readIdentity(app.files["index.html"]!).title).toBe("app");
  });
});

describe("the guides point at it", () => {
  test("a page is built to the concept, and opens with the picture it describes", () => {
    const sections = readDoc("sections");
    expect(sections).toContain("where it has a Concept, says what the page is about");
    expect(sections).toContain("the moment the Concept names is one of the sections, built as the thing itself");
    expect(sections).toContain("the one the Concept describes where it describes one");
  });

  test("a picture that sets a mood is searched for by its scene", () => {
    const assets = readDoc("assets");
    expect(assets).toContain("is searched for by its scene, not by what the app is");
    expect(assets).toContain("search for what it describes, and say it another way if the first search misses");
    expect(assets).toContain("A picture that is the right mood and the wrong subject is a mismatch too");
    expect(assets).toContain("**The picture a page opens with**, when the Concept describes one and two searches have found nothing like it");
  });
});
