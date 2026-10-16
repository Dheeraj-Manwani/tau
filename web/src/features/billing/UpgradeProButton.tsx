import type { ComponentProps } from "react";
import { ZapIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";

/**
 * "Upgrade to Pro": the one orange button in the product, shown on the free
 * plan only (boards/Controls.dc.html §01).
 */
export function UpgradeProButton({
  children = "Upgrade to Pro",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button variant="upgrade" {...props}>
      <ZapIcon className="fill-current" />
      {children}
    </Button>
  );
}
