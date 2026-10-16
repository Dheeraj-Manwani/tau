import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { MoonIcon, PaletteIcon, SunIcon, WandSparklesIcon, XIcon } from "lucide-react";

import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import { cn } from "@/src/lib/utils";
import { ApiError } from "@/src/lib/api-client";
import {
  useProjectTheme,
  useThemeEdit,
  type ThemeScope,
} from "@/src/features/project/api";
import { useProjectStore } from "@/src/stores/useProjectStore";
import {
  useProjectDesign,
  type RestyleResponse,
} from "@/src/features/design/api";
import { RestyleDialog } from "@/src/features/design/RestyleDialog";
import { useSendMessage } from "@/src/features/project/useSendMessage";

/**
 * The theme variables the panel offers, grouped the way someone thinks about
 * them rather than the way the stylesheet declares them.
 *
 * Mirrors `THEME_TOKENS` in `server/src/api/lib/themeEdit.ts`: the server
 * validates against its own list, so a name only in one place is a control that
 * always fails. Kept short on purpose: these are the knobs that visibly change
 * an app, not every variable the shadcn palette defines.
 *
 * The grouping matters more than it looks. Eleven flat swatches called
 * "Primary", "On primary", "Muted" and "Muted text" is a list you have to read
 * twice to find anything in; four short groups is one you can scan.
 */
const GROUPS: { title: string; tokens: { name: string; label: string }[] }[] = [
  {
    title: "Brand",
    tokens: [
      { name: "--primary", label: "Primary" },
      { name: "--primary-foreground", label: "On primary" },
      { name: "--accent", label: "Accent" },
      { name: "--ring", label: "Focus ring" },
    ],
  },
  {
    title: "Surface",
    tokens: [
      { name: "--background", label: "Background" },
      { name: "--card", label: "Card" },
      { name: "--muted", label: "Muted" },
      { name: "--border", label: "Border" },
    ],
  },
  {
    title: "Text",
    tokens: [
      { name: "--foreground", label: "Body text" },
      { name: "--muted-foreground", label: "Muted text" },
    ],
  },
  {
    title: "Alerts",
    tokens: [{ name: "--destructive", label: "Danger" }],
  },
];

/** Stepped, like the style vocabulary: one click, one commit, no drag state. */
const RADIUS_STEPS = [
  { label: "Square", value: "0" },
  { label: "SM", value: "0.25rem" },
  { label: "MD", value: "0.5rem" },
  { label: "LG", value: "0.625rem" },
  { label: "XL", value: "1rem" },
  { label: "Round", value: "1.5rem" },
];

/**
 * Pending values are keyed by palette as well as token.
 *
 * `--background` is `#ffffff` in light and `#121212` in dark; a key of just the
 * token name would show a colour picked for one palette on the other's tab.
 */
function pendingKey(scope: ThemeScope, name: string): string {
  return `${scope}|${name}`;
}

function dropKey(
  map: Record<string, string>,
  key: string,
): Record<string, string> {
  if (!(key in map)) return map;
  const next = { ...map };
  delete next[key];
  return next;
}

/**
 * One colour, as a tile you can obviously click.
 *
 * The previous version put a 20px swatch and a text label inside a bare
 * `<label>` in a grid cell. A `<label>` forwards every click to its input, and
 * that one stretched the full column width: so clicking in the empty space
 * beside "Border" opened the colour picker for it, with nothing on screen to
 * suggest it would. The click target was right; it was invisible.
 *
 * The fix is not to shrink the target but to draw it. The whole tile is
 * bordered, has a hover state, and shows the value it holds: so a large hit
 * area reads as generous rather than as a trap. Staged tiles keep the accent
 * border after the pointer leaves, which is the only thing on screen that says
 * what Save is about to write.
 */
function SwatchTile({
  label,
  name,
  value,
  staged,
  disabled,
  onPick,
}: {
  label: string;
  name: string;
  value: string;
  staged: boolean;
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <label
      title={`${name}: ${value}`}
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-md border bg-space-surface px-3 py-2 transition-colors duration-150",
        disabled ? "cursor-default opacity-40" : "cursor-pointer hover:border-line-strong",
        staged ? "border-blue-500" : "border-line",
      )}
    >
      {/* The native picker is the right control here: it is the one widget
          users already know, and it only ever emits #rrggbb: exactly the form
          the server will accept. The pseudo-element rules strip the chrome
          browsers wrap it in so it reads as a swatch, not as an input. */}
      <input
        type="color"
        value={toPickerValue(value)}
        disabled={disabled}
        onChange={(e) => onPick(e.target.value)}
        aria-label={label}
        className="size-[22px] shrink-0 cursor-[inherit] rounded-xs border-0 bg-transparent p-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] [&::-moz-color-swatch]:rounded-xs [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-xs [&::-webkit-color-swatch]:border-0"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[12.5px] font-medium text-silver-900">
          {label}
        </span>
        <span
          className={cn(
            "truncate font-mono text-[11px]",
            staged ? "text-blue-500" : "text-silver-500",
          )}
        >
          {value}
        </span>
      </span>
    </label>
  );
}

/** `<input type="color">` only accepts `#rrggbb`. */
function toPickerValue(value: string | undefined): string {
  if (!value) return "#000000";
  // Six digits first: tried the other way round, the three-digit branch
  // matches the start of every six-digit colour and `#be123c` becomes `#bbee11`.
  const m = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/.exec(value.trim());
  if (!m?.[1]) return "#000000";
  const hex = m[1];
  return hex.length === 3
    ? `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    : `#${hex}`;
}

/**
 * Global theme editing: the one visual edit that isn't about an element.
 *
 * Change `--primary` once and every `bg-primary`, `text-primary` and
 * `ring-primary` in the app moves with it. That is why the style panel offers
 * theme tokens ahead of raw palette colours: an element styled `bg-primary`
 * follows this panel, an element styled `bg-red-500` never will.
 *
 * Light and dark are edited separately and deliberately never together: they
 * hold genuinely different values, so an "apply to both" convenience would
 * flatten light mode the first time anyone changed a background. The panel
 * opens on whichever palette the app itself opens in — editing the other one
 * changes nothing the user can see in the preview.
 */
export function VisualThemePanel({ onClose }: { onClose: () => void }) {
  const projectId = useProjectStore((s) => s.projectId);
  const theme = useProjectTheme(projectId ?? undefined);
  const themeEdit = useThemeEdit(projectId ?? undefined);

  // The look as a whole — the style these colours belong to. Changing it
  // regenerates the stylesheet this panel edits, so the two live together.
  const design = useProjectDesign(projectId ?? undefined);
  const [restyleOpen, setRestyleOpen] = useState(false);
  const [restyled, setRestyled] = useState<RestyleResponse | null>(null);
  const { send, canSend } = useSendMessage(projectId ?? undefined);

  // Null until the user picks a tab; until then, follow the app.
  const [scopeChoice, setScope] = useState<ThemeScope | null>(null);
  const scope: ThemeScope = scopeChoice ?? theme.data?.activeScope ?? "dark";

  /**
   * Values the user has picked, held here until they hit Save.
   *
   * Staged rather than written as they are chosen. `<input type="color">` fires
   * its change event on every frame of a drag, and each write is a file write,
   * an R2 write and a `USER_EDIT` message the agent reads on its next turn -
   * so an auto-committing panel turned choosing one colour into a commit
   * history nobody wanted, and choosing five into a race between their own
   * `baseHash` chains.
   *
   * The trade this makes: the preview no longer changes until Save. Nothing
   * here can push a value into the iframe without writing the file, so live
   * feedback and one-commit-per-intent cannot both be had until the runtime
   * learns to preview a theme (doc/archive/VISUAL_EDIT_PROMPTING.md §7.7).
   */
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /**
   * The hash of `src/index.css` as we last knew it.
   *
   * Not read from the query: after a successful edit the query's copy is stale
   * until its refetch lands, so sending it as `baseHash` would 409 every rapid
   * second edit. The response carries the new hash, so track that instead: the
   * stale-file guard stays on, and it guards against the agent rather than
   * against us.
   */
  const hashRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (theme.data) hashRef.current = theme.data.contentHash;
  }, [theme.data]);

  const palette = theme.data
    ? scope === "dark"
      ? theme.data.dark
      : theme.data.root
    : {};
  // `--radius` is declared once, in `:root`, because both themes share it.
  const radius =
    pending[pendingKey(scope, "--radius")] ??
    theme.data?.root["--radius"] ??
    theme.data?.dark["--radius"];

  const dirtyKeys = Object.keys(pending);
  const dirty = dirtyKeys.length;

  /** Stage a value. Nothing leaves the browser until Save. */
  const stage = (name: string, value: string) => {
    setPending((p) => ({ ...p, [pendingKey(scope, name)]: value }));
  };

  /**
   * Write every staged value, one request each.
   *
   * Sequential, deliberately. The endpoint takes one token at a time and each
   * response carries the new `contentHash`, so the requests form a chain -
   * firing them together would have every one but the first sent with a
   * `baseHash` that stopped being current, and the stale-file guard would
   * reject them against us rather than against the agent it exists to catch.
   *
   * A failure stops the run and keeps whatever is left staged, so the panel
   * still shows what has not landed. Partial success is reported honestly:
   * some of these are already in the file and undoing them is a separate act.
   */
  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);

    let applied = 0;
    for (const key of dirtyKeys) {
      const value = pending[key]!;
      const sep = key.indexOf("|");
      const entryScope = key.slice(0, sep) as ThemeScope;
      const name = key.slice(sep + 1);

      try {
        const data = await themeEdit.mutateAsync({
          name,
          value,
          scope: entryScope,
          baseHash: hashRef.current,
        });

        if (!data.applied) {
          setPending((p) => dropKey(p, key));
          toast.error(
            data.reason === "token_not_found"
              ? "This app's theme doesn't define that colour."
              : data.reason === "no_theme_block"
                ? "This app's theme has been rewritten: edit src/index.css directly."
                : "That value isn't supported.",
          );
          break;
        }

        hashRef.current = data.contentHash;
        setPending((p) => dropKey(p, key));
        applied++;
      } catch (err) {
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 409) {
          toast.error(
            err instanceof ApiError && err.message === "generation in progress"
              ? "Can't save while tau is building."
              : "The theme changed underneath: reloading it.",
          );
          void theme.refetch();
        } else {
          toast.error("Couldn't save the theme.");
        }
        break;
      }
    }

    setSaving(false);
    if (applied === dirty) toast.success("Theme saved.");
    else if (applied > 0) toast(`Saved ${applied} of ${dirty} changes.`);
  };

  const discard = () => {
    if (saving) return;
    setPending({});
  };

  const close = () => {
    if (dirty) toast(`Discarded ${dirty} unsaved theme change${dirty === 1 ? "" : "s"}.`);
    onClose();
  };

  /**
   * A restyle changes what tau can change without a model: colours, type, the
   * shape of the components. How each screen is laid out is in the app's own
   * code, and bringing that in line with the new style is the agent's work —
   * offered, not assumed, because it costs credits and the user may be happy
   * with the layouts as they are.
   */
  const adaptLayouts = () => {
    const name = restyled?.design?.styleName;
    if (!name) return;
    const sent = send(
      `I changed this app's style to ${name}. Read the restyle guide (read_doc restyle) first, then go through each screen and adapt its layout and components to the new design in .tau/DESIGN.md. Keep all the content and features as they are.`,
    );
    if (sent) setRestyled(null);
    else toast.error("tau is busy. Try again when it has finished.");
  };

  const current = design.data?.design ?? null;

  return (
    // Taller than the old flat list needed, but capped against the preview's
    // own height: a panel that covers the app you are recolouring is worse
    // than one you have to scroll. Tau chrome: it stays dark even when the app
    // is light, and the swatches are the only colour in it.
    <div className="scrollbar-thin absolute inset-x-0 bottom-0 max-h-[min(30rem,75%)] overflow-y-auto border-t border-line-strong bg-space-overlay text-silver-900 shadow-[0_-16px_48px_rgba(0,0,0,0.5)]">
      {/* Sticky, because the body scrolls and the palette you are editing has
          to stay visible: with both palettes holding different values, an
          off-screen Dark/Light toggle is how you edit the wrong one. */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-space-overlay px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3.5">
          <span className="flex items-center gap-2 text-[13.5px] font-semibold">
            <PaletteIcon className="size-4 text-silver-600" />
            Theme
          </span>
          <Segmented
            value={scope}
            onValueChange={(v) => setScope(v as typeof scope)}
            aria-label="Which palette to edit"
          >
            <SegmentedItem value="dark">
              <MoonIcon />
              Dark
            </SegmentedItem>
            <SegmentedItem value="root">
              <SunIcon />
              Light
            </SegmentedItem>
          </Segmented>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={close}
          aria-label={dirty ? "Discard changes and close" : "Close theme"}
          title={dirty ? "Discard changes and close" : "Close theme"}
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
        {theme.isPending && (
          <p className="text-[12.5px] text-silver-500">Reading the theme…</p>
        )}
        {theme.isError && (
          <p className="text-[12.5px] text-silver-500">
            This project has no theme file to edit.
          </p>
        )}

        {current && projectId && (
          <section className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {current.styleName} style
              </span>
              <span className="block truncate text-[12.5px] text-silver-500">
                {current.fontsLabel}
              </span>
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRestyleOpen(true)}
              disabled={saving || dirty > 0}
              title={
                dirty > 0
                  ? "Save or discard your colour changes first"
                  : "Change the style, typefaces, accent or feel"
              }
            >
              Change look…
            </Button>
            <RestyleDialog
              projectId={projectId}
              current={current}
              exactAccent={
                design.data?.chosen.accent === current.accent ? current.accent : undefined
              }
              open={restyleOpen}
              onOpenChange={setRestyleOpen}
              onRestyled={(result) => {
                setPending({});
                setRestyled(result);
                toast.success(
                  result.live
                    ? `Now ${result.design?.styleName ?? "restyled"}.`
                    : `Now ${result.design?.styleName ?? "restyled"}. You'll see it when the preview starts.`,
                );
              }}
            />
          </section>
        )}

        {restyled && (
          <Alert
            tone="info"
            action={
              <span className="flex items-center gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={adaptLayouts}
                  disabled={!canSend}
                  title="Sends a message to tau; uses credits like any other request"
                >
                  <WandSparklesIcon />
                  Adapt layouts
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setRestyled(null)}
                  aria-label="Dismiss"
                >
                  <XIcon />
                </Button>
              </span>
            }
          >
            Colours, type and component shapes are now{" "}
            {restyled.design?.styleName ?? "the new style"}. Page layouts are as
            they were.
            {restyled.skipped.length > 0 && (
              <span className="block text-silver-600">
                Not done: {restyled.skipped.join("; ")}.
              </span>
            )}
          </Alert>
        )}

        {theme.data && (
          <>
            <p className="-mb-1 text-[12.5px] text-silver-500">
              Applies to every element using these colours, across the whole app.
            </p>

            {GROUPS.map((group) => {
              const tiles = group.tokens
                .map((t) => ({
                  ...t,
                  value: pending[pendingKey(scope, t.name)] ?? palette[t.name],
                }))
                // A theme the agent rewrote may not declare all of these, and a
                // swatch with no value would render as black and write one.
                .filter((t) => Boolean(t.value));
              if (tiles.length === 0) return null;

              return (
                <section key={group.title} className="flex flex-col gap-2.5">
                  <h3 className="lab">{group.title}</h3>
                  <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]">
                    {tiles.map((t) => (
                      <SwatchTile
                        key={t.name}
                        name={t.name}
                        label={t.label}
                        value={t.value!}
                        staged={pendingKey(scope, t.name) in pending}
                        disabled={saving}
                        onPick={(v) => stage(t.name, v)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {radius && (
              <section className="flex flex-col gap-2.5">
                <h3 className="lab">
                  Corners
                  {pendingKey(scope, "--radius") in pending && (
                    <span className="ml-1.5 text-blue-500">· edited</span>
                  )}
                </h3>
                <Segmented
                  size="sm"
                  value={radius}
                  onValueChange={(v) => stage("--radius", v)}
                  aria-label="Corner radius"
                  disabled={saving}
                  className="self-start"
                >
                  {RADIUS_STEPS.map((step) => (
                    <SegmentedItem key={step.value} value={step.value} title={step.value}>
                      {step.label}
                    </SegmentedItem>
                  ))}
                </Segmented>
              </section>
            )}
          </>
        )}
      </div>

      {theme.data && (
        // Sticky so Save is reachable without scrolling a panel that is
        // routinely taller than its own max height.
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-line bg-space-overlay px-4 py-3 sm:px-6">
          <span
            className={cn(
              "flex items-center gap-2 text-[12.5px]",
              dirty ? "text-silver-900" : "text-silver-500",
            )}
          >
            {dirty > 0 && (
              <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
            )}
            {dirty === 0
              ? "No unsaved changes"
              : `${dirty} unsaved change${dirty === 1 ? "" : "s"}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={discard}
              disabled={!dirty || saving}
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => void save()}
              disabled={!dirty}
              loading={saving}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
