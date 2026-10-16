import * as React from "react";
import { Checkbox as CheckboxPrimitive, RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";

const boxClass =
  "peer inline-grid size-4 shrink-0 cursor-pointer place-content-center border border-line-hover bg-space-void outline-none transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40";

/** Blue fill with an ink check when on. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        boxClass,
        "rounded-[5px] data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500 data-[state=indeterminate]:border-blue-500 data-[state=indeterminate]:bg-blue-500",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-blue-900">
        <CheckIcon className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid gap-3", className)} {...props} />;
}

/** A blue edge and a blue centre when chosen. */
function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(boxClass, "rounded-full data-[state=checked]:border-blue-500", className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="block size-[7px] rounded-full bg-blue-500" />
    </RadioGroupPrimitive.Item>
  );
}

/**
 * Choice cards (credit packs, looks): the whole card is the radio. Selected is
 * a blue edge and a 12% blue tint, no second radio dot.
 */
function ChoiceCard({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="choice-card"
      className={cn(
        "relative flex min-w-0 cursor-pointer flex-col items-start gap-1.5 rounded-lg border border-line-strong bg-space-surface px-4 py-3.5 text-left text-silver-900 outline-none transition-colors duration-150 hover:border-line-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-500/12",
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox, ChoiceCard, RadioGroup, RadioGroupItem };
