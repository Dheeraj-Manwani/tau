import * as React from "react";

import { cn } from "@/src/lib/utils";

/** A key cap: `Send ⌘ ↵`. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex items-center rounded-xs border border-b-2 border-line-strong bg-space-surface px-1.5 py-[3px] font-mono text-[11px] leading-none font-medium text-silver-600",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
