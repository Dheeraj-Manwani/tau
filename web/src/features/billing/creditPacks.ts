import { useState } from "react";
import toast from "react-hot-toast";

import { celebrateSuccess } from "@/src/lib/confetti";
import { env } from "@/src/lib/env";
import { ApiError } from "@/src/lib/api-client";
import { useMe } from "@/src/features/auth/queries";
import {
  useCreateCreditOrder,
  useVerifyCreditPayment,
} from "@/src/features/billing/api";

/** Names for the packs, cheapest first (boards/Billing.dc.html). */
export const PACK_TAGS = ["Quick fix", "Most picked", "Big ideas"];

/** Format a minor-unit price (e.g. INR paise) for display. */
export function formatPrice(price: { amount: number; currency: string }): string {
  const major = price.amount / 100;
  if (price.currency === "INR") return `₹${major.toFixed(0)}`;
  return `${major.toFixed(2)} ${price.currency}`;
}

/** Checkout stays open after a failed attempt so the user can retry; just say why. */
export function toastPaymentFailed(resp: RazorpayPaymentFailedResponse) {
  toast.error(resp.error.description || "Payment failed. Please try again.");
}

/**
 * Buys a one-time credit pack through Razorpay: create the order, open the
 * checkout, verify the payment. Shared by Billing's Top up and the Out of
 * credits modal. `pendingPack` is the pack whose checkout is open.
 */
export function useBuyCreditPack(onPaid?: () => void) {
  const { data: user } = useMe();
  const createOrder = useCreateCreditOrder();
  const verifyPayment = useVerifyCreditPayment();
  const [pendingPack, setPendingPack] = useState<string | null>(null);

  const buy = (packId: string) => {
    setPendingPack(packId);
    createOrder.mutate(packId, {
      onSuccess: (order) => {
        if (!window.Razorpay) {
          toast.error(
            "Payment library not loaded. Please refresh and try again.",
          );
          setPendingPack(null);
          return;
        }
        const rzp = new window.Razorpay({
          key: order.keyId ?? env.RAZORPAY_KEY_ID,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: "Tau",
          description: `${order.credits} credits`,
          prefill: { email: user?.email ?? "" },
          theme: { color: "#60a5fa" },
          handler: (resp) => {
            verifyPayment.mutate(
              {
                orderId: resp.razorpay_order_id ?? order.orderId,
                paymentId: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              },
              {
                // The webhook backstop will still land the credits: don't alarm.
                onError: () =>
                  celebrateSuccess("Payment received: credits will appear shortly."),
                onSettled: () => {
                  setPendingPack(null);
                  onPaid?.();
                },
              },
            );
          },
          modal: { ondismiss: () => setPendingPack(null) },
        });
        rzp.on("payment.failed", toastPaymentFailed);
        rzp.open();
      },
      onError: (err) => {
        toast.error(
          err instanceof ApiError ? err.message : "Could not start checkout",
        );
        setPendingPack(null);
      },
    });
  };

  return { buy, pendingPack };
}
