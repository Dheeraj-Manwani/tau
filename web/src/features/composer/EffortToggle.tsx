import { InfoIcon } from "lucide-react";

import type { Effort } from "@/src/features/project/types";
import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";

const EFFORT_OPTIONS: { value: Effort; label: string; hint?: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "HIGH", label: "High" },
  {
    value: "MAX",
    label: "Max",
    hint: "For the toughest jobs. It takes longer and can use more credits.",
  },
];

/**
 * LOW / HIGH / MAX as the small mono segmented control
 * (boards/Controls.dc.html §03): the choice is a raised neutral chip, never a
 * blue fill. `compact` drops the MAX hint icon for the workspace's narrower
 * composer; the hint stays in the tooltip either way.
 */
export function EffortToggle({
  effort,
  onChange,
  compact = false,
}: {
  effort: Effort;
  onChange: (effort: Effort) => void;
  compact?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Segmented
        size="sm"
        value={effort}
        onValueChange={(next) => onChange(next as Effort)}
        aria-label="How much effort Tau should use"
        data-tour="effort"
      >
        {EFFORT_OPTIONS.map((opt) => {
          const item = (
            <SegmentedItem key={opt.value} value={opt.value} className="gap-1">
              {opt.label}
              {opt.hint && !compact && <InfoIcon className="size-3 text-silver-500" />}
            </SegmentedItem>
          );
          if (!opt.hint) return item;
          return (
            <Tooltip key={opt.value}>
              <TooltipTrigger asChild>{item}</TooltipTrigger>
              <TooltipContent side="top" className="max-w-56">
                {opt.hint}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </Segmented>
    </TooltipProvider>
  );
}
