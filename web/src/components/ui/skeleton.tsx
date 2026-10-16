import * as React from "react";

import { cn } from "@/src/lib/utils";

/** Loading rows shaped like the content they stand in for. The shimmer
 *  stops under reduced motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-[skeleton-shimmer_1.6s_linear_infinite] rounded-xs bg-[linear-gradient(90deg,#17171a_0,#202024_50%,#17171a_100%)] bg-size-[200%_100%] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
