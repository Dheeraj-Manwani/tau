import {
  ChevronDownIcon,
  ChevronRightIcon,
  PaletteIcon,
  SignalHighIcon,
  SignalLowIcon,
  SignalMediumIcon,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import type { Effort } from "@/src/features/project/types";

// The bars say how hard tau works before the word does.
const EFFORTS: { value: Effort; label: string; detail: string; icon: typeof SignalLowIcon }[] = [
  { value: "LOW", label: "Low", detail: "Fastest. Good for small changes", icon: SignalLowIcon },
  { value: "HIGH", label: "High", detail: "Balanced speed and depth", icon: SignalMediumIcon },
  { value: "MAX", label: "Max", detail: "Most thorough. Uses more credits", icon: SignalHighIcon },
];

/** The app's look, as the composer's settings show it. */
export interface StyleSetting {
  /** "Auto", a style's name, "Custom", "Screenshot" or "Your design". */
  label: string;
  /** The chosen accent, shown as a swatch in place of the palette icon. */
  accent?: string;
  isAuto: boolean;
  /** The second line under a chosen look, e.g. "Your default look". */
  detail: string;
  onAuto: () => void;
  onBrowse: () => void;
}

/**
 * The composer's one settings chip: the look and the effort side by side
 * ("🎨 Auto | ▂▄ Max ⌄"), opening one menu to change either. Home passes a
 * `style`; the project chat, where the look is already set, shows effort only.
 */
export function ComposerSettings({
  effort,
  onEffortChange,
  style = null,
  disabled = false,
  compact = false,
}: {
  effort: Effort;
  onEffortChange: (effort: Effort) => void;
  style?: StyleSetting | null;
  disabled?: boolean;
  /** 28px to match the chat composer's controls; 32px otherwise. */
  compact?: boolean;
}) {
  const current = EFFORTS.find((e) => e.value === effort) ?? EFFORTS[0];
  const EffortIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Build settings. ${style ? `Style: ${style.label}. ` : ""}Effort: ${current.label}`}
          data-tour="effort"
          className={cn(
            "group flex min-w-0 cursor-pointer items-center rounded-md border border-line-strong font-medium text-silver-900 transition-colors duration-150 outline-none hover:bg-space-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 aria-expanded:border-line-hover aria-expanded:bg-space-raised [&_svg]:shrink-0",
            compact ? "h-7 gap-1.5 px-2 text-xs" : "h-8 gap-2 px-2.5 text-[13px]",
          )}
        >
          {style && (
            <>
              {style.accent ? (
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full border border-black/20"
                  style={{ backgroundColor: style.accent }}
                />
              ) : (
                <PaletteIcon aria-hidden="true" className="size-3.5 text-silver-600" />
              )}
              <span className="max-w-28 min-w-6 truncate">{style.label}</span>
              <span aria-hidden="true" className="h-3.5 w-px bg-line-strong" />
            </>
          )}
          <EffortIcon aria-hidden="true" className="size-3.5 text-silver-600" />
          {current.label}
          <ChevronDownIcon
            aria-hidden="true"
            className="size-3.5 text-silver-600 transition-transform duration-150 group-aria-expanded:rotate-180 motion-reduce:transition-none"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" collisionPadding={12} className="w-72 max-w-[calc(100vw-24px)]">
        {style && (
          <>
            <DropdownMenuLabel>Style</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={style.isAuto ? "auto" : "chosen"}
              onValueChange={(next) => next === "auto" && style.onAuto()}
            >
              <DropdownMenuRadioItem value="auto" className={twoLine}>
                <Option label="Auto" detail="Tau picks a look to fit your idea" />
              </DropdownMenuRadioItem>
              {!style.isAuto && (
                <DropdownMenuRadioItem value="chosen" className={twoLine}>
                  <Option label={style.label} detail={style.detail} />
                </DropdownMenuRadioItem>
              )}
            </DropdownMenuRadioGroup>
            <DropdownMenuItem onSelect={style.onBrowse} className="font-medium">
              Browse styles
              <ChevronRightIcon className="ml-auto" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel>Effort</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={effort} onValueChange={(next) => onEffortChange(next as Effort)}>
          {EFFORTS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className={twoLine}>
              <Option label={option.label} detail={option.detail} />
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A menu row with a second line: taller than the 34px single-line row, and
// the chosen one keeps its raised fill so it reads at a glance.
const twoLine = "h-auto py-2 data-[state=checked]:bg-space-raised/60";

function Option({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate font-medium">{label}</span>
      <span className="text-xs text-silver-500">{detail}</span>
    </span>
  );
}
