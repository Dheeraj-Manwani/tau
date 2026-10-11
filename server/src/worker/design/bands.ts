/**
 * Bands: colour fields for whole sections of a page.
 *
 * A palette built from one accent gives a page two backgrounds to speak of —
 * the page colour and a muted step off it — and a long page built on those
 * two reads as one slab: nothing says where one subject ends and the next
 * begins. The pages people call designed mark their chapters with colour, a
 * whole section at a time. Left to do that with no colours to do it in, an
 * agent either does not, or reaches for a literal colour the design checks
 * then send back.
 *
 * So a design carries three band colours beside its palette, each a surface
 * for a full-width section and each with a text colour that reads on it:
 *
 *   - `band-1` — the accent as a deep field;
 *   - `band-2` — the page turned inside out: the other mode's page and text;
 *   - `band-3` — a second hue, bright: a neighbour of the accent, on the side
 *     the style's own second colour is (`BAND_HUE_REACH`).
 *
 * They are surfaces, not accents: the one accent still marks what to press.
 *
 * ## How much colour is the style's and the brand's, not a constant
 *
 * A band is never more saturated than its style lets the accent be, so a quiet
 * style's bands are tinted neutrals and a loud style's are blocks of colour.
 * Within that, how saturated follows how loud the brand is (`energyOf`). The
 * same number is what the builder is told about how much of a page to give to
 * bands (`designMd.ts`): nothing here, or there, counts sections.
 *
 * ## A band is a scope
 *
 * A dark field on a light page breaks everything written for the page: muted
 * text disappears, borders vanish, the primary button is the wrong colour. So
 * the stylesheet does not ask for band-aware classes inside a band. The class
 * (`band-1`) re-points the ordinary tokens for everything inside it (`css.ts`),
 * and a section on a band is built exactly as one on the page.
 *
 * Pure. See doc/DESIGN_COMPARISON_HOT_DATE.md §5B.
 */
import type { Theme } from "../templates/theme";
import { contrast, hexToOklch, oklchToHex, readableOn, type Oklch } from "./color";
import { GREY_CHROMA } from "./palette";
import type { DesignChoice, Mode, ModeRecipe, PaletteRecipe } from "./types";

export const BAND_KEYS = ["band-1", "band-2", "band-3"] as const;
export type BandKey = (typeof BAND_KEYS)[number];

/** Every band variable a design declares, in the order it is written. */
export const BAND_TOKENS = [
  "band-1",
  "band-1-foreground",
  "band-2",
  "band-2-foreground",
  "band-3",
  "band-3-foreground",
] as const;
export type BandToken = (typeof BAND_TOKENS)[number];

/** One hex value per band token. */
export type Bands = Record<BandToken, string>;

export interface BandSet {
  light: Bands;
  dark: Bands;
}

/**
 * From here up a brand is loud: the builder is told to colour-block a long
 * page (`describeEnergy`), a quiet style is not offered to it (`director.ts`),
 * and a page left on one background is mentioned (`review.ts`).
 */
export const LOUD_ENERGY = 7;

/** A band has to be seen as a different surface from the page it sits on. */
const BAND_APART = 1.3;

/**
 * How far round the wheel from the accent the second hue may sit, in degrees.
 *
 * It used to be the style's whole move, which in a loud style is most of the
 * way across: a red brand in Brutalist had a mint-green section, a red one in
 * Swiss a cyan one. A chart needs its colours far apart, because they have to
 * be told from each other at a glance. A page's sections do not: a whole
 * section in the accent's opposite reads as another brand's, where one in its
 * neighbour (amber beside red, violet beside blue) reads as a second colour of
 * the same one. Chosen by eye from every loud style drawn with seven accents;
 * at 90 a red's neighbour is already olive. Styles that sat at 60 or nearer
 * keep what they had (doc/DESIGN_COMPARISON_HOT_DATE.md §5g).
 */
export const BAND_HUE_REACH = 60;

/**
 * Pink-red round to yellow, by OKLCH hue: the warm side of the wheel. It ends
 * just past yellow (92): by 110 a colour is already a green-yellow.
 */
function isWarm(hue: number): boolean {
  const h = ((hue % 360) + 360) % 360;
  return h >= 340 || h <= 100;
}

/**
 * The hue of the second band: a neighbour of the accent's.
 *
 * A style's first chart colour after the accent is its own idea of a second
 * colour — close by in a quiet style, across the wheel in a loud one — and the
 * band leans the way it does, no further than `BAND_HUE_REACH`.
 *
 * And it stays on the accent's side of the wheel. Sixty degrees is not the
 * same distance everywhere: from red it is amber, and from yellow it is green.
 * The first real page built with the reach alone had a gold accent and a
 * mint-green closing section, which is the clash the reach was there to end.
 * So a step that would cross from warm to cool, or back, is taken the other
 * way round instead.
 */
export function neighbourHue(accentHue: number, own: number): number {
  const reach = Math.min(Math.abs(own), BAND_HUE_REACH);
  const lean = own < 0 ? -1 : 1;
  const there = accentHue + lean * reach;
  if (isWarm(there) === isWarm(accentHue)) return there;
  const back = accentHue - lean * reach;
  return isWarm(back) === isWarm(accentHue) ? back : there;
}

/**
 * How loud an app is, 1 (hushed) to 10 (brash).
 *
 * What the director read from the brief, when it read one. Otherwise the two
 * dials that already say how loud a look is — how surprising its compositions
 * are and how much it moves — so a style picked by hand, a feel the user set,
 * and an app designed before this was recorded all still have an answer.
 */
export function energyOf(choice: Pick<DesignChoice, "energy" | "dials">): number {
  const energy = choice.energy ?? (choice.dials.variance + choice.dials.motion) / 2;
  return Math.min(10, Math.max(1, Math.round(energy)));
}


/** Move a colour's lightness one way until it stands apart from `from`. */
function apart(color: Oklch, from: string, step: number): Oklch {
  let moved = color;
  for (let i = 0; i < 20 && contrast(oklchToHex(moved), from) < BAND_APART; i++) {
    moved = { ...moved, l: Math.min(1, Math.max(0, moved.l + step)) };
  }
  return moved;
}

function buildModeBands(
  recipe: ModeRecipe,
  mode: Mode,
  accent: Oklch,
  secondHue: number,
  strength: number,
  theme: Theme,
): Bands {
  const page = theme[mode].background;
  const inverse = theme[mode === "light" ? "dark" : "light"];
  // The same ceiling the accent itself is held to (`palette.ts`): a style that
  // mutes its accent mutes its bands.
  const ceiling =
    accent.c < GREY_CHROMA ? 0 : Math.min(recipe.primary.c, Math.max(accent.c, 0.06) * 1.25);

  // Dark enough to take light text in either mode; on a dark page it is
  // lifted until it can be told from the page.
  const deep = oklchToHex(
    apart(
      { l: mode === "light" ? 0.32 : 0.3, c: ceiling * (0.45 + 0.55 * strength), h: accent.h },
      page,
      mode === "light" ? -0.02 : 0.02,
    ),
  );
  // Bright, for dark text: the one band that is a highlight rather than a ground.
  const second = oklchToHex({
    l: mode === "light" ? 0.8 : 0.78,
    c: ceiling * (0.3 + 0.7 * strength),
    h: secondHue,
  });

  return {
    "band-1": deep,
    "band-1-foreground": readableOn(deep),
    // Both already designed, and already checked against each other.
    "band-2": inverse.background,
    "band-2-foreground": inverse.foreground,
    "band-3": second,
    "band-3-foreground": readableOn(second),
  };
}

/**
 * The band colours for an app, in both modes.
 *
 * @param theme  the app's palette, which the bands are placed against
 */
export function buildBands(
  recipe: PaletteRecipe,
  choice: Pick<DesignChoice, "accent" | "energy" | "dials">,
  theme: Theme,
): BandSet {
  const accent = hexToOklch(choice.accent);
  const strength = (energyOf(choice) - 1) / 9;
  const secondHue = neighbourHue(accent.h, recipe.chartHues[0]);
  return {
    light: buildModeBands(recipe.light, "light", accent, secondHue, strength, theme),
    dark: buildModeBands(recipe.dark, "dark", accent, secondHue, strength, theme),
  };
}
