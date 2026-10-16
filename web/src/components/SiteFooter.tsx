import {
  LANDING_PRICING,
  LANDING_PRIVACY,
  LANDING_TERMS,
} from "@/src/lib/routes";
import { useSupportStore } from "@/src/features/support/useSupportStore";

export function SiteFooter({
  /** The auth pages (login/signup) are a focused, single-task flow - the big
   *  watermark line is a flourish for pages someone lingers on, not one they're
   *  trying to get through quickly. */
  watermark = true,
}: {
  watermark?: boolean;
}) {
  const openSupport = useSupportStore((s) => s.open);
  return (
    <footer className="border-t border-line px-6 py-3">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-silver-500">
          <span>© {new Date().getFullYear()} Tau. All rights reserved.</span>
          <nav className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={openSupport} className="cursor-pointer transition-colors hover:text-silver-900">
              Support tau
            </button>
            <a href={LANDING_PRICING} className="transition-colors hover:text-silver-900">
              Pricing
            </a>
            <a href={LANDING_PRIVACY} className="transition-colors hover:text-silver-900">
              Privacy Policy
            </a>
            <a href={LANDING_TERMS} className="transition-colors hover:text-silver-900">
              Terms &amp; Cancellation
            </a>
            <a
              href="mailto:iammadfortech@gmail.com"
              className="transition-colors hover:text-silver-900"
            >
              Contact
            </a>
          </nav>
        </div>

        {watermark && (
          <p
            aria-hidden="true"
            className="text-hollow display-heading mt-4 overflow-hidden text-nowrap text-[clamp(2rem,9vw,4.5rem)] leading-none select-none"
          >
            Describe it. Build it.
          </p>
        )}
      </div>
    </footer>
  );
}
