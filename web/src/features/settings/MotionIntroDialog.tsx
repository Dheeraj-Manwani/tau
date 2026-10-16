import { useState } from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Switch } from "@/src/components/ui/switch";
import { useSettings } from "@/src/hooks/useSettings";
import { SettingsRow } from "@/src/features/settings/SettingsRow";

/**
 * One-time "reduce motion" offer on a user's first visit.
 *
 * A centred dialog rather than a popover on the avatar: the avatar sits in a
 * different header on every page, so an anchored card landed somewhere new
 * each time. Mounted once in AppShell; the project tours wait for it to be
 * dismissed so the two never stack.
 */
export function MotionIntroDialog() {
  const { hasSeenMotionIntro, markMotionIntroSeen } = useSettings();
  const [reduce, setReduce] = useState(false);

  return (
    <Dialog
      open={!hasSeenMotionIntro}
      onOpenChange={(open) => {
        // Any close (Continue, Esc, clicking outside) counts as "seen". One
        // write for both flags, so the choice can't be lost while the intro is
        // marked seen.
        if (!open)
          markMotionIntroSeen(reduce ? { reduceMotion: true } : undefined);
      }}
    >
      <DialogContent showCloseButton={false} className="sm:max-w-[440px]">
        <DialogHeader className="pr-0">
          <DialogTitle>Make tau comfortable</DialogTitle>
          <DialogDescription>
            Prefer a calmer interface? Reduce animations and visual effects.
          </DialogDescription>
        </DialogHeader>

        <SettingsRow
          title="Reduce motion"
          htmlFor="motion-intro-reduce"
          help="Turn off the rain, lightning and glitch effects."
          className="-mt-1 pb-0"
          control={
            <Switch
              id="motion-intro-reduce"
              checked={reduce}
              onCheckedChange={setReduce}
            />
          }
        />

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-silver-500">
            You can change this anytime in Settings.
          </p>
          <DialogClose asChild>
            <Button>Continue</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
