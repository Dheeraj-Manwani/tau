import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  FileUpIcon,
  ImageUpIcon,
  LoaderCircleIcon,
  MoonIcon,
  SparklesIcon,
  SunIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { SearchInput } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import { fieldClass } from "@/src/components/ui/styles";
import { ApiError } from "@/src/lib/api-client";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  REFERENCE_IMAGE_TYPES,
  groupStyles,
  searchStyles,
  stylePreviewUrl,
  useReadDesignImage,
  type CatalogStyle,
  type DesignCatalog,
  type DesignConfig,
  type DesignSummary,
  type Dials,
  type FeelPreset,
  type ImageDesignResponse,
} from "@/src/features/design/api";
import { accentWarning } from "@/src/features/design/contrast";

/** Mirrors `MAX_IMPORTED_DESIGN_CHARS` on the server, which refuses anything longer. */
const MAX_DESIGN_FILE_CHARS = 40_000;

const DIALS: { key: keyof Dials; label: string; low: string; high: string }[] = [
  { key: "variance", label: "Layout", low: "Predictable", high: "Surprising" },
  { key: "motion", label: "Motion", low: "Still", high: "Lively" },
  { key: "density", label: "Density", low: "Airy", high: "Packed" },
];

const NEUTRAL_CHOICES: { key: "warm" | "cool" | "grey"; label: string; swatch: string }[] = [
  { key: "warm", label: "Warm", swatch: "#d8cdb9" },
  { key: "cool", label: "Cool", swatch: "#c5cfdc" },
  { key: "grey", label: "Plain grey", swatch: "#cfcfcf" },
];

const FEELS: { key: FeelPreset; label: string }[] = [
  { key: "calm", label: "Calm" },
  { key: "balanced", label: "Balanced" },
  { key: "bold", label: "Bold" },
];

/** While the catalog loads: the picker's shape, not a spinner (plan §4.3). */
export function PickerSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading styles" role="status">
      <Skeleton className="h-10 w-full rounded-md" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="aspect-[8/6] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="lab">{title}</h3>
        {hint && <span className="min-w-0 truncate text-xs text-silver-500">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/** A small choice; chosen is a blue edge and a 12% blue tint, like a choice card. */
function Chip({
  selected,
  onClick,
  children,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border px-2.5 text-xs font-medium transition-colors duration-150",
        selected
          ? "border-blue-500 bg-blue-500/12 text-silver-900"
          : "border-line-strong bg-space-surface text-silver-600 hover:border-line-hover hover:text-silver-900",
      )}
    >
      {children}
    </button>
  );
}

function StyleCard({
  style,
  selected,
  onSelect,
}: {
  style: CatalogStyle;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      title={`${style.look} Suits: ${style.suits}`}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border text-left transition-colors duration-150",
        selected
          ? "border-blue-500 bg-blue-500/12"
          : "border-line bg-space-surface hover:border-line-hover",
      )}
    >
      {/* The background is the style's own page colour, so a thumbnail that is
          still loading (or missing) is at least the right colour. */}
      <div
        className="aspect-[8/5] w-full overflow-hidden"
        style={{ backgroundColor: style.swatch.background }}
      >
        <img
          src={stylePreviewUrl(style.key)}
          alt=""
          loading="lazy"
          className="size-full object-cover object-left-top"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      </div>
      <div className="flex flex-1 items-start justify-between gap-2 border-t border-line px-3 py-2">
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-silver-900">
            {style.name}
          </span>
          {/* The name people may know it by, where tau's is different. */}
          {style.aka?.[0] && (
            <span className="block truncate text-[11px] text-silver-500">
              {style.aka[0]}
            </span>
          )}
        </span>
        <span
          className="mt-0.5 size-3 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
          style={{ backgroundColor: style.swatch.primary }}
        />
      </div>
      {selected && (
        <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-blue-500 text-blue-900">
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** Which preset the chosen dials are, if they are exactly one. */
function presetOf(
  dials: Partial<Dials> | undefined,
  presets: DesignCatalog["feelPresets"],
): FeelPreset | null {
  if (!dials) return null;
  return (
    FEELS.find(({ key }) =>
      DIALS.every((d) => dials[d.key] === presets[key][d.key]),
    )?.key ?? null
  );
}

interface DesignPickerProps {
  catalog: DesignCatalog;
  value: DesignConfig;
  onChange: (next: DesignConfig) => void;
  /**
   * The app's current design, when restyling one. Changes what "nothing
   * chosen" means: for a new app it is "tau decides", for an existing one it
   * is "keep what it has".
   */
  current?: DesignSummary | null;
  /**
   * Whether a DESIGN.md can be brought. False where the choice outlives the
   * project — a default look — because a design file is written for one app.
   */
  allowImport?: boolean;
  /**
   * When restyling: the accent the user chose earlier, if the app still has
   * it. It is kept exactly as chosen through a restyle, so it is checked
   * against the new page the way a newly chosen one is.
   */
  exactAccent?: string;
}

/**
 * The controls for choosing a look: a style, an accent, light or dark, a font
 * pairing, the feel, or a DESIGN.md of the user's own.
 *
 * Everything is optional and nothing is preselected. That matters more than it
 * looks: a picker that opened on "Editorial" would have most people building
 * Editorial apps without having chosen to, and the point of tau deciding is
 * that the look fits what is being built.
 */
export function DesignPicker({
  catalog,
  value,
  onChange,
  current,
  allowImport = true,
  exactAccent,
}: DesignPickerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const readImage = useReadDesignImage();
  /** The screenshot just read, to show beside what was read from it. Gone when the picker closes. */
  const [shot, setShot] = useState<{ url: string; read: ImageDesignResponse["read"]; notice: string } | null>(null);
  useEffect(() => () => {
    if (shot) URL.revokeObjectURL(shot.url);
  }, [shot]);
  const [fineTune, setFineTune] = useState(false);
  const [importOpen, setImportOpen] = useState(Boolean(value.designMd));
  /** The family the gallery is narrowed to, or null for all of them. */
  const [group, setGroup] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const restyling = current != null;
  const unset = restyling ? "Keep" : "Auto";
  const set = (patch: Partial<DesignConfig>) => onChange({ ...value, ...patch });

  // The style whose font pairings and defaults apply: the one picked, else the
  // one the app already has.
  const styleKey = value.style ?? current?.style;
  const style = catalog.styles.find((s) => s.key === styleKey);

  // The gallery: narrowed to one family or to a search, and shown in families
  // either way, since twenty-odd cards in one grid cannot be scanned. A catalog
  // from a server that predates families is one unnamed section.
  const groups = catalog.groups ?? [];
  const shown = searchStyles(
    group ? catalog.styles.filter((s) => s.group === group) : catalog.styles,
    query,
  );
  const sections = groupStyles(shown, groups);

  // An accent is used exactly as chosen, so say so when it will be hard to see.
  const warning = accentWarning({ value, current, styles: catalog.styles, exactAccent });

  // The switch is on if asked for here, or the app has one and this does not say otherwise.
  const switchOn = value.switch ?? (restyling ? current.switch : false);

  const preset = presetOf(value.dials, catalog.feelPresets);
  // What the sliders show for a dial nobody has set: where it will land.
  const baseDials: Dials =
    (value.style ? style?.dials : (current?.dials ?? style?.dials)) ??
    catalog.feelPresets.balanced;

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    if (text.includes("\0")) {
      toast.error("That doesn't look like a text file.");
      return;
    }
    if (text.length > MAX_DESIGN_FILE_CHARS) {
      toast.error("That design file is too long to import.");
      return;
    }
    // A file brought by hand replaces one read from a screenshot, picture and all.
    set({ designMd: text, reference: undefined });
    setShot(null);
    setImportOpen(true);
  };

  /** Read a design from a screenshot: tau writes the design file from it. */
  const readScreenshot = (file: File | undefined) => {
    if (!file || readImage.isPending) return;
    if (!REFERENCE_IMAGE_TYPES.includes(file.type)) {
      toast.error("Use a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_REFERENCE_IMAGE_BYTES) {
      toast.error("That image is too large. Use one under 5 MB.");
      return;
    }
    readImage.mutate(file, {
      onSuccess: (result) => {
        set({ designMd: result.designMd, reference: result.reference });
        setShot({ url: URL.createObjectURL(file), read: result.read, notice: result.notice });
        setImportOpen(true);
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Couldn't read that image.");
      },
    });
  };

  const fromScreenshot = Boolean(value.designMd && value.reference);

  return (
    <div className="space-y-6">
      <Section
        title="Style"
        hint={
          value.style
            ? style?.look
            : restyling
              ? `Currently ${current.styleName}`
              : "tau picks one that suits what you describe"
        }
      >
        <button
          type="button"
          aria-pressed={!value.style}
          onClick={() => set({ style: undefined, fonts: undefined })}
          className={cn(
            "flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 text-left transition-colors duration-150",
            !value.style
              ? "border-blue-500 bg-blue-500/12 text-silver-900 [&_svg]:text-blue-500"
              : "border-dashed border-line-strong text-silver-600 hover:border-line-hover hover:text-silver-900",
          )}
        >
          <SparklesIcon className="size-4 shrink-0" />
          <span className="text-[13px] font-medium">
            {restyling ? `Keep ${current.styleName}` : "Let tau decide"}
          </span>
          {!value.style && <CheckIcon className="ml-auto size-3.5 shrink-0" />}
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          <Chip selected={group === null} onClick={() => setGroup(null)}>
            All
          </Chip>
          {groups.map((g) => (
            <Chip
              key={g.key}
              selected={group === g.key}
              onClick={() => setGroup(group === g.key ? null : g.key)}
              title={g.title}
            >
              {g.label}
            </Chip>
          ))}
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search styles"
            aria-label="Search styles"
            className="ml-auto w-full sm:w-52"
          />
        </div>

        {sections.length === 0 ? (
          <p className="rounded-lg border border-line px-3 py-6 text-center text-[13px] text-silver-500">
            No style matches “{query.trim()}”.
          </p>
        ) : (
          <div className="space-y-3">
            {sections.map((section) => (
              <div key={section.group.key} className="space-y-1.5">
                {/* One family on show needs no heading; the chip already names it. */}
                {sections.length > 1 && (
                  <h4 className="text-xs font-medium text-silver-500">
                    {section.group.title}
                  </h4>
                )}
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {section.styles.map((s) => (
                    <StyleCard
                      key={s.key}
                      style={s}
                      selected={value.style === s.key}
                      // A pairing belongs to its style, so it does not follow a change of style.
                      onSelect={() => set({ style: s.key, fonts: undefined })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Accent colour" hint={value.accent ?? (restyling ? current.accent : undefined)}>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip selected={!value.accent} onClick={() => set({ accent: undefined })}>
            {unset}
          </Chip>
          {catalog.suggestedAccents.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Accent ${hex}`}
              aria-pressed={value.accent === hex}
              onClick={() => set({ accent: hex })}
              className={cn(
                "size-6 cursor-pointer rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] transition-shadow duration-150",
                value.accent === hex
                  ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-space-overlay"
                  : "hover:ring-1 hover:ring-line-hover hover:ring-offset-2 hover:ring-offset-space-overlay",
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
          {/* The native picker: it only ever emits #rrggbb, which is the one
              form the server accepts. */}
          <label
            className={cn(
              "flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border px-2 text-xs font-medium transition-colors duration-150",
              value.accent && !catalog.suggestedAccents.includes(value.accent)
                ? "border-blue-500 bg-blue-500/12 text-silver-900"
                : "border-line-strong bg-space-surface text-silver-600 hover:border-line-hover hover:text-silver-900",
            )}
          >
            <input
              type="color"
              value={value.accent ?? current?.accent ?? "#4d7c0f"}
              onChange={(e) => set({ accent: e.target.value.toLowerCase() })}
              aria-label="Pick a custom accent colour"
              className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-[3px] [&::-webkit-color-swatch]:border-0"
            />
            Custom
          </label>
        </div>
        {warning && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-orange-400/34 bg-orange-400/11 px-3 py-2 text-xs text-silver-900"
          >
            <TriangleAlertIcon className="size-4 shrink-0 text-orange-400" />
            <span className="min-w-0 flex-1">
              <span className="font-mono">{warning.accent}</span> is hard to see on a{" "}
              {warning.mode} page. tau uses your colour exactly as chosen.
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => set({ accent: warning.readable })}
            >
              <span
                className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                style={{ backgroundColor: warning.readable }}
              />
              Make it readable
            </Button>
          </div>
        )}
      </Section>

      <div className="grid gap-5 sm:grid-cols-2">
        <Section title="Light or dark">
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={!value.mode} onClick={() => set({ mode: undefined })}>
              {unset}
            </Chip>
            <Chip selected={value.mode === "light"} onClick={() => set({ mode: "light" })}>
              <SunIcon className="size-3" /> Light
            </Chip>
            <Chip selected={value.mode === "dark"} onClick={() => set({ mode: "dark" })}>
              <MoonIcon className="size-3" /> Dark
            </Chip>
            <Chip
              selected={switchOn}
              onClick={() => set({ switch: switchOn ? (restyling && current.switch ? false : undefined) : true })}
              title="Gives the app a button that visitors use to change between light and dark. It opens the way you chose above."
            >
              Both, with a switch
            </Chip>
          </div>
        </Section>

        <Section title="Feel">
          <div className="flex flex-wrap gap-1.5">
            <Chip selected={!value.dials} onClick={() => set({ dials: undefined })}>
              {unset}
            </Chip>
            {FEELS.map(({ key, label }) => (
              <Chip
                key={key}
                selected={preset === key}
                onClick={() => set({ dials: { ...catalog.feelPresets[key] } })}
              >
                {label}
              </Chip>
            ))}
            <Chip
              selected={fineTune || (Boolean(value.dials) && preset === null)}
              onClick={() => setFineTune((open) => !open)}
            >
              Fine-tune
              <ChevronDownIcon className={cn("size-3.5 transition-transform duration-150", fineTune && "rotate-180")} />
            </Chip>
          </div>
        </Section>
      </div>

      {fineTune && (
        <div className="grid gap-4 rounded-lg border border-line bg-space-void p-4 sm:grid-cols-3">
          {DIALS.map((d) => {
            const chosen = value.dials?.[d.key];
            return (
              <label key={d.key} className="space-y-1">
                <span className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-silver-900">{d.label}</span>
                  <span className={cn("font-mono text-[11px]", chosen ? "text-blue-500" : "text-silver-500")}>
                    {chosen ?? `${unset.toLowerCase()} (${baseDials[d.key]})`}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={chosen ?? baseDials[d.key]}
                  onChange={(e) =>
                    set({ dials: { ...value.dials, [d.key]: Number(e.target.value) } })
                  }
                  className="w-full accent-blue-500"
                />
                <span className="flex justify-between text-[11px] text-silver-500">
                  <span>{d.low}</span>
                  <span>{d.high}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      <Section
        title="Greys"
        hint={restyling && current.neutral ? `Currently ${current.neutral}` : "The tint of the page and panels"}
      >
        <div className="flex flex-wrap gap-1.5">
          <Chip
            selected={!value.neutral}
            onClick={() => set({ neutral: undefined })}
            title={restyling ? "Keep the greys as they are" : "The greys follow the accent, the way the style does them"}
          >
            {unset}
          </Chip>
          {restyling && current.neutral && (
            <Chip selected={value.neutral === "style"} onClick={() => set({ neutral: "style" })} title="Back to the style's own greys">
              Style's own
            </Chip>
          )}
          {NEUTRAL_CHOICES.map(({ key, label, swatch }) => (
            <Chip key={key} selected={value.neutral === key} onClick={() => set({ neutral: key })}>
              <span className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]" style={{ backgroundColor: swatch }} />
              {label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section
        title="Typefaces"
        hint={style ? undefined : "Choose a style to choose its typefaces"}
      >
        {style ? (
          <div className="flex flex-wrap gap-1.5">
            {style.fonts.map((pairing, i) => {
              // With no pairing chosen, a new style gets its own; an existing
              // app keeps whichever it has.
              const kept = !value.style && current ? current.fonts : "default";
              const selected = value.fonts ? value.fonts === pairing.key : pairing.key === kept;
              return (
                <Chip
                  key={pairing.key}
                  selected={selected}
                  onClick={() =>
                    // A pairing is stored against a style, so choosing one
                    // settles the style too.
                    set({ style: style.key, fonts: pairing.key })
                  }
                  title={i === 0 ? "This style's own pairing" : undefined}
                >
                  {pairing.label}
                </Chip>
              );
            })}
          </div>
        ) : (
          <p className="text-[12.5px] text-silver-500">
            Each style comes with a pairing of its own and two alternatives.
          </p>
        )}
      </Section>

      {allowImport && (
      <section className="rounded-lg border border-line bg-space-surface">
        <button
          type="button"
          onClick={() => setImportOpen((open) => !open)}
          aria-expanded={importOpen}
          className="flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-4 text-left transition-colors duration-150 hover:bg-space-raised"
        >
          <span className="text-[13px] font-medium text-silver-900">
            Use a screenshot or your own DESIGN.md
            {value.designMd && (
              <span className="ml-2 font-mono text-[11px] font-normal text-blue-500">
                {fromScreenshot
                  ? "From a screenshot"
                  : `${value.designMd.length.toLocaleString()} characters`}
              </span>
            )}
          </span>
          <ChevronDownIcon
            className={cn("size-4 text-silver-600 transition-transform duration-150", importOpen && "rotate-180")}
          />
        </button>
        {importOpen && (
          <div className="space-y-3 border-t border-line p-4">
            <p className="text-[12.5px] leading-relaxed text-silver-500">
              Give tau a screenshot of something you want this to look like, and
              it reads the colours, shapes, type and layout from it. Or paste
              or upload a design file of your own. Anything you choose above
              still wins.
            </p>
            {readImage.isPending && (
              <p role="status" className="flex items-center gap-2 text-xs text-silver-900">
                <LoaderCircleIcon className="size-3.5 animate-spin text-blue-500 motion-reduce:animate-none" />
                Reading the design from your screenshot…
              </p>
            )}
            {fromScreenshot && !readImage.isPending && (
              <div className="flex gap-3 rounded-md border border-line bg-space-void p-3">
                {shot && (
                  <img
                    src={shot.url}
                    alt="The screenshot the design was read from"
                    className="h-20 w-28 shrink-0 rounded-xs border border-line object-cover object-top"
                  />
                )}
                <div className="min-w-0 space-y-1.5 text-xs leading-relaxed">
                  {shot ? (
                    <>
                      <p className="flex items-center gap-1.5 font-semibold text-silver-900">
                        {[shot.read.colors.background, shot.read.colors.primary, shot.read.colors.text].map(
                          (hex, i) => (
                            <span
                              key={i}
                              title={hex}
                              className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]"
                              style={{ backgroundColor: hex }}
                            />
                          ),
                        )}
                        Read as a {shot.read.mode} design
                      </p>
                      {shot.read.summary && <p className="text-silver-900">{shot.read.summary}</p>}
                      {!shot.read.isInterface && (
                        <p className="text-orange-400">
                          This does not look like a screenshot of an app or a page, so only its
                          colours were taken.
                        </p>
                      )}
                      <p className="text-silver-600">{shot.notice}</p>
                    </>
                  ) : (
                    <p className="text-silver-600">
                      This design was read from a screenshot. Its photos, illustrations, logos and
                      brand names are not copied.
                    </p>
                  )}
                </div>
              </div>
            )}
            <textarea
              value={value.designMd ?? ""}
              onChange={(e) => {
                const designMd = e.target.value.slice(0, MAX_DESIGN_FILE_CHARS) || undefined;
                // Emptied out, the picture it was read from goes with it.
                set(designMd ? { designMd } : { designMd, reference: undefined });
                if (!designMd) setShot(null);
              }}
              rows={5}
              spellCheck={false}
              placeholder={"---\ncolors:\n  primary: \"#0b5fff\"\n---\n# My design\n…"}
              className={cn(
                fieldClass,
                "scrollbar-inset resize-y p-3 font-mono text-xs",
                // A design file runs to hundreds of lines: give it room to be read.
                value.designMd && "h-72",
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={readImage.isPending}
                onClick={() => imageInput.current?.click()}
              >
                <ImageUpIcon />
                {fromScreenshot ? "Use another screenshot" : "Use a screenshot"}
              </Button>
              <input
                ref={imageInput}
                type="file"
                hidden
                accept={REFERENCE_IMAGE_TYPES.join(",")}
                onChange={(e) => {
                  readScreenshot(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
                <FileUpIcon /> Upload a DESIGN.md
              </Button>
              {value.designMd && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    set({ designMd: undefined, reference: undefined });
                    setShot(null);
                  }}
                >
                  <XIcon /> Remove
                </Button>
              )}
              <input
                ref={fileInput}
                type="file"
                hidden
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                onChange={(e) => {
                  void readFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        )}
      </section>
      )}
    </div>
  );
}
