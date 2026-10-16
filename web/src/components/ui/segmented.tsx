import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { cn } from "@/src/lib/utils";

/**
 * A segmented control switches what you are looking at (PREVIEW / CODE /
 * TOOLS, LOW / HIGH / MAX, ALL / SPENT / ADDED). The active item is a raised
 * neutral chip with white text and a blue icon: never a blue fill.
 * boards/Controls.dc.html §03.
 *
 * `size="sm"` is the mono-caps form; `iconOnly` makes square 32px items.
 */
type SegmentedProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive.Root>,
  "type" | "value" | "defaultValue" | "onValueChange"
> & {
  value: string;
  onValueChange: (value: string) => void;
  size?: "default" | "sm";
  iconOnly?: boolean;
};

const SegmentedContext = React.createContext<{ size: "default" | "sm"; iconOnly: boolean }>({
  size: "default",
  iconOnly: false,
});

function Segmented({ className, value, onValueChange, size = "default", iconOnly = false, ...props }: SegmentedProps) {
  return (
    <SegmentedContext.Provider value={{ size, iconOnly }}>
      <ToggleGroupPrimitive.Root
        data-slot="segmented"
        type="single"
        value={value}
        // A segmented control always has one item on: ignore the "unselect".
        onValueChange={(next) => next && onValueChange(next)}
        className={cn(
          "inline-flex w-fit shrink-0 items-center gap-0.5 self-start border border-line bg-space-surface",
          size === "sm" ? "rounded-md p-0.5" : "rounded-lg p-[3px]",
          className,
        )}
        {...props}
      />
    </SegmentedContext.Provider>
  );
}

function SegmentedItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  const { size, iconOnly } = React.useContext(SegmentedContext);
  return (
    <ToggleGroupPrimitive.Item
      data-slot="segmented-item"
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 border-0 text-silver-600 transition-[background-color,color,box-shadow] duration-150 outline-none hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 data-[state=on]:bg-space-raised data-[state=on]:text-silver-900 data-[state=on]:shadow-[inset_0_0_0_1px_var(--line-strong),0_1px_2px_rgba(0,0,0,0.4)] data-[state=on]:[&_svg]:text-blue-500 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        size === "sm"
          ? "h-6 rounded-sm px-2.5 font-mono text-[11px] font-medium tracking-[0.06em] uppercase"
          : "h-[30px] rounded-[9px] px-3 text-xs font-medium",
        iconOnly && (size === "sm" ? "w-6 px-0" : "w-8 px-0"),
        className,
      )}
      {...props}
    />
  );
}

export { Segmented, SegmentedItem };
