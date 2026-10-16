import { useNavigate } from "react-router-dom";
import { CheckIcon, ZapIcon } from "lucide-react";

import { useUpgradeModalStore } from "./useUpgradeModalStore";
import { UpgradeProButton } from "./UpgradeProButton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { APP_BILLING } from "@/src/lib/routes";
import { PRO_FEATURES, PRO_PRICE_INR } from "@/src/lib/pricing";

/**
 * Global "upgrade to Pro" modal: open it from anywhere via
 * useUpgradeModalStore. The Pro card from Billing, with the one orange button.
 */
export function UpgradeModal() {
  const open = useUpgradeModalStore((s) => s.open);
  const title = useUpgradeModalStore((s) => s.title);
  const close = useUpgradeModalStore((s) => s.close);
  const navigate = useNavigate();

  const handleUpgrade = () => {
    close();
    navigate(`${APP_BILLING}#pro-plan`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <Badge tone="pro">
              <ZapIcon />
              PRO
            </Badge>
            <span className="font-mono text-xs text-silver-500">Cancel anytime</span>
          </div>
          <div className="flex items-baseline gap-2.5">
            <span className="display-heading text-[48px]">
              ₹{PRO_PRICE_INR.toLocaleString("en-IN")}
            </span>
            <span className="font-mono text-xs text-silver-500">/ month</span>
          </div>
          <ul className="flex flex-col gap-[11px] text-[13.5px]">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <CheckIcon className="size-4 shrink-0 text-green-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Not now
          </Button>
          <UpgradeProButton onClick={handleUpgrade} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
