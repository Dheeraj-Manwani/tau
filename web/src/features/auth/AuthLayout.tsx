import type { ReactNode } from "react";

import { RainLayer } from "@/src/components/motion/RainLayer";
import { SiteFooter } from "@/src/components/SiteFooter";
import { cn } from "@/src/lib/utils";

/**
 * The frame every auth route shares (doc/REDESIGN_PLAN.md Phase 10): void
 * page, rain behind that clears around the centre, and one 400px surface card
 * holding the τ mark (or a status tile), a Display S title, the form and a
 * footer link. Rain is tier A brand weather; the card itself is tier C.
 */
export function AuthLayout({
  icon,
  title,
  subtitle,
  children,
  footer,
  className,
}: {
  /** Replaces the τ mark: a status tile on the verify and callback screens. */
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative flex min-h-[100svh] flex-col overflow-hidden bg-space-void">
      <RainLayer fill className="rain-layer--clear-centre" />

      <main className="page-fade relative flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
        <div
          className={cn(
            "w-full max-w-[400px] rounded-lg border border-line bg-space-surface px-6 py-7 sm:px-8 sm:py-8",
            className,
          )}
        >
          <div className="flex flex-col items-center text-center">
            <div className="mb-5 flex items-center">
              {icon ?? <span className="logo-mark size-9" role="img" aria-label="tau" />}
            </div>
            <h1 className="display-heading display-s text-silver-900">{title}</h1>
            {subtitle && (
              <p className="mt-2.5 text-sm leading-relaxed text-silver-600">{subtitle}</p>
            )}
          </div>
          {children && <div className="mt-6">{children}</div>}
        </div>

        {footer && (
          <p className="mt-6 text-center text-[13px] text-silver-600">{footer}</p>
        )}
      </main>

      <div className="relative">
        <SiteFooter watermark={false} />
      </div>
    </div>
  );
}

/** A status tile for the auth card's header: an icon on overlay, or the
 *  raining τ while something is in flight. */
export function AuthTile({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-10 place-items-center rounded-md border border-line-strong bg-space-overlay text-silver-600 [&_svg]:size-[18px]">
      {children}
    </span>
  );
}

/** The thin "or" divider between Google and the email form. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 font-mono text-[11px] tracking-[0.12em] text-silver-500 uppercase">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Terms caption under the sign-in forms; links stay grey. */
export function AuthTerms({ terms, privacy }: { terms: string; privacy: string }) {
  return (
    <p className="mt-5 text-center text-xs leading-relaxed text-silver-500">
      By continuing you agree to our{" "}
      <a href={terms} className="underline underline-offset-3 hover:text-silver-900">
        Terms of Service
      </a>{" "}
      and{" "}
      <a href={privacy} className="underline underline-offset-3 hover:text-silver-900">
        Privacy Policy
      </a>
      .
    </p>
  );
}
