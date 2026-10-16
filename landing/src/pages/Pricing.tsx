import { Link } from "react-router-dom";
import { ChevronDownIcon } from "lucide-react";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { APP_BILLING, appPath } from "@/src/lib/routes";
import {
  CREDIT_PACKS,
  FREE_SIGNUP_CREDITS,
  PRO_MONTHLY_CREDITS,
  PRO_PRICE_INR,
} from "@/src/features/marketing/data/effortTiers";
import {
  FREE_FEATURES,
  PACK_TAGS,
  PRO_FEATURES,
  PlanCard,
  litSegmentsFor,
} from "@/src/features/marketing/sections/Pricing";

/**
 * Public pricing.
 *
 * Re-skinned to the storm hero's bold type voice (Big Shoulders Display,
 * `.eyebrow`, `.tier-card`/`.effort-meter`) via the shared `PlanCard` in
 * `sections/Pricing.tsx`, which the home page's teaser section also renders -
 * one set of cards, one set of numbers, two places they show up.
 *
 * Only two real plans exist (Free, PRO): there is no middle paid tier and no
 * yearly billing in the product, so this does not add either just to mirror
 * a three-card reference layout. Figures come from
 * `features/marketing/data/effortTiers.ts`, which cites the constants in
 * `api/src/lib/pricing.ts` and `billing.service.ts`, so this page and the
 * landing page can never quietly disagree.
 *
 * One claim was removed in an earlier pass. The Free plan listed "Download
 * your code anytime" - not built, no ZIP export - replaced by what is
 * genuinely true: you push to a GitHub repo you own.
 *
 * Routed inside `MarketingShell` alongside `/` and `/changelog`, so it gets
 * the real storm nav/footer instead of a one-off logo link.
 */
const FAQ = [
  {
    q: "What is a credit?",
    a: "Credits pay for the work Tau does. Bigger requests and higher effort use more, and you can watch the total as Tau works.",
  },
  {
    q: "Do the free credits refill?",
    a: `No. You get ${FREE_SIGNUP_CREDITS} credits once, when you sign up. They do not refill each day, but you can buy a pack, use a promo code, or move to PRO whenever you need more.`,
  },
  {
    q: "What happens to unused PRO credits?",
    a: `PRO adds ${PRO_MONTHLY_CREDITS.toLocaleString()} credits on your billing date each month. Any unused monthly credits expire when the next month begins.`,
  },
  {
    q: "Do credit packs expire?",
    a: "No. Packs are one-time purchases, with or without a subscription, and their credits never expire.",
  },
];

export default function PricingPage() {
  useDocumentMeta({
    title: "Pricing",
    description:
      `Start free with ${FREE_SIGNUP_CREDITS} credits: no card. PRO is ₹${PRO_PRICE_INR} a month for ` +
      `${PRO_MONTHLY_CREDITS.toLocaleString()} credits, or top up with a credit pack any time.`,
    canonical: "/pricing",
  });

  return (
    <div className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <p className="eyebrow">// PRICING</p>
          <h1 className="display-heading display-l mt-3 text-silver-900 sm:text-[72px]">
            Pay per
            <br />
            <span className="text-blue-500">strike</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-silver-600">
            Every plan runs on credits. A build only spends what it uses, and
            effort caps the most any single strike can spend.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
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

        <section className="mt-8 rounded-lg border border-line bg-space-surface p-6">
          <h2 className="text-[15px] font-semibold text-silver-900">Top up anytime</h2>
          <p className="mt-1 mb-5 text-[13px] text-silver-600">
            One-time packs, with or without a subscription. Credits never
            expire.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.credits}
                className="flex flex-col gap-2 rounded-lg border border-line-strong bg-space-void p-4"
              >
                {PACK_TAGS[pack.credits] && (
                  <p className="lab">{PACK_TAGS[pack.credits]}</p>
                )}
                <p className="display-heading text-[32px] text-silver-900">
                  {pack.credits.toLocaleString()}
                </p>
                <p className="font-mono text-xs text-silver-500">
                  credits · ₹{pack.inr}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <p className="eyebrow">// FAQ</p>
          <h2 className="display-heading display-m mt-3 text-silver-900">How credits work</h2>
          <div className="mt-6 border-t border-line">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group border-b border-line">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-medium text-silver-900 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDownIcon className="size-4 shrink-0 text-silver-600 transition-transform duration-150 group-open:rotate-180" />
                </summary>
                <p className="max-w-2xl pb-5 text-[14px] leading-[1.7] text-silver-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 text-center text-[13px] text-silver-500">
          <p>
            All prices are in Indian Rupees (INR) inclusive of applicable taxes.
            Payments are processed securely by{" "}
            <span className="font-medium text-silver-900">Razorpay</span>.
          </p>
          <p className="mt-2">
            <Link to="/terms" className="hover:underline">
              Terms &amp; Cancellation Policy
            </Link>{" "}
            ·{" "}
            <Link to="/privacy" className="hover:underline">
              Privacy Policy
            </Link>{" "}
            · Questions?{" "}
            <a href="mailto:iammadfortech@gmail.com" className="hover:underline">
              iammadfortech@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
