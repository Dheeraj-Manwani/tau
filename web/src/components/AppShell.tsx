import { useEffect } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";

import { UserMenu } from "@/src/components/UserMenu";
import { OutOfCreditsModal } from "@/src/features/billing/OutOfCreditsModal";
import { UpgradeModal } from "@/src/features/billing/UpgradeModal";
import { SettingsModal } from "@/src/features/settings/SettingsModal";
import { MotionIntroDialog } from "@/src/features/settings/MotionIntroDialog";
import { FeedbackModal } from "@/src/features/feedback/FeedbackModal";
import { usePreferences } from "@/src/features/settings/preferences";
import { SupportTauModal } from "@/src/features/support/SupportTauModal";
import { SiteFooter } from "@/src/components/SiteFooter";
import { APP_ACCOUNT, APP_BILLING, APP_HOME } from "@/src/lib/routes";

/**
 * The authenticated product shell on app.tauai.pro. Extracted from the
 * former `App.tsx` when the router grew a public half; `MarketingShell` and
 * `DocsShell` are its siblings.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  // The project editor is a full-screen workspace: it hides the app navbar.
  const isProject = pathname.startsWith("/project/");
  const isHome = pathname === APP_HOME;
  // The buy-credits flow is a focused purchase decision - the watermark is a
  // flourish for pages someone lingers on, not one mid-checkout.
  const isBilling = pathname === APP_BILLING;
  const isAccount = pathname === APP_ACCOUNT;
  const reduceMotion = usePreferences().reduceMotion ?? false;

  // Settings › Reduce motion stops the CSS loops in index.css the same way
  // the OS setting does.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-reduce-motion", reduceMotion);
  }, [reduceMotion]);

  return (
    // Arrives once, after the splash: a 150ms fade, not a jump.
    <div className="page-fade flex h-[100svh] flex-col">
      {!isProject && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-50">
          <div className="mx-auto flex h-20 w-full max-w-[1100px] items-center justify-between px-6">
            <Link
              to={APP_HOME}
              aria-label="tau home"
              className="pointer-events-auto flex items-center gap-2"
            >
              <span className="logo-mark size-7" role="img" aria-label="tau" />
            </Link>
            <div className="pointer-events-auto flex items-center gap-3">
              <UserMenu />
            </div>
          </div>
        </header>
      )}

      <main className="min-h-0 flex-1 overflow-auto">{outlet}</main>
      {!isProject && !isHome && (
        <SiteFooter watermark={!isBilling && !isAccount} />
      )}
      <OutOfCreditsModal />
      <UpgradeModal />
      <SettingsModal />
      <MotionIntroDialog />
      <FeedbackModal />
      <SupportTauModal />
    </div>
  );
}

export default AppShell;
