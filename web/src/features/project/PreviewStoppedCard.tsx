import { MoonIcon, PlayIcon, RotateCwIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { PreviewStateCard } from "@/src/features/project/PreviewStateCard";

const ANIMATION: Partial<Record<string, string>> = {
  stopped: "/Sleepy-Moon.json",
  restoring: "/Hammer-animation.json",
};

const COPY: Record<string, { title: string; description: string }> = {
  stopped: {
    title: "Preview is asleep",
    description:
      "Sandboxes pause when idle to save credits. Your files are safe, and starting it again takes about ten seconds.",
  },
  restoring: {
    title: "Waking the preview",
    description: "Bringing your sandbox back. This takes a few seconds.",
  },
  checking: {
    title: "Checking preview",
    description: "Confirming your sandbox is still running.",
  },
  failed: {
    title: "Couldn't restore preview",
    description: "Something went wrong waking the sandbox. Give it another try.",
  },
};

/**
 * The asleep preview: neutral, not an error. Pure presentation:
 * `PreviewPane.tsx` keeps the restart mutation and the surface-mode
 * derivation; this only renders the state it's given.
 */
export function PreviewStoppedCard({
  mode,
  onStart,
  coverImageUrl,
}: {
  mode: "stopped" | "restoring" | "checking" | "failed";
  onStart: () => void;
  coverImageUrl: string | null;
}) {
  const starting = mode === "restoring" || mode === "checking";
  const copy = COPY[mode] ?? COPY.stopped!;

  return (
    <PreviewStateCard
      role={starting ? "status" : mode === "failed" ? "alert" : undefined}
      animation={ANIMATION[mode]}
      icon={mode === "failed" ? RotateCwIcon : MoonIcon}
      tone={mode === "failed" ? "error" : "neutral"}
      busy={starting}
      title={copy.title}
      description={copy.description}
      coverImageUrl={coverImageUrl}
      actions={
        !starting && (
          <Button onClick={onStart}>
            <PlayIcon className="fill-current" />
            {mode === "failed" ? "Retry preview" : "Start preview"}
          </Button>
        )
      }
    />
  );
}

export default PreviewStoppedCard;
