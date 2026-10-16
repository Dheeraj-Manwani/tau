import toast from "react-hot-toast";

export const SUCCESS_CELEBRATION_EVENT = "tau:success-celebration";

/** Only call after redemption or payment succeeds, never when checkout opens.
 *  A purchase is a calm (tier B) moment: a toast, no confetti. */
export function celebrateSuccess(message: string): void {
  toast.success(message);
}

/** A project's first deploy going live: the one confetti moment in tau. */
export function celebrateFirstDeploy(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SUCCESS_CELEBRATION_EVENT));
  }
}
