/**
 * Renders one project tour. Lazy-loaded by ProjectPage only when a tour is
 * actually due, so the tour library stays out of the everyday bundle.
 *
 * When to run a tour, and recording how it ended, live in useProjectTours;
 * this file only draws it and reports "completed" or "skipped" once.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import {
  TourProvider,
  useTour,
  type PopoverContentProps,
  type StepType,
} from "@reactour/tour";

import { Button } from "@/src/components/ui/button";
import { tourSelector, type TourStepDef } from "@/src/features/tour/tours";
import {
  placePopover,
  type PlacementInput,
} from "@/src/features/tour/placement";
import type { TourOutcome } from "@/src/features/settings/preferences";

interface TourCardContext {
  defs: TourStepDef[];
  /** Notes how the tour ended, for CloseWatcher to report once it closes. */
  setOutcome: (outcome: TourOutcome) => void;
}

const CardContext = createContext<TourCardContext | null>(null);

const TITLE_ID = "project-tour-title";
const BODY_ID = "project-tour-body";

function TourCard({
  currentStep,
  steps,
  setCurrentStep,
  setIsOpen,
}: PopoverContentProps) {
  const ctx = useContext(CardContext);
  if (!ctx) return null;
  const def = ctx.defs[currentStep];
  if (!def) return null;

  const finish = (outcome: TourOutcome) => {
    ctx.setOutcome(outcome);
    setIsOpen(false);
  };

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-labelledby={TITLE_ID}
      aria-describedby={BODY_ID}
      className="w-72 rounded-xl border border-line-strong bg-space-overlay p-5 text-left text-silver-900 shadow-[0_16px_48px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.04)]"
    >
      <p className="font-mono text-[11px] text-silver-500" aria-live="polite">
        {currentStep + 1} / {steps.length}
      </p>
      <h2 id={TITLE_ID} className="mt-1.5 text-[15px] font-semibold">
        {def.title}
      </h2>
      <p id={BODY_ID} className="mt-1.5 text-[13px] leading-relaxed text-silver-600">
        {def.body}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2">
        {isLast ? (
          <span />
        ) : (
          <Button
            variant="link"
            className="text-xs text-silver-500 hover:text-silver-900"
            onClick={() => finish("skipped")}
          >
            Skip tour
          </Button>
        )}

        <div className="flex gap-1.5">
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
          )}
          <Button
            size="sm"
            // Focus lands here on every step, so Enter walks the whole tour.
            autoFocus
            key={currentStep}
            onClick={() =>
              isLast
                ? finish("completed")
                : setCurrentStep((s) => Math.min(steps.length - 1, s + 1))
            }
          >
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reports the tour closing, however it closed (Done, Skip, Esc, mask click).
 *
 * Watches `isOpen` rather than using the library's `beforeClose`, which fires
 * from an effect cleanup and so also on StrictMode's dev-only remount: that
 * would record a "skip" the instant the tour opened.
 */
function CloseWatcher({
  outcome,
  onEnd,
}: {
  outcome: RefObject<TourOutcome>;
  onEnd: (outcome: TourOutcome) => void;
}) {
  const { isOpen } = useTour();
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
    } else if (wasOpen.current) {
      wasOpen.current = false;
      onEnd(outcome.current);
    }
  }, [isOpen, outcome, onEnd]);
  return null;
}

export default function ProjectTour({
  steps,
  reduceMotion,
  onEnd,
}: {
  steps: TourStepDef[];
  reduceMotion: boolean;
  onEnd: (outcome: TourOutcome) => void;
}) {
  // Anything but an explicit Done (Esc, mask click, Skip) is a skip.
  const outcome = useRef<TourOutcome>("skipped");

  const tourSteps = useMemo<StepType[]>(
    () =>
      steps.map((step) => ({
        selector: tourSelector(step.target),
        // The card renders title and body from `defs`; this is only the
        // fallback the library would show without a ContentComponent.
        content: step.title,
        position: (props: PlacementInput) => placePopover(step.position, props),
      })),
    [steps],
  );

  const card = useMemo<TourCardContext>(
    () => ({
      defs: steps,
      setOutcome: (next) => {
        outcome.current = next;
      },
    }),
    [steps],
  );

  return (
    <CardContext.Provider value={card}>
      <TourProvider
        steps={tourSteps}
        defaultOpen
        // The highlighted control is shown, not handed over: opening a dropdown
        // under the mask would strand it behind the overlay.
        disableInteraction
        ContentComponent={TourCard}
        padding={{ mask: 6, popover: [14, 14] }}
        scrollSmooth={!reduceMotion}
        accessibilityOptions={{
          ariaLabelledBy: TITLE_ID,
          closeButtonAriaLabel: "Close tour",
          showNavigationScreenReaders: true,
        }}
        styles={{
          popover: (base) => ({
            ...base,
            padding: 0,
            background: "transparent",
            boxShadow: "none",
            maxWidth: "none",
            transition: reduceMotion ? "none" : base.transition,
          }),
          maskWrapper: (base) => ({ ...base, color: "#000", opacity: 0.6 }),
          maskArea: (base) => ({ ...base, rx: 10 }),
          // The cut-out gets the strong hairline, so the spotlit control reads
          // as framed rather than floating.
          highlightedArea: (base) => ({
            ...base,
            display: "block",
            rx: 10,
            stroke: "#34343a",
            strokeWidth: 1,
            pointerEvents: "none",
          }),
        }}
      >
        <CloseWatcher outcome={outcome} onEnd={onEnd} />
      </TourProvider>
    </CardContext.Provider>
  );
}
