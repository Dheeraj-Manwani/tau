import { RotateCwIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { TauMark } from "@/src/components/motion/TauMark";
import { useNow } from "@/src/hooks/useNow";
import {
  formatDuration,
  formatElapsed,
  isRunningView,
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
  onResume,
  resuming = false,
  className,
}: {
  view: ChatLoaderView;
  /** When the run started here; the timer hides when unknown. */
  runStartedAt: number | null;
  onResume?: () => void;
  resuming?: boolean;
  className?: string;
}) {
  const running = isRunningView(view);
  const timing = running && runStartedAt !== null;
  const now = useNow(timing);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-8 min-w-0 items-center gap-3", className)}
    >
      {/* One row for every live phase, so the mark and the shimmer stay
          mounted and keep moving while only the words change. */}
      {running && (
        <>
          <TauMark />
          <span className="shimmer-text max-w-[60%] shrink-0 truncate text-sm font-medium">{view.label}</span>
          {(view.detail || view.target) && (
            <span
              key={`${view.detail}|${view.target}`}
              className="loader-detail-in min-w-0 truncate text-xs text-silver-500"
            >
              {view.detail}
              {view.detail && view.target && " "}
              {view.target && <span className="font-mono text-silver-600">{view.target}</span>}
            </span>
          )}
          {/* The run's clock, pinned right: it times the run, not the step,
              and stays put while the step beside the headline changes. */}
          {timing && (
            <span className="ml-auto shrink-0 pl-2 font-mono text-xs tabular-nums text-silver-500" aria-hidden="true">
              {formatElapsed((now - runStartedAt) / 1000)}
            </span>
          )}
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
