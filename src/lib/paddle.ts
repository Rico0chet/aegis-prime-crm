import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;

/** Called when the payment provider itself refuses to open the checkout. */
let checkoutErrorHandler: ((message: string) => void) | null = null;

export function onCheckoutError(handler: (message: string) => void) {
  checkoutErrorHandler = handler;
}

const LIVE_NOT_READY_MESSAGE =
  "Live payments aren't switched on for this account yet. Finish account verification with the payment provider, then subscriptions can be purchased here.";

export async function initializePaddle() {
  if (paddleInitialized) return;

  if (!clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      const paddleJsEnvironment = getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnvironment);
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: (event: { name?: string }) => {
          if (event?.name === "checkout.error") {
            try {
              window.Paddle.Checkout.close();
            } catch {
              /* overlay may already be gone */
            }
            checkoutErrorHandler?.(
              getPaddleEnvironment() === "live"
                ? LIVE_NOT_READY_MESSAGE
                : "The checkout could not be opened. Please try again.",
            );
          }
        },
      });
      paddleInitialized = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getPaddlePriceId(): Promise<string> {
  return resolvePaddlePrice({ data: { environment: getPaddleEnvironment() } });
}

