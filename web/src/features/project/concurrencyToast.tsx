import toast from "react-hot-toast";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { cancelAllJobs } from "@/src/features/project/api";

/**
 * The 429 shown when the user already has the maximum number of generations
 * running. Unlike a plain `toast.error`, this one offers a "Stop all running"
 * action that cancels every in-flight job so the slot frees up and the user can
 * retry immediately instead of waiting for the running one to finish.
 *
 * Shared by both composers (Home + project chat) so the message and behaviour
 * stay in one place.
 */
export function showConcurrentJobLimitToast(): void {
  toast(
    (t) => (
      <div className="flex flex-col gap-2">
        <span>
          Tau is already busy with as many builds as your plan allows.
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            toast.dismiss(t.id);
            void toast.promise(cancelAllJobs(), {
              loading: "Stopping your active builds…",
              success: ({ cancelled }) =>
                cancelled > 0
                  ? `Stopped ${cancelled} active build${cancelled === 1 ? "" : "s"}. You can start a new one now.`
                  : "There were no active builds to stop.",
              error: "Couldn't stop your active builds. Please try again.",
            });
          }}
          className="self-start"
        >
          Stop all running
        </Button>
      </div>
    ),
    {
      duration: 8000,
      // Waiting, not failed: orange (plan §4.1).
      icon: <TriangleAlertIcon className="size-4 shrink-0 text-orange-400" />,
    },
  );
}
