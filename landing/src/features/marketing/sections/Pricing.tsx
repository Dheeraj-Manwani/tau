import { Link } from "react-router-dom";
import { CheckIcon, ZapIcon } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { APP_BILLING, appPath } from "@/src/lib/routes";
import {
  CREDIT_PACKS,
  FREE_MAX_PROJECTS,
  FREE_SIGNUP_CREDITS,
  PRO_MONTHLY_CREDITS,
  PRO_PRICE_INR,
} from "@/src/features/marketing/data/effortTiers";

/**
 * Shared pricing building blocks: the home page's teaser section below (used
 * inside `.storm-landing`, where `.tier-card strong` already picks up Big
 * Shoulders Display) and the full `/pricing` page both render the same two
 * cards from the same data, so the numbers can never quietly drift between
 * the two surfaces.
 *
 * `.tier-card` / `.tiers-grid` / `.effort-meter` already existed in
 * storm.css - `.storm-landing h1, h2, h3, .tier-card strong, ...` even names
 * `.tier-card strong` by hand - but no component ever rendered them. This is
 * that component.
 */

export const FREE_FEATURES = [
  `${FREE_SIGNUP_CREDITS} free credits (one-time, on signup)`,
  `Up to ${FREE_MAX_PROJECTS} projects`,
  "Every effort level, including Max",
  "Try your app while Tau builds it",
  "Push your code to your own GitHub repo",
];

export const PRO_FEATURES = [
  `${PRO_MONTHLY_CREDITS.toLocaleString()} credits per month`,
  "Everything in Free",
  "Unlimited projects",
  "No tau badge on your previews and published sites",
  "AI-generated logos for your published apps",
  "Credits reset monthly with your billing cycle",
  "Priority support",
];

/** Per-pack marketing tag, keyed by credits - presentation only, no new numbers. */
export const PACK_TAGS: Record<number, string> = {
  100: "Quick top-up",
  500: "Most popular",
  2000: "Best value",
};

/** Segments in each plan's credit meter, lit proportionally against PRO's
 *  monthly allotment so Free and PRO sit on the same ruler. */
const METER_SEGMENTS = 12;
export function litSegmentsFor(credits: number): number {
  return Math.max(1, Math.round((credits / PRO_MONTHLY_CREDITS) * METER_SEGMENTS));
}

export function CreditMeter({ lit }: { lit: number }) {
  return (
    <div className="effort-meter" aria-hidden="true">
      {Array.from({ length: METER_SEGMENTS }, (_, i) => (
        <span key={i} className={i < lit ? "lit" : ""} />
      ))}
    </div>
  );
}

export function PlanCard({
  name,
  badge,
  description,
  price,
  period,
  creditsLabel,
  litSegments,
  features,
  bestFor,
  cta,
  ctaHref,
  highlight,
}: {
  name: string;
  badge?: string;
  description: string;
  price: string;
  period: string;
  creditsLabel: string;
  litSegments: number;
  features: string[];
  bestFor: string;
  cta: string;
  ctaHref: string;
  highlight?: boolean;
}) {
  return (
    // The same card as the app's Billing page (boards/Billing.dc.html): one
    // surface and a hairline. PRO adds the orange badge and the slow sheen,
    // the band's one loop; its CTA is the orange Upgrade, as in the app.
    <div
      className={cn(
        "tier-card relative flex flex-col gap-5",
        highlight && "max-tier conic-sheen overflow-hidden",
      )}
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="display-heading text-silver-900">{name}</h3>
          {badge && (
            <span className="mt-1 inline-flex h-5 shrink-0 items-center gap-1.5 rounded-xs border border-orange-400 bg-orange-400 px-2 text-[11px] font-semibold text-orange-ink">
              <ZapIcon className="size-3" />
              {badge}
            </span>
          )}
        </div>
        <p className="text-[13px] leading-relaxed text-silver-500">{description}</p>
      </div>

      <div className="tier-stats">
        <div>
          <strong className="text-silver-900">{price}</strong>
          <p className="mono">{period}</p>
        </div>
        <div>
          <strong className="text-silver-900">{creditsLabel}</strong>
          <p className="mono">credits</p>
        </div>
      </div>

      <CreditMeter lit={litSegments} />

      <ul className="flex-1 space-y-2.5 text-[13.5px]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-400" />
            <span className="text-silver-900">{f}</span>
          </li>
        ))}
      </ul>

      <div className="tier-bottom items-center">
        <span className="text-[13px] text-silver-500">{bestFor}</span>
        <Button asChild variant={highlight ? "upgrade" : "secondary"}>
          <a href={ctaHref}>{cta}</a>
        </Button>
      </div>
    </div>
  );
}

/** Home-page teaser: the same two cards, plus a link out to the full `/pricing`
 *  page for top-ups and the credits explainer. */
export function PricingSection() {
  return (
    <section id="pricing" className="storm-container storm-band">
      <div className="eyebrow">// PRICING</div>
      <h2>
        Pay per
        <br />
        <span>strike</span>
      </h2>
      <p className="section-copy">
        Every plan runs on credits. A build only spends what it uses, and
        effort caps the most any single strike can spend.
      </p>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        <PlanCard
          name="Free"
          description="For turning your first few ideas into real apps."
          price="₹0"
          period="forever"
          creditsLabel={FREE_SIGNUP_CREDITS.toString()}
          litSegments={litSegmentsFor(FREE_SIGNUP_CREDITS)}
          features={FREE_FEATURES}
          bestFor="For a handful of real projects"
          cta="Start free"
          ctaHref={appPath()}
        />
        <PlanCard
          name="Pro"
          badge="PRO"
          description="For people who build often and want more room to run."
          price={`₹${PRO_PRICE_INR}`}
          period="/ month"
          creditsLabel={PRO_MONTHLY_CREDITS.toLocaleString()}
          litSegments={litSegmentsFor(PRO_MONTHLY_CREDITS)}
          features={PRO_FEATURES}
          bestFor="For builders who ship every week"
          cta="Upgrade to Pro"
          ctaHref={APP_BILLING}
          highlight
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="mono text-silver-600">
          Top-ups from {CREDIT_PACKS[0]!.credits} credits · ₹{CREDIT_PACKS[0]!.inr}
        </p>
        <Button asChild variant="secondary">
          <Link to="/pricing">See full pricing →</Link>
        </Button>
      </div>
    </section>
  );
}

export default PricingSection;
