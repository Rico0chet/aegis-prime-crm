import { useState } from "react";
import { initializePaddle, getPaddleEnvironment } from "@/lib/paddle";
import { createPortalSession, resolveCheckoutOffer } from "@/utils/payments.functions";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    userId: string;
    customerEmail?: string;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      const environment = getPaddleEnvironment();
      const offer = await resolveCheckoutOffer({ data: { environment } });
      if (offer.blocked || !offer.paddlePriceId) {
        throw new Error(offer.reason ?? "Checkout is not available for this account.");
      }

      await initializePaddle();
      window.Paddle.Checkout.open({
        items: [{ priceId: offer.paddlePriceId, quantity: 1 }],
        ...(offer.discountId ? { discountId: offer.discountId } : {}),
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId },
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl ?? `${window.location.origin}/billing?checkout=success`,
          allowLogout: false,
          showAddDiscounts: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const openPortal = async () => {
    setLoading(true);
    try {
      const { url } = await createPortalSession({ data: { environment: getPaddleEnvironment() } });
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, openPortal, loading };
}
