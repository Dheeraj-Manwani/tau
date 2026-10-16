import type { ComponentProps } from "react";

import { cn } from "@/src/lib/utils";

/** Shared width and padding for every pane in the Tools workspace: an 860px
 *  column, centred (boards/Workspace-Secrets.dc.html and its siblings). */
export function ToolPaneContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[860px] px-5 py-7 sm:px-8 lg:px-12 lg:pt-9 lg:pb-10", className)}
      {...props}
    />
  );
}
