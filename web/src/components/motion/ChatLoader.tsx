import type { ReactNode } from "react";
import { RotateCwIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { TauMark } from "@/src/components/motion/TauMark";
import { useNow } from "@/src/hooks/useNow";
import {
  formatDuration,
  formatElapsed,
  type ChatLoaderView,
} from "@/src/features/project/chatLoaderState";
import { cn } from "@/src/lib/utils";

/**
 * The one loader for every wait in chat (boards/Chat-Loader.dc.html). Five
 * states, one mark, and a fixed row height so nothing shifts as they change.
 * Elapsed time, never a percent. It is the only thing that moves in chat.
 */
export function ChatLoader({
  view,
  runStartedAt,
  actionIcon,
  onResume,
  resuming = false,
  className,
}: {
  view: ChatLoaderView;
  /** When the run started here; the thinking timer hides when unknown. */
  runStartedAt: number | null;
  /** Icon for the live action (the same one its chip shows). */
  actionIcon?: ReactNode;
  onResume?: () => void;
  resuming?: boolean;
  className?: string;
}) {
  const timing = view.kind === "thinking" && runStartedAt !== null;
  const now = useNow(timing);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-8 min-w-0 items-center gap-3", className)}
    >
      {view.kind === "thinking" && (
        <>
          <TauMark />
          <span className="shimmer-text truncate text-sm font-medium">{view.label}</span>
          {timing && (
            <span className="font-mono text-xs tabular-nums text-silver-500" aria-hidden="true">
              {formatElapsed((now - runStartedAt) / 1000)}
            </span>
          )}
        </>
      )}

      {view.kind === "working" && (
        <>
          <TauMark />
          <div className="action-sweep flex h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md border border-line bg-space-surface px-3 text-[12.5px] text-silver-600">
            <span aria-hidden="true" className="flex shrink-0 text-silver-500 [&_svg]:size-3.5">
              {actionIcon}
            </span>
            <span className="shrink-0">{view.verb}</span>
            {view.target && (
              <span className="min-w-0 truncate font-mono text-xs text-silver-900">{view.target}</span>
            )}
          </div>
        </>
      )}

      {view.kind === "writing" && (
        <>
          {/* The words own the eye: the mark settles to a still 20px tile. */}
          <span className="flex size-7 shrink-0 items-center justify-center">
            <TauMark size={20} state="still" />
          </span>
          <span className="text-xs text-silver-500">Writing</span>
        </>
      )}

      {view.kind === "stopped" && (
        <>
          <TauMark state="still" />
          <span className="text-[13px] text-silver-600">Stopped</span>
          {onResume && (
            <Button variant="secondary" size="sm" onClick={onResume} disabled={resuming}>
              <RotateCwIcon />
              Resume
            </Button>
          )}
        </>
      )}

      {view.kind === "done" && (
        <>
          <TauMark state="done" />
          <span className="font-mono text-xs text-silver-500">
            {view.seconds !== null ? `Done in ${formatDuration(view.seconds)}` : "Done"}
            {view.actions > 0 && ` · ${view.actions} action${view.actions === 1 ? "" : "s"}`}
          </span>
        </>
      )}
    </div>
  );
}
