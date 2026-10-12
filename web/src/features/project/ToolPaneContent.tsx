import type { ComponentProps } from "react";

import { cn } from "@/src/lib/utils";

/** Shared width and padding for every pane in the Tools workspace. */
export function ToolPaneContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-4xl px-4 py-6 sm:px-6", className)}
      {...props}
    />
  );
}
