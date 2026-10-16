import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/src/lib/utils";

/** Blue means on. The thumb turns dark ink when on so it never disappears
 *  into the track (boards/Controls.dc.html §02). */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-[#2a2a30] transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:bg-blue-500",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-silver-600 transition-[transform,background-color] duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-blue-900" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
