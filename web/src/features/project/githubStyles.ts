import { buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";

/** GitHub's links-as-buttons and cards, on the shared system: a secondary
 *  button, the one primary, and a surface card with a hairline edge. */
export const githubButtonClass = cn(buttonVariants({ variant: "secondary", size: "sm" }), "min-h-9 sm:min-h-7");
export const githubPrimaryClass =
  "border-transparent bg-blue-500 font-semibold text-blue-900 hover:border-transparent hover:bg-blue-hi active:bg-blue-lo";
export const githubCardClass = "rounded-lg border border-line bg-space-surface";
