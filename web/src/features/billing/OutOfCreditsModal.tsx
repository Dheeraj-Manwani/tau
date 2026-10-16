import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useBillingStore } from "./useBillingStore";
import { useBalance, useCreditPacks, useRedeemCode } from "./api";
import { PACK_TAGS, formatPrice, useBuyCreditPack } from "./creditPacks";
import { PackCard } from "./PackCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { RadioGroup } from "@/src/components/ui/checkbox";
import { Input, InputGroup } from "@/src/components/ui/input";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ApiError } from "@/src/lib/api-client";
import { APP_BILLING } from "@/src/lib/routes";

/**
 * Shown when a run is refused for credits. The three packs are bought right
 * here (one primary, labelled from the pick); a code and, on the free plan,
 * the Pro plan are the other ways forward.
 */
export function OutOfCreditsModal() {
  const open = useBillingStore((s) => s.outOfCreditsOpen);
  const close = useBillingStore((s) => s.close);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const redeemCode = useRedeemCode();
  const { data: balance } = useBalance();
  const { data: packs, isLoading } = useCreditPacks();
  const { buy, pendingPack } = useBuyCreditPack(close);
  const isFreePlan = balance?.plan === "FREE";

  const effectiveId =
    selectedId ??
    (packs?.length ? packs[Math.floor(packs.length / 2)]!.id : null);
  const selected = packs?.find((p) => p.id === effectiveId) ?? null;

  const handleRedeem = () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    redeemCode.mutate(trimmed, {
      onSuccess: () => {
        close();
        setCode("");
      },
      onError: (err) => {
        toast.error(err instanceof ApiError ? err.message : "Invalid promo code");
      },
    });
  };

  const handleUpgrade = () => {
    close();
    void navigate(`${APP_BILLING}#pro-plan`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Out of credits</DialogTitle>
          <DialogDescription>
            Top up to keep building. Packs never expire and work on any plan.
          </DialogDescription>
        </DialogHeader>

        <Alert tone="warning">
          You&rsquo;ve used your credit allowance, so tau didn&rsquo;t start
          this run. Your project is as you left it.
        </Alert>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-2.5" aria-label="Loading credit packs">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[92px] rounded-lg" />
            ))}
          </div>
        ) : packs?.length ? (
          <RadioGroup
            value={effectiveId ?? undefined}
            onValueChange={setSelectedId}
            aria-label="Credit pack"
            className="grid grid-cols-3 gap-2.5"
          >
            {packs.map((pack, i) => (
              <PackCard
                key={pack.id}
                pack={pack}
                tag={PACK_TAGS[i]}
                selected={pack.id === effectiveId}
                compact
              />
            ))}
          </RadioGroup>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="out-of-credits-code" className="text-[13px] font-medium">
            Have a code?
          </label>
          <InputGroup>
            <Input
              id="out-of-credits-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="PROMO-CODE"
              className="font-mono tracking-[0.04em]"
              onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
            />
            <Button
              variant="secondary"
              onClick={handleRedeem}
              disabled={!code.trim()}
              loading={redeemCode.isPending}
            >
              Apply
            </Button>
          </InputGroup>
          {isFreePlan && (
            <p className="text-[12.5px] text-silver-500">
              Or{" "}
              <Button variant="link" className="text-[12.5px]" onClick={handleUpgrade}>
                upgrade to Pro
              </Button>{" "}
              for 5,000 credits every month.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={close}>
            Not now
          </Button>
          {selected && (
            <Button
              disabled={pendingPack !== null && pendingPack !== selected.id}
              loading={pendingPack === selected.id}
              onClick={() => buy(selected.id)}
            >
              {pendingPack === selected.id
                ? "Opening…"
                : `Buy ${selected.credits.toLocaleString()} credits · ${formatPrice(selected.price)}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
