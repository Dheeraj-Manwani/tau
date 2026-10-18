import * as React from "react";
import { Slot } from "radix-ui";

import { TabIndicator } from "@/src/components/motion/TabIndicator";
import { cn } from "@/src/lib/utils";

/**
 * Sidebar nav (boards/Controls.dc.html §03): grey mono-caps section labels,
 * 36px rows, a raised row with a blue icon for the current page, and an
 * optional right-hand status dot or lock.
 *
 * Give the rows of one nav the same `indicator` (a `useId()`) and the raised
 * row slides to the current item (components/motion/TabIndicator).
 */
function SideNavSection({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-0.5 not-first:mt-3", className)}>
      <p className="lab px-2.5 pt-1 pb-2">{label}</p>
      {children}
    </div>
  );
}

function SideNavItem({
  current = false,
  trailing,
  asChild = false,
  indicator,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  current?: boolean;
  trailing?: React.ReactNode;
  asChild?: boolean;
  indicator?: string;
}) {
  const Comp = asChild ? Slot.Root : "button";
  const sliding = !!indicator && !asChild;
  return (
    <Comp
      type={asChild ? undefined : "button"}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-silver-600 transition-colors duration-150 outline-none hover:bg-space-raised hover:text-silver-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 aria-[current=page]:text-silver-900 aria-[current=page]:[&_svg:first-child]:text-blue-500 [&_svg]:size-4 [&_svg]:shrink-0",
        sliding ? "relative" : "aria-[current=page]:bg-space-raised",
        className,
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : sliding ? (
        <>
          {current && <TabIndicator id={indicator} radius={10} className="inset-0 bg-space-raised" />}
          <span className="relative z-10 flex min-w-0 flex-1 items-center gap-2.5">
            {children}
            {trailing && <span className="ml-auto flex items-center">{trailing}</span>}
          </span>
        </>
      ) : (
        <>
          {children}
          {trailing && <span className="ml-auto flex items-center">{trailing}</span>}
        </>
      )}
    </Comp>
  );
}

export { SideNavItem, SideNavSection };
