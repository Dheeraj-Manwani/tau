import { AnimatePresence, motion } from "motion/react";
import { ShuffleIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/src/lib/utils";
import { BuildWeatherCanvas } from "@/src/features/project/BuildWeatherCanvas";

/**
 * The "tau is building" card, restyled to match the storm voice (bold
 * display heading, mono eyebrow, a real rain-and-lightning canvas confined to
 * the card) used across landing/ and the rest of web/. Pure presentation -
 * `PreviewPane.tsx`'s `PreviewPlaceholder` keeps the tip-rotation timer,
 * reduced-motion handling and feedback-store wiring; this just renders one
 * tip.
 *
 * No animated border trail here on purpose: a chasing conic-gradient border
 * sized for a small button looked wrong stretched around a card this size,
 * fighting the content instead of framing it. A quiet static border plus the
 * weather canvas reads calmer and closer to the reference design.
 */
export function BuildLoaderCard({
  liveActivity,
  tip,
  tipIndex,
  tipCount,
  onSelectTip,
  onShuffle,
  onFeedback,
  reduceMotion,
}: {
  liveActivity: string;
  tip: {
    title: string;
    copy: string;
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    iconClass: string;
  };
  tipIndex: number;
  tipCount: number;
  onSelectTip: (index: number) => void;
  onShuffle: () => void;
  onPlay: () => void;
  onFeedback: () => void;
  reduceMotion: boolean | null;
}) {
  const TipIcon = tip.icon;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-black p-4">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-blue-500/20 bg-[#060608] shadow-2xl shadow-black/40">
        <BuildWeatherCanvas />

        <div className="relative flex flex-col gap-3 p-4">
          <div
            className="flex items-center justify-between gap-3"
            aria-live="polite"
          >
            <div className="flex min-w-0 items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/5 py-1 pl-2 pr-3">
              <span
                className="logo-mark relative block size-3.5 shrink-0"
                role="img"
                aria-label="tau"
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={liveActivity}
                  initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="truncate text-xs font-medium text-silver-900"
                >
                  is {liveActivity}
                </motion.p>
              </AnimatePresence>
            </div>
            <LoaderAction
              icon={ShuffleIcon}
              label="Shuffle tips"
              onClick={onShuffle}
            />
          </div>

          <div className="relative min-h-[5.5rem] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tipIndex}
                initial={reduceMotion ? false : { opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -14 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex items-start gap-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-silver-400/30 bg-space-overlay">
                  <TipIcon className={cn("size-4", tip.iconClass)} />
                </span>
                <div className="min-w-0">
                  <p className="display-heading text-base leading-tight text-silver-900">
                    {tip.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-silver-600">
                    {tip.copy}
                  </p>
                  {tipIndex === 0 && (
                    <button
                      type="button"
                      onClick={onFeedback}
                      className="mt-1 rounded-md text-xs font-medium text-amber-300 underline underline-offset-4 hover:text-amber-200 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      Give feedback
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div
            role="group"
            className="flex items-center justify-center gap-1"
            aria-label={`Tip ${tipIndex + 1} of ${tipCount}`}
          >
            {Array.from({ length: tipCount }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectTip(index)}
                aria-label={`Show tip ${index + 1}`}
                aria-current={index === tipIndex ? "true" : undefined}
                className="flex h-4 w-5 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
              >
                <span
                  className={cn(
                    "block h-1 rounded-full transition-[width,background-color,opacity]",
                    index === tipIndex
                      ? "w-4 bg-blue-500"
                      : "w-1 bg-silver-600 opacity-80 hover:opacity-100",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A pill under the card: an icon that spells out its label on hover or focus. */
function LoaderAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group flex h-7 items-center rounded-full border border-silver-400/30 px-2 text-silver-600 transition-colors hover:border-silver-400/60 hover:text-silver-900 focus-visible:border-silver-400/60 focus-visible:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500"
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-xs opacity-0 transition-[max-width,margin,opacity] duration-200 group-hover:ml-1.5 group-hover:max-w-24 group-hover:opacity-100 group-focus-visible:ml-1.5 group-focus-visible:max-w-24 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}

export default BuildLoaderCard;
