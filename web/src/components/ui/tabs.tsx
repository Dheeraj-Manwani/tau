import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/src/lib/utils";

/**
 * Underline tabs split one page into sections (Overview, Name & logo, …).
 * The active label is white and a 2px blue underline carries the state.
 * A count goes in `TabsCount`; a spinner child shows work running in a tab.
 * boards/Controls.dc.html §03.
 */
function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("scrollbar-none flex gap-6.5 overflow-x-auto border-b border-line", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center gap-2 py-2.5 text-[13px] font-medium whitespace-nowrap text-silver-600 transition-colors duration-150 outline-none hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 data-[state=active]:text-silver-900 data-[state=active]:after:absolute data-[state=active]:after:inset-x-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full data-[state=active]:after:bg-blue-500 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-mono text-[11px] text-silver-500", className)} {...props} />;
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger };
