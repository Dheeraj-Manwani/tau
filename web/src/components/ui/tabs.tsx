import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { TabIndicator } from "@/src/components/motion/TabIndicator";
import { useSmoothPanels } from "@/src/hooks/useSmoothPanels";
import { cn } from "@/src/lib/utils";

/**
 * Underline tabs split one page into sections (Overview, Name & logo, …).
 * The active label is white and a 2px blue underline carries the state.
 * A count goes in `TabsCount`; a spinner child shows work running in a tab.
 * boards/Controls.dc.html §03.
 *
 * Smooth tabs (motion/TabIndicator, hooks/useSmoothPanels): the underline slides to the
 * new tab and the panels slide over in the same direction. `forceMount` on
 * a `TabsContent` keeps it mounted (hidden) while another tab is open.
 */
const TabsContext = React.createContext<{
  value: string;
  shown: string;
  indicatorId: string;
  panel: (value: string) => (el: HTMLElement | null) => void;
} | null>(null);

function Tabs({
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const value = valueProp ?? uncontrolled;
  const root = React.useRef<HTMLDivElement>(null);
  const indicatorId = React.useId();
  const indexOf = React.useCallback(
    (v: string) =>
      Array.from(root.current?.querySelectorAll<HTMLElement>('[data-slot="tabs-trigger"]') ?? []).findIndex(
        (trigger) => trigger.dataset.value === v,
      ),
    [],
  );
  const { shown, panel } = useSmoothPanels(value, indexOf);

  return (
    <TabsContext.Provider value={{ value, shown, indicatorId, panel }}>
      <TabsPrimitive.Root
        ref={root}
        data-slot="tabs"
        value={value}
        onValueChange={(next) => {
          setUncontrolled(next);
          onValueChange?.(next);
        }}
        {...props}
      />
    </TabsContext.Provider>
  );
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

function TabsTrigger({ className, value, children, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const tabs = React.useContext(TabsContext);
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-value={value}
      value={value}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center gap-2 py-2.5 text-[13px] font-medium whitespace-nowrap text-silver-600 transition-colors duration-150 outline-none hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 data-[state=active]:text-silver-900 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      {children}
      {tabs?.value === value && (
        <TabIndicator
          id={tabs.indicatorId}
          className="inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-500"
        />
      )}
    </TabsPrimitive.Trigger>
  );
}

function TabsCount({ className, ...props }: React.ComponentProps<"span">) {
  return <span className={cn("font-mono text-[11px] text-silver-500", className)} {...props} />;
}

function TabsContent({
  className,
  value,
  forceMount,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  const tabs = React.useContext(TabsContext);
  const shown = tabs ? tabs.shown === value : false;
  if (!shown && !forceMount) return null;
  return (
    <TabsPrimitive.Content
      ref={tabs?.panel(value)}
      data-slot="tabs-content"
      value={value}
      // Mounted by us, not Radix: a panel stays up while it slides away.
      forceMount
      hidden={!shown}
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsCount, TabsList, TabsTrigger };
