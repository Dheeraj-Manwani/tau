import { Link } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { RainLayer } from "@/src/components/motion/RainLayer";
import { Button } from "@/src/components/ui/button";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { LANDING_DOCS } from "@/src/lib/routes";

/** The catch-all 404: a quiet tier A page, rain and one way home. */
function NotFound() {
  useDocumentMeta({
    title: "Page not found",
    description: "There's no app page at this address.",
    noIndex: true,
  });

  return (
    <div className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-space-void px-6 py-16 text-center">
      <RainLayer fill />
      <div className="page-fade relative flex flex-col items-center">
        <p className="font-mono text-[11px] tracking-[0.16em] text-blue-500 uppercase">404 · Not found</p>
        <h1 className="display-heading display-l mt-4 text-silver-900 max-sm:text-[40px]">Lost in the rain</h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-silver-600">
          There's nothing at this address. The project may have moved, or the link may be out of date. Your projects are safe.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/">
              <ArrowLeftIcon />
              Back home
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <a href={LANDING_DOCS}>Read the docs</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
