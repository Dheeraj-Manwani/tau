import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { celebrateSuccess } from "@/src/lib/confetti";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ReceiptTextIcon,
  ZapIcon,
} from "lucide-react";

import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { env } from "@/src/lib/env";
import { cn } from "@/src/lib/utils";
import { ApiError } from "@/src/lib/api-client";
import { useMe } from "@/src/features/auth/queries";
import {
  useBalance,
  useCancelSubscription,
  useCreditPacks,
  useHistory,
  useRedeemCode,
  useSubscribePro,
  useSubscription,
  type LedgerEntry,
} from "@/src/features/billing/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { Badge, StatusDot } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { RadioGroup } from "@/src/components/ui/checkbox";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input, InputGroup } from "@/src/components/ui/input";
import { CreditMeter } from "@/src/components/ui/progress";
import { Segmented, SegmentedItem } from "@/src/components/ui/segmented";
import { Skeleton } from "@/src/components/ui/skeleton";
import { PageContainer } from "@/src/components/PageContainer";
import { UpgradeProButton } from "@/src/features/billing/UpgradeProButton";
import { ApiKeyCard } from "@/src/features/account/ApiKeyCard";
import { SpendSplitCard } from "@/src/features/billing/SpendSplitCard";
import { PackCard } from "@/src/features/billing/PackCard";
import {
  PACK_TAGS,
  formatPrice,
  toastPaymentFailed,
  useBuyCreditPack,
} from "@/src/features/billing/creditPacks";
import { LANDING_TERMS } from "@/src/lib/routes";
import { PRO_FEATURES, PRO_PRICE_INR } from "@/src/lib/pricing";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(1);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Day header label for grouping: "Today" / "Yesterday" / "Jul 6, 2026". */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return fmtDate(iso);
}

const LEDGER_LABELS: Record<string, string> = {
  SIGNUP_GRANT: "Signup bonus",
  DAILY_FREE_GRANT: "Daily free credits",
  PLAN_GRANT: "Monthly PRO credits",
  PROMO_REDEEM: "Promo code",
  PURCHASE: "Purchase",
  DEBIT: "Tau build",
  // Runtime inference from a deployed app, as opposed to DEBIT's "tau built
  // something for you". Different enough that one label for both would be
  // actively misleading on a bill.
  GATEWAY_DEBIT: "App AI usage",
  // Not a model run: a flat price for putting an app online, or for its logo.
  PUBLISH_FEE: "Deploy fee",
  LOGO_FEE: "App logo",
  REFUND: "Refund",
  EXPIRE: "Expired credits",
  ADJUSTMENT: "Adjustment",
};

const ACTIVE_STATUSES = new Set([
  "CREATED",
  "AUTHENTICATED",
  "ACTIVE",
  "PENDING",
]);

// ── Razorpay checkout ────────────────────────────────────────────────────────

function openRazorpayCheckout(
  subscriptionId: string,
  userEmail: string,
  onSuccess: () => void,
) {
  if (!window.Razorpay) {
    toast.error("Payment library not loaded. Please refresh and try again.");
    return;
  }
  const rzp = new window.Razorpay({
    key: env.RAZORPAY_KEY_ID,
    subscription_id: subscriptionId,
    name: "Tau",
    description: "PRO Monthly Plan",
    prefill: { email: userEmail },
    theme: { color: "#60a5fa" },
    handler: () => {
      celebrateSuccess("Payment successful! Your PRO plan is being activated.");
      onSuccess();
    },
  });
  rzp.on("payment.failed", toastPaymentFailed);
  rzp.open();
}

// ── Sub-components ───────────────────────────────────────────────────────────

/** What a full meter means: Pro's monthly allowance, or the free one-off grant. */
const PRO_MONTHLY_CREDITS = 5000;
const FREE_GRANT_CREDITS = 300;

/** The stat tile (boards/Billing.dc.html): display number, the segmented
 *  orange meter and the free / plan / bonus breakdown in mono. The meter and
 *  the PRO chip are the only orange here. */
function BalanceCard() {
  const { data: balance, isLoading } = useBalance();
  if (isLoading)
    return (
      <Card className="flex flex-col gap-4 p-6" aria-label="Loading credit balance">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-2.5 w-full" />
      </Card>
    );
  if (!balance) return null;

  const { credits, plan, cycleEnd } = balance;
  const full = plan === "PRO" ? PRO_MONTHLY_CREDITS : FREE_GRANT_CREDITS;
  const breakdown = [
    { label: "FREE", sub: "used first", value: credits.free, dot: "bg-[#6b6b75]" },
    { label: "PLAN", sub: "resets monthly", value: credits.plan, dot: "bg-blue-500" },
    { label: "BONUS", sub: "never expires", value: credits.bonus, dot: "bg-orange-400" },
  ];

  return (
    <Card className="flex h-full flex-col gap-[18px] p-6" aria-label="Available credits">
      <div className="flex items-center justify-between">
        <span className="lab">Available credits</span>
        <Badge tone={plan === "PRO" ? "pro" : "neutral"}>
          {plan === "PRO" && <ZapIcon />}
          {plan} PLAN
        </Badge>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="display-heading text-[80px]">{fmt(credits.available)}</span>
        <span className="font-mono text-[13px] text-silver-500">CR</span>
      </div>
      <CreditMeter value={(credits.available / full) * 100} label="Credits available" />
      <div className="flex flex-wrap gap-x-5.5 gap-y-2.5 font-mono text-[11.5px] text-silver-500">
        {breakdown.map(({ label, sub, value, dot }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", dot)} aria-hidden="true" />
            <b className="font-medium text-silver-900">{fmt(value)}</b> {label} · {sub}
          </span>
        ))}
      </div>
      {plan === "PRO" && cycleEnd && (
        <p className="mt-auto text-[12.5px] text-silver-500">Plan resets {fmtDate(cycleEnd)}</p>
      )}
    </Card>
  );
}

function PlanSection() {
  const { data: user } = useMe();
  const { data: sub, isLoading, refetch: refetchSub } = useSubscription();
  const { data: balance, refetch: refetchBalance } = useBalance();
  const subscribePro = useSubscribePro();
  const cancelSub = useCancelSubscription();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const isActive = sub ? ACTIVE_STATUSES.has(sub.status) : false;
  // The account can be PRO without an active Subscription row (e.g. an
  // admin-granted comp plan) — gate the upgrade CTA on the actual plan, not
  // just on there being a live Razorpay subscription to cancel.
  const isPro = balance?.plan === "PRO";

  const handleUpgrade = () => {
    subscribePro.mutate(undefined, {
      onSuccess: (data) => {
        openRazorpayCheckout(data.subscriptionId, user?.email ?? "", () => {
          void refetchSub();
          void refetchBalance();
        });
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Could not start subscription",
        );
      },
    });
  };

  const handleCancel = () => {
    cancelSub.mutate(undefined, {
      onSuccess: () => {
        toast.success(
          "Subscription will cancel at the end of this billing cycle.",
        );
        setConfirmCancel(false);
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError
            ? err.message
            : "Could not cancel subscription",
        );
      },
    });
  };

  return (
    // The Pro card's slow sheen is this page's one looping effect.
    <Card className="conic-sheen relative flex h-full flex-col gap-4 overflow-hidden p-6" aria-label="Pro plan">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="pro">
          <ZapIcon />
          PRO
        </Badge>
        {sub && (
          <Badge
            tone={
              sub.status === "ACTIVE"
                ? "green"
                : sub.status === "CANCELLED" || sub.status === "EXPIRED"
                  ? "red"
                  : "neutral"
            }
            className="capitalize"
          >
            {sub.status.toLowerCase()}
          </Badge>
        )}
      </div>

      <div className="flex items-baseline gap-2.5">
        <span className="display-heading text-[56px]">₹{PRO_PRICE_INR.toLocaleString("en-IN")}</span>
        <span className="font-mono text-xs text-silver-500">/ month</span>
      </div>

      <ul className="flex flex-col gap-[11px] text-[13.5px]">
        {PRO_FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-2.5">
            <CheckIcon className="size-4 shrink-0 text-green-400" />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
        {isLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : !isPro ? (
          <>
            <UpgradeProButton onClick={handleUpgrade} loading={subscribePro.isPending}>
              {subscribePro.isPending ? "Preparing checkout…" : "Upgrade to Pro"}
            </UpgradeProButton>
            <span className="font-mono text-xs text-silver-500">Cancel anytime</span>
          </>
        ) : !isActive ? (
          // PRO without a live Subscription row — a manually granted comp
          // plan. Nothing to cancel, so no cancel-subscription affordance.
          <p className="flex items-center gap-2 text-[12.5px] text-silver-600">
            <StatusDot tone="live" size={6} />
            PRO plan active
          </p>
        ) : sub?.cancelAtCycleEnd ? (
          <p className="text-[12.5px] text-silver-600">
            Cancels {sub.currentEnd ? fmtDate(sub.currentEnd) : "at cycle end"}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-[12.5px] text-silver-600">
              <StatusDot tone="live" size={6} />
              PRO plan active
            </p>
            <Button variant="destructive" size="sm" className="ml-auto" onClick={() => setConfirmCancel(true)}>
              Cancel subscription
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Pro?</AlertDialogTitle>
            <AlertDialogDescription>
              Pro stays active until the end of this billing cycle
              {sub?.currentEnd ? ` (${fmtDate(sub.currentEnd)})` : ""}, then your account moves to the free plan.
              Bonus credits you bought are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelSub.isPending}>Keep Pro</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              disabled={cancelSub.isPending}
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
            >
              {cancelSub.isPending ? "Cancelling…" : "Cancel at cycle end"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function RedeemSection() {
  const [code, setCode] = useState("");
  const redeemCode = useRedeemCode();

  const handleSubmit = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    redeemCode.mutate(trimmed, {
      onSuccess: () => {
        setCode("");
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError ? err.message : "Invalid promo code",
        );
      },
    });
  };

  return (
    <Card className="flex flex-col gap-3.5 px-6 py-5.5" aria-label="Redeem a code">
      <h2 className="text-[15px] font-semibold">Redeem a code</h2>
      <InputGroup>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="PROMO-CODE"
          aria-label="Promo code"
          className="font-mono tracking-[0.04em]"
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        <Button onClick={handleSubmit} variant="secondary" disabled={!code.trim()} loading={redeemCode.isPending}>
          {redeemCode.isPending ? "Applying…" : "Apply"}
        </Button>
      </InputGroup>
      <p className="text-[12.5px] leading-normal text-silver-500">
        Codes from events and feedback rewards land as bonus credits.
      </p>
    </Card>
  );
}

function TopUpSection() {
  const { data: balance } = useBalance();
  const { data: packs, isLoading } = useCreditPacks();
  const { buy: handleBuy, pendingPack } = useBuyCreditPack();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default selection: the middle pack, until the user picks one themselves
  // (derived at render instead of synced via effect - packs load exactly once).
  const effectiveId =
    selectedId ??
    (packs?.length ? packs[Math.floor(packs.length / 2)]!.id : null);
  const selected = packs?.find((p) => p.id === effectiveId) ?? null;

  return (
    <Card aria-label="Top up">
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2 px-6 pt-5.5 pb-1">
        <div>
          <h2 className="text-[15px] font-semibold">Top up</h2>
          <p className="mt-0.5 text-[13px] text-silver-500">One-time packs. Credits never expire and work on any plan.</p>
        </div>
        <span className="font-mono text-[11.5px] tracking-[0.04em] text-silver-500">Paid securely · UPI, cards</span>
      </div>

      {isLoading ? (
        <div className="grid gap-3.5 px-6 pt-4.5 pb-5.5 sm:grid-cols-3" aria-label="Loading credit packs">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[104px] rounded-lg" />
          ))}
        </div>
      ) : packs?.length ? (
        <>
          <RadioGroup
            value={effectiveId ?? undefined}
            onValueChange={setSelectedId}
            aria-label="Credit pack"
            className="grid gap-3.5 px-6 pt-4.5 pb-5.5 [grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr))]"
          >
            {packs.map((pack, i) => (
              <PackCard key={pack.id} pack={pack} tag={PACK_TAGS[i]} selected={pack.id === effectiveId} />
            ))}
          </RadioGroup>

          {selected && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4">
              <p className="text-[13px] text-silver-600">
                New balance after purchase{" "}
                <span className="ml-1.5 font-mono text-silver-900">
                  {balance ? fmt(balance.credits.available + selected.credits) : "—"} CR
                </span>
              </p>
              <Button
                disabled={pendingPack !== null && pendingPack !== selected.id}
                loading={pendingPack === selected.id}
                onClick={() => handleBuy(selected.id)}
              >
                {pendingPack === selected.id
                  ? "Opening…"
                  : `Buy ${selected.credits.toLocaleString()} credits · ${formatPrice(selected.price)}`}
              </Button>
            </div>
          )}
        </>
      ) : null}
    </Card>
  );
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const isDebit = entry.credits < 0;
  const isGeneration = entry.type === "DEBIT";

  // Generations get a richer title: "Generation · <project>" (or just
  // "Generation" if the project was since deleted). Everything else uses its
  // label.
  const baseLabel = LEDGER_LABELS[entry.type] ?? entry.type;
  const title =
    isGeneration && entry.projectName
      ? `${baseLabel} · ${entry.projectName}`
      : baseLabel;

  // Secondary line: turn count for multi-turn generations, else the raw reason
  // when it adds something beyond the label.
  const detail =
    !isGeneration && entry.reason && entry.reason !== baseLabel.toLowerCase()
      ? entry.reason
      : null;

  return (
    <div className="flex items-center gap-3.5 border-b border-line py-[13px] last:border-b-0">
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-sm border",
          isDebit
            ? "border-line-strong bg-space-overlay text-silver-600"
            : "border-green-400/32 bg-green-400/11 text-green-400",
        )}
      >
        <ZapIcon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-silver-900">{title}</p>
        <p className="truncate font-mono text-[11.5px] text-silver-500">
          {fmtTime(entry.createdAt)}
          {detail ? ` · ${detail}` : ""}
          {` · bal ${fmt(entry.balanceAfter)}`}
        </p>
      </div>
      <span className={cn("shrink-0 font-mono text-[13.5px]", isDebit ? "text-silver-900" : "text-green-400")}>
        {isDebit ? "−" : "+"}
        {fmt(Math.abs(entry.credits))}
      </span>
    </div>
  );
}

const HISTORY_FILTERS = ["All", "Spent", "Added"] as const;
type HistoryFilter = (typeof HISTORY_FILTERS)[number];

function HistorySection() {
  const [cursor, setCursor] = useState<string | undefined>();
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("All");
  const { data, isFetching } = useHistory(cursor);
  const nextCursor = data?.nextCursor ?? null;

  useEffect(() => {
    if (!data?.entries.length) return;
    // Each cursor response is a new server page that must be appended locally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllEntries((prev) => {
      const ids = new Set(prev.map((e) => e.id));
      const fresh = data.entries.filter((e) => !ids.has(e.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [data]);

  const entries = useMemo(() => {
    if (filter === "All") return allEntries;
    return allEntries.filter((e) =>
      filter === "Spent" ? e.credits < 0 : e.credits > 0,
    );
  }, [allEntries, filter]);

  return (
    <Card aria-label="Credit history">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-1.5">
        <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
          <ReceiptTextIcon className="size-4 text-silver-600" />
          Credit history
        </h2>
        <Segmented size="sm" value={filter} onValueChange={(f) => setFilter(f as HistoryFilter)} aria-label="Filter">
          {HISTORY_FILTERS.map((f) => (
            <SegmentedItem key={f} value={f}>
              {f}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>

      {entries.length === 0 && !isFetching && (
        <div className="px-6 pb-6">
          <EmptyState description="No transactions yet." />
        </div>
      )}

      <div className="px-6 pb-2">
        {entries.map((e, i) => {
          const prev = entries[i - 1];
          const showHeader = !prev || dayLabel(prev.createdAt) !== dayLabel(e.createdAt);
          return (
            <div key={e.id}>
              {showHeader && <p className="eyebrow pt-4 pb-1">{dayLabel(e.createdAt)}</p>}
              <LedgerRow entry={e} />
            </div>
          );
        })}
      </div>

      {isFetching && (
        <div className="flex flex-col gap-2 px-6 pb-5" aria-label="Loading credit history">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      )}

      {nextCursor && !isFetching && (
        <div className="flex justify-center border-t border-line p-3">
          <Button variant="secondary" size="sm" onClick={() => setCursor(nextCursor)}>
            <ChevronDownIcon />
            Load older
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  useDocumentMeta({ title: "Billing", noIndex: true });

  const navigate = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash === "#buy-credits" || hash === "#pro-plan") {
      document.getElementById(hash.slice(1))?.scrollIntoView({ block: "start" });
    }
  }, [hash]);

  return (
    <PageContainer className="flex max-w-[880px] flex-col gap-5 pb-24">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="eyebrow flex cursor-pointer items-center gap-2 self-start transition-colors hover:text-blue-hi"
      >
        <ArrowLeftIcon className="size-3" />
        Back to building
      </button>

      <h1 className="display-l mt-1 mb-3 sm:text-[56px]">Credits &amp; billing</h1>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <BalanceCard />
        <div id="pro-plan" className="scroll-mt-4">
          <PlanSection />
        </div>
      </div>

      <div id="buy-credits" className="scroll-mt-4">
        <TopUpSection />
      </div>

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(380px,100%),1fr))]">
        <RedeemSection />
        <ApiKeyCard />
      </div>

      {/* Below the key card on purpose: the runtime half of this split is
          spend by apps using that key. */}
      <SpendSplitCard />

      <HistorySection />

      <div className="mt-3 flex flex-col gap-2 text-center text-xs text-silver-500">
        <p>Free tier gives 300 credits once. PRO gives 5,000/month.</p>
        <p>
          Payments processed by Razorpay. No prorated refunds for partial billing periods. See our{" "}
          <a href={LANDING_TERMS} className="text-silver-600 underline-offset-3 hover:text-silver-900 hover:underline">
            Cancellation &amp; Refund Policy
          </a>{" "}
          · Questions?{" "}
          <a
            href="mailto:iammadfortech@gmail.com"
            className="text-silver-600 underline-offset-3 hover:text-silver-900 hover:underline"
          >
            iammadfortech@gmail.com
          </a>
        </p>
      </div>
    </PageContainer>
  );
}
