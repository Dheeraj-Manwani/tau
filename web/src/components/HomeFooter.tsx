import { ArrowUpRightIcon } from "lucide-react";
import { LANDING_DOCS, LANDING_HOME, LANDING_PRICING, LANDING_PRIVACY, LANDING_TERMS } from "@/src/lib/routes";

/** Home's footer: grey links (footer links never go blue) and the hollow
 *  "Describe it. Build it." watermark, which belongs to the brand moment. */
export function HomeFooter() {
  return (
    <footer className="relative mt-12 w-full pb-8">
      <div className="flex flex-col justify-between gap-8 border-t border-line pt-10 sm:flex-row">
        <div>
          <a href={LANDING_HOME} aria-label="Tau home" className="display-heading inline-flex items-center gap-2.5 text-xl text-silver-900">
            <span className="logo-mark size-6" aria-hidden="true" />
            tau
          </a>
          <p className="mt-3 text-sm text-silver-600">A little curiosity. Something real.</p>
          <p className="mt-1 text-xs text-silver-500">Your next idea is closer than you think.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-7 gap-y-4 text-[13px] text-silver-600">
          <a href={LANDING_DOCS} className="inline-flex items-center gap-1 transition-colors hover:text-silver-900">
            Docs
            <ArrowUpRightIcon className="size-3" />
          </a>
          <a href={LANDING_PRICING} className="transition-colors hover:text-silver-900">
            Pricing
          </a>
          <a href={LANDING_PRIVACY} className="transition-colors hover:text-silver-900">
            Privacy
          </a>
          <a href={LANDING_TERMS} className="transition-colors hover:text-silver-900">
            Terms
          </a>
        </nav>
      </div>

      <p
        aria-hidden="true"
        className="text-hollow display-heading mt-10 overflow-hidden text-[clamp(2.5rem,11vw,6rem)] text-nowrap select-none"
      >
        Describe it. Build it.
      </p>

      <div className="mt-6 flex items-center justify-between gap-4 font-mono text-[11px] text-silver-500">
        <span>© {new Date().getFullYear()} tau</span>
        <span>describe it. build it.</span>
      </div>
    </footer>
  );
}
