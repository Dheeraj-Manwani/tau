import type { ReactNode } from "react";
import {
  CloudRainIcon,
  Volume2Icon,
  VolumeXIcon,
  ZapIcon,
  ZapOffIcon,
} from "lucide-react";

import { cn } from "@/src/lib/utils";
import { ambienceHintText } from "@/src/lib/ambienceHint";
import { Button } from "@/src/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/src/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import type { Ambience } from "@/src/stores/useSettingsStore";

/** Lucide has no cloud-rain-off; draw ZapOff's slash over the cloud. */
function CloudRainOffIcon() {
  return (
    <span className="relative inline-flex">
      <CloudRainIcon />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        className="absolute inset-0"
      >
        <path d="m2 2 20 20" />
      </svg>
    </span>
  );
}

function Switch({
  label,
  on,
  disabled,
  onToggle,
  children,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={on}
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            "flex size-5 cursor-pointer items-center justify-center rounded-[5px] border transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4",
            on
              ? "border-line-strong bg-space-raised text-blue-500 shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
              : "border-transparent text-silver-600 hover:text-silver-900",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label} {on ? "on" : "off"}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Home's ambience: the storm's rain and lightning, and the soundtrack, each
 * on or off. Floats above the composer's right edge, out of the layout flow.
 * Rain and lightning are moot under reduced motion (the storm is still), so
 * they are disabled there.
 */
export function AmbienceSwitches({
  value,
  onChange,
  reduceMotion,
  hasSound,
  hint = false,
  onHintDismiss,
}: {
  value: Ambience;
  onChange: (patch: Partial<Ambience>) => void;
  reduceMotion: boolean;
  /** False when no soundtrack is configured: the sound switch is left out. */
  hasSound: boolean;
  /** Show the first-visit callout pointing at the switches. */
  hint?: boolean;
  /** The callout was closed, or a switch was used: either way, they've found it. */
  onHintDismiss?: () => void;
}) {
  const toggle = (patch: Partial<Ambience>) => {
    if (hint) onHintDismiss?.();
    onChange(patch);
  };

  return (
    <Popover
      open={hint}
      onOpenChange={(open) => {
        if (!open) onHintDismiss?.();
      }}
    >
      <PopoverAnchor asChild>
        <div
          role="group"
          aria-label="Ambience"
          className="flex items-center gap-1 rounded-[7px] border border-line bg-space-surface p-1"
        >
          <Switch
            label="Rain"
            on={value.rain && !reduceMotion}
            disabled={reduceMotion}
            onToggle={() => toggle({ rain: !value.rain })}
          >
            {value.rain && !reduceMotion ? <CloudRainIcon /> : <CloudRainOffIcon />}
          </Switch>
          <Switch
            label="Lightning"
            on={value.lightning && !reduceMotion}
            disabled={reduceMotion}
            onToggle={() => toggle({ lightning: !value.lightning })}
          >
            {value.lightning && !reduceMotion ? <ZapIcon /> : <ZapOffIcon />}
          </Switch>
          {hasSound && (
            <Switch
              label="Sound"
              on={value.sound}
              onToggle={() => toggle({ sound: !value.sound })}
            >
              {value.sound ? <Volume2Icon /> : <VolumeXIcon />}
            </Switch>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent
        side="top"
        align="end"
        className="w-64 p-3.5"
        // A pointer, not a prompt: leave focus where it is (the composer).
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="text-sm font-medium text-silver-900">Make it yours</p>
        <p className="mt-1 text-xs leading-relaxed text-silver-600">{ambienceHintText(hasSound)}</p>
        <div className="mt-3 flex justify-end">
          <Button size="xs" variant="secondary" onClick={onHintDismiss}>
            Got it
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
