import { RotateCwIcon, TriangleAlertIcon, WrenchIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { PreviewStateCard } from "@/src/features/project/PreviewStateCard";

const COPY = {
  app: {
    title: "App crashed on start",
    description:
      "Your app hit an error before it could show anything. Your files are safe, and tau can find the cause and fix it.",
  },
  load: {
    title: "Preview didn't load",
    description:
      "The preview couldn't finish loading. Your project is saved, so give it another try.",
  },
};

/**
 * What the preview shows when its frame never came up. Pure presentation:
 * `PreviewPane.tsx` keeps the recovery state and the two actions.
 *
 * Two cases, told apart by `appError`. The app's own code failed (it threw
 * while starting, or did not compile): reloading alone will fail the same way,
 * so asking tau is the primary. Or the frame simply did not load (a slow or
 * dropped connection to the sandbox): there is nothing to fix, only to retry.
 */
export function PreviewFailedCard({
  appError,
  excerpt,
  onFix,
  onReload,
  canFix,
  isSending,
  coverImageUrl,
}: {
  appError: boolean;
  /** The first error the app reported about itself, when it said one. */
  excerpt?: string;
  onFix: () => void;
  onReload: () => void;
  canFix: boolean;
  isSending: boolean;
  coverImageUrl?: string | null;
}) {
  const copy = appError ? COPY.app : COPY.load;

  return (
    <PreviewStateCard
      role="alert"
      icon={appError ? TriangleAlertIcon : RotateCwIcon}
      tone={appError ? "error" : "neutral"}
      title={copy.title}
      description={copy.description}
      detail={appError ? excerpt : undefined}
      coverImageUrl={coverImageUrl}
      actions={
        <>
          {appError && (
            <Button
              onClick={onFix}
              disabled={!canFix}
              loading={isSending}
              title={
                canFix
                  ? "Ask tau to find and fix the error"
                  : "tau is already working on something"
              }
            >
              {!isSending && <WrenchIcon />}
              Ask tau to fix
            </Button>
          )}
          <Button variant={appError ? "secondary" : "primary"} onClick={onReload}>
            <RotateCwIcon />
            Reload preview
          </Button>
        </>
      }
    />
  );
}

export default PreviewFailedCard;
