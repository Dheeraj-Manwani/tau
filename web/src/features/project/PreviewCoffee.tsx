import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CoffeeIcon, XIcon } from "lucide-react";
import { SUPPORT_TAU_URL } from "@/src/features/support/supportLink";

function wasDismissed(key: string) {
  try { return localStorage.getItem(key) === "dismissed"; } catch { return false; }
}

function wasShown(key: string) {
  try {
    return sessionStorage.getItem(key) === "shown";
  } catch {
    return false;
  }
}

/** A dismissible support link, shown after the project's preview is ready. */
export function PreviewCoffee({ projectId, ready }: { projectId: string; ready: boolean }) {
  const storageKey = `tau:preview-coffee:${projectId}`;
  const dismissKey = `${storageKey}:dismissed`;
  const [dismissed, setDismissed] = useState(() => wasDismissed(dismissKey));
  const [shown, setShown] = useState(() => wasShown(storageKey));

  useEffect(() => {
    if (!ready || shown || dismissed) return;
    const timer = setTimeout(() => {
      setShown(true);
      try {
        sessionStorage.setItem(storageKey, "shown");
      } catch {
        // The in-memory state still prevents repeat prompts without storage.
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [ready, shown, storageKey, dismissed]);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, "dismissed"); } catch { /* Keep the in-memory dismissal. */ }
  };

  return (
    <>
      {shown && !dismissed && createPortal(
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40">
        <a
          href={SUPPORT_TAU_URL}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Support tau: buy me a coffee"
          title="Support tau: buy me a coffee"
          className="grid size-11 place-items-center rounded-full border border-line-strong bg-space-overlay text-silver-600 shadow-[0_16px_48px_rgba(0,0,0,0.65)] transition-colors duration-150 hover:bg-space-raised hover:text-silver-900"
        >
          <CoffeeIcon className="size-5" />
        </a>
        <button type="button" onClick={dismiss} aria-label="Dismiss coffee reminder" title="Dismiss coffee reminder" className="absolute -top-1.5 -right-1.5 grid size-5 cursor-pointer place-items-center rounded-full border border-line-strong bg-space-raised text-silver-600 transition-colors hover:text-silver-900">
          <XIcon className="size-3" />
        </button>
        </div>,
        document.body,
      )}
    </>
  );
}
