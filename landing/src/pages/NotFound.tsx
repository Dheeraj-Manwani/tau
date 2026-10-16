import { Link, useLocation } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { RainLayer } from "@/src/components/motion/RainLayer";
import { Button } from "@/src/components/ui/button";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";

/**
 * The catch-all 404: a quiet tier A page with the brand's rain, a Display L
 * title and one way home (doc/REDESIGN_PLAN.md Phase 10, same as web's).
 *
 * Routed inside `MarketingShell`, so the real nav/footer still frame it.
 * `noIndex` because a soft 404 that crawlers index is worse than one they
 * skip: this is a client-rendered SPA, so the server has already answered 200.
 */
function NotFound() {
  const { pathname } = useLocation();

  useDocumentMeta({
    title: "Page not found",
    description: "There's no page at this address.",
    noIndex: true,
  });

  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden bg-space-void px-6 py-20 text-center">
      <RainLayer fill />

      <p className="absolute top-6 right-6 hidden font-mono text-xs text-silver-500 sm:block">
        GET {pathname} → 404
      </p>

      <div className="relative flex flex-col items-center">
        <p className="font-mono text-[11px] tracking-[0.16em] text-blue-500 uppercase">404 · Not found</p>
        <h1 className="display-heading display-l mt-4 text-silver-900 max-sm:text-[40px]">Lost in the rain</h1>
        <p className="mt-4 max-w-md text-[15px] leading-[1.7] text-silver-600">
          This page doesn't exist, or it moved. Your projects are safe, and the
          way back is clear.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {/* Secondary: the nav's Start building is this page's one primary. */}
          <Button asChild variant="secondary" size="lg">
            <Link to="/">
              <ArrowLeftIcon />
              Back home
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link to="/docs">Read the docs</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
