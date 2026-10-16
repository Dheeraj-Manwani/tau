import { ShuffleIcon } from "lucide-react";

import { RainLayer, RainSplash } from "@/src/components/motion/RainLayer";
import { Button } from "@/src/components/ui/button";
import { BUILD_PHASES, type BuildPhase } from "@/src/features/project/buildPhase";

/**
 * The first build, inside the preview (boards/Workspace-Building.dc.html).
 * Tier A inside the frame only: rain, a skeleton page drawing itself in as
 * the build moves on, and four phase segments. The phase comes from real job
 * events (`buildPhase`), never a timer, and a segment never fills to imply a
 * percent: the current one carries a travelling light instead.
 */
export function PreviewLoader({
  phase,
  tip,
  tipIndex,
  tipCount,
  onNextTip,
  onFeedback,
}: {
  phase: BuildPhase;
  tip: { title: string; copy: string; feedback?: boolean };
  tipIndex: number;
  tipCount: number;
  onNextTip: () => void;
  onFeedback?: () => void;
}) {
  const shown = (from: BuildPhase) => String(phase >= from);

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-space-void px-4">
      <RainLayer fill className="opacity-55" />

      <div className="relative flex w-[540px] max-w-full flex-col gap-6 sm:gap-[30px]">
        <div className="flex flex-col items-center gap-3.5 text-center" role="status" aria-live="polite">
          <p className="font-mono text-[11px] tracking-[0.16em] text-silver-500">
            {String(phase + 1).padStart(2, "0")} / {String(BUILD_PHASES.length).padStart(2, "0")}
          </p>
          <h2 className="display-heading text-[34px] text-balance text-silver-900 sm:text-[44px] lg:text-[52px]">
            {BUILD_PHASES[phase]}
          </h2>
        </div>

        <div className="relative w-full" aria-hidden="true">
          <RainSplash />
          <div className="relative h-[240px] overflow-hidden rounded-[14px] border border-line-strong bg-[#070708] shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:h-[290px]">
            <div className="flex h-[34px] items-center gap-1.5 border-b border-line px-3.5">
              <i className="size-1.5 rounded-full bg-[#2a2a2f]" />
              <i className="size-1.5 rounded-full bg-[#2a2a2f]" />
              <i className="size-1.5 rounded-full bg-[#2a2a2f]" />
              <span className="loader-skeleton mx-auto h-3.5 w-[150px] rounded-full" />
              <span className="w-[30px]" />
            </div>
            <div className="flex flex-col gap-3.5 px-[22px] py-[18px]">
              <div className="loader-reveal flex items-center justify-between" data-shown={shown(0)}>
                <span className="loader-skeleton size-[18px] rounded-full" />
                <span className="flex gap-2.5">
                  <span className="loader-skeleton h-2 w-[42px]" />
                  <span className="loader-skeleton h-2 w-[42px]" />
                  <span className="loader-skeleton h-2 w-[42px]" />
                </span>
              </div>
              <div className="mt-1.5 flex flex-col gap-[9px]">
                <span className="loader-reveal loader-skeleton h-4 w-[64%]" data-shown={shown(1)} />
                <span className="loader-reveal loader-skeleton h-4 w-[42%]" data-shown={shown(1)} />
                <span className="loader-reveal loader-skeleton mt-1 h-2 w-[78%]" data-shown={shown(1)} />
              </div>
              <span
                className="loader-reveal block h-[26px] w-[92px] rounded-sm border border-blue-500/34 bg-blue-500/12"
                data-shown={shown(2)}
              />
              <div className="mt-1 grid grid-cols-3 gap-2.5">
                <span className="loader-reveal loader-skeleton h-[58px] rounded-[9px]" data-shown={shown(2)} />
                <span className="loader-reveal loader-skeleton h-[58px] rounded-[9px]" data-shown={shown(3)} />
                <span className="loader-reveal loader-skeleton h-[58px] rounded-[9px]" data-shown={shown(3)} />
              </div>
            </div>
            <div className="loader-scan" />
          </div>
        </div>

        <div className="flex flex-col gap-[18px]">
          <div className="flex gap-1.5" aria-hidden="true">
            {BUILD_PHASES.map((label, i) => (
              <span
                key={label}
                className="loader-segment"
                data-state={i < phase ? "done" : i === phase ? "active" : "pending"}
              >
                <i />
              </span>
            ))}
          </div>
          <div className="flex items-start gap-3.5 sm:items-center">
            <span className="pt-0.5 font-mono text-[11px] tracking-[0.14em] text-blue-500 sm:pt-0">TIP</span>
            <p className="flex-1 text-[13px] leading-[1.55] text-silver-600">
              <b className="font-medium text-silver-900">{tip.title}.</b> {tip.copy}
              {tip.feedback && onFeedback && (
                <>
                  {" "}
                  <button
                    type="button"
                    onClick={onFeedback}
                    className="cursor-pointer rounded-xs text-blue-500 underline-offset-4 hover:text-blue-hi hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    Give feedback
                  </button>
                </>
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextTip}
              aria-label={`Show another tip (${tipIndex + 1} of ${tipCount})`}
              className="shrink-0 border border-line-strong font-mono text-[11px] tracking-[0.06em]"
            >
              <ShuffleIcon />
              {tipIndex + 1} / {tipCount}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
