import { Link } from "react-router-dom";
import { SupportTauButton } from "@/src/components/SupportTauButton";

export function SiteFooter() {
  return (
    <footer className="border-t border-line px-6 py-3">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-silver-500">
          <span className="font-mono text-[11px]">© {new Date().getFullYear()} Tau. All rights reserved.</span>
          <nav className="flex flex-wrap items-center gap-4">
            <SupportTauButton className="cursor-pointer hover:text-silver-900" />
            <Link to="/pricing" className="hover:text-silver-900">
              Pricing
            </Link>
            <Link to="/privacy" className="hover:text-silver-900">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-silver-900">
              Terms &amp; Cancellation
            </Link>
            <a href="mailto:iammadfortech@gmail.com" className="hover:text-silver-900">
              Contact
            </a>
          </nav>
        </div>

        <p
          aria-hidden="true"
          className="text-hollow display-heading mt-4 overflow-hidden text-nowrap text-[clamp(2rem,9vw,4.5rem)] leading-none select-none"
        >
          Describe it. Build it.
        </p>
      </div>
    </footer>
  );
}
