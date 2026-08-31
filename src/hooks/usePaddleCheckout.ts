import { useState } from "react";
import { initializePaddle, getPaddleEnvironment } from "@/lib/paddle";
import { resolveCheckoutOffer } from "@/utils/payments.functions";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    userId: string;
    customerEmail?: string;
    successUrl?: string;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const environment = getPaddleEnvironment();
      const offer = await resolveCheckoutOffer({ data: { environment } });

      window.Paddle.Checkout.open({
        items: [{ priceId: offer.paddlePriceId, quantity: 1 }],
        ...(offer.discountId ? { discountId: offer.discountId } : {}),
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: { userId: options.userId },
        settings: {
          displayMode: "overlay",
          successUrl: options.successUrl ?? `${window.location.origin}/billing?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
