import { useEffect, useRef } from "react";

import { boltFlash } from "@/src/lib/bolt";
import { useProjectStore } from "@/src/stores/useProjectStore";

/**
 * The first build finishing is a tier A moment: one bolt flash when a chat
 * run that started without a preview ends done with one. Later turns rebuild
 * the same preview and stay quiet, so the flash keeps meaning something.
 */
export function useFirstBuildFlash() {
  const status = useProjectStore((s) => s.status);
  const isPreviewJob = useProjectStore((s) => s.isPreviewJob);
  const previewUrl = useProjectStore((s) => s.previewUrl);
  const run = useRef<{ streaming: boolean; hadPreview: boolean }>({
    streaming: false,
    hadPreview: true,
  });

  useEffect(() => {
    const before = run.current;
    if (status === "streaming" && !isPreviewJob) {
      if (!before.streaming) run.current = { streaming: true, hadPreview: previewUrl !== null };
      return;
    }
    run.current = { streaming: false, hadPreview: true };
    if (before.streaming && !before.hadPreview && status === "done" && previewUrl !== null) {
      boltFlash();
    }
  }, [status, isPreviewJob, previewUrl]);
}
