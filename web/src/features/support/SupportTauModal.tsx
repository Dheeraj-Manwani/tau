import { ArrowUpRightIcon, CoffeeIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useSupportStore } from "./useSupportStore";
import { SUPPORT_TAU_URL } from "./supportLink";

/** A plain tier C ask: what the money does and one way to give it. The amount
 *  is chosen on Buy Me a Coffee, so nothing here pretends to take payment. */
export function SupportTauModal() {
  const isOpen = useSupportStore((s) => s.isOpen);
  const setOpen = useSupportStore((s) => s.setOpen);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <span className="mb-2 grid size-11 place-items-center rounded-lg border border-line-strong bg-space-raised text-silver-600">
            <CoffeeIcon className="size-5" />
          </span>
          <DialogTitle>Support tau</DialogTitle>
          <DialogDescription>
            Enjoying tau? Buy me a coffee to support its development.
          </DialogDescription>
        </DialogHeader>

        <p className="font-mono text-xs text-silver-500">
          Opens buymeacoffee.com in a new tab · you pick the amount there
        </p>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button asChild>
            <a href={SUPPORT_TAU_URL} target="_blank" rel="noreferrer noopener">
              Buy me a coffee
              <ArrowUpRightIcon />
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
