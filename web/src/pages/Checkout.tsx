import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeftIcon, Wallet } from "lucide-react";

import { env } from "@/src/lib/env";
import { Alert } from "@/src/components/ui/alert";
import { StatusDot } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { celebrateSuccess } from "@/src/lib/confetti";

/**
 * Razorpay checkout surface for the **mobile** app.
 *
 * Razorpay *orders* (credit packs) have no hosted payment page the way
 * *subscriptions* do: the only first-party way to pay one is Checkout JS,
 * which is browser-only. Rather than add a native Razorpay module and a second
 * checkout implementation, mobile opens this route in an in-app browser tab and
 * we reuse the Checkout JS that already ships on web. See doc/SYNC_MOBILE.md §1.
 *
 * Deliberately public and deliberately stateless:
 *  - No auth guard. The browser tab carries no mobile session, and everything
 *    it needs (order id, amount, key) is already in the query string. The order
 *    was minted server-side against the authenticated mobile user, so nothing
 *    here is trust-bearing.
 *  - It does **not** call POST /billing/credits/verify. That endpoint credits
 *    the *calling* user's account, and this tab is not the mobile user's
 *    session. The `order.paid` webhook is mobile's crediting path
 *    (billing.service.ts:349): it shares the `purchase:order:{id}` ledger key
 *    with verify, so credits land exactly once either way.
 */

/** Deep link back into the native app. Must match RETURN_URL in mobile/src/features/billing/topup.ts. */
const RETURN_URL = "tau://billing";

/** Checkout JS is a <script> tag in index.html; it may not have parsed yet. */
function waitForRazorpay(timeoutMs = 8_000): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = setInterval(() => {
      if (window.Razorpay) {
        clearInterval(tick);
        resolve(true);
      } else if (Date.now() > deadline) {
        clearInterval(tick);
        resolve(false);
      }
    }, 100);
  });
}

function returnToApp(status: "success" | "cancelled" | "failed") {
  window.location.href = `${RETURN_URL}?status=${status}`;
}

export default function CheckoutPage() {
  useDocumentMeta({ title: "Checkout", noIndex: true });

  const [params] = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const amount = Number(params.get("amount") ?? "0");
  const currency = params.get("currency") ?? "INR";
  const keyId = params.get("keyId") || env.RAZORPAY_KEY_ID;
  const credits = params.get("credits") ?? "";
  const email = params.get("email") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"success" | "cancelled" | null>(null);
  // StrictMode double-mounts in dev; opening Checkout twice stacks two modals.
  const opened = useRef(false);

  const open = useCallback(async () => {
    setError(null);
    if (!orderId || !amount) {
      setError("This checkout link is missing its order details.");
      return;
    }
    if (!keyId) {
      setError("Payments are not configured.");
      return;
    }
    if (!(await waitForRazorpay())) {
      setError("Payment library failed to load. Check your connection.");
      return;
    }

    const rzp = new window.Razorpay({
      key: keyId,
      order_id: orderId,
      amount,
      currency,
      name: "Tau",
      description: credits ? `${credits} credits` : "Credit top-up",
      prefill: email ? { email } : undefined,
      theme: { color: "#60a5fa" },
      handler: () => {
        celebrateSuccess("Payment received! Your credits will appear shortly.");
        setDone("success");
        returnToApp("success");
      },
      modal: {
        ondismiss: () => {
          setDone("cancelled");
          returnToApp("cancelled");
        },
      },
    });
    rzp.open();
  }, [orderId, amount, currency, keyId, credits, email]);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void open();
  }, [open]);

  return (
    // A focused purchase (tier C): one card, one action, nothing decorative.
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-lg border border-line bg-space-surface p-8 text-center">
      <span className="grid size-10 place-items-center rounded-md border border-line-strong bg-space-overlay text-silver-600">
        <Wallet className="size-4" />
      </span>
      <h1 className="display-s mt-4">
        {credits ? `${credits} credits` : "Credit top-up"}
      </h1>

      {error ? (
        <>
          <Alert tone="danger" className="mt-4 w-full text-left">
            {error}
          </Alert>
          <div className="mt-5 flex w-full flex-col gap-2">
            <Button onClick={() => void open()}>Try again</Button>
            <Button variant="ghost" onClick={() => returnToApp("failed")}>
              <ArrowLeftIcon />
              Back to the app
            </Button>
          </div>
        </>
      ) : done ? (
        <>
          <Alert tone={done === "success" ? "success" : "info"} className="mt-4 w-full text-left">
            {done === "success"
              ? "Payment received. Returning to the app: your credits will appear in a moment."
              : "Checkout cancelled."}
          </Alert>
          {/* The deep link normally fires on its own; this is the manual escape
              hatch for browsers that block a programmatic scheme navigation. */}
          <Button variant="secondary" asChild className="mt-5 w-full">
            <a href={`${RETURN_URL}?status=${done}`}>Back to the app</a>
          </Button>
        </>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm text-silver-500">
          <StatusDot tone="deploying" />
          Opening secure checkout…
        </p>
      )}
      </div>
    </div>
  );
}
