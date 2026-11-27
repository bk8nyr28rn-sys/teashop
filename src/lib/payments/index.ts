import { createFakeProvider } from "./fake";
import { createStripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export type { PaymentProvider, PaymentEvent } from "./types";
export { PaymentError } from "./types";

type StripeProvider = ReturnType<typeof createStripeProvider>;
const g = globalThis as unknown as { __payments?: PaymentProvider | null };

/**
 * Stripe when configured; the fake provider in development; otherwise null
 * (paid Q&A is then shown as unavailable). Never fake in production.
 */
export function getPaymentProvider(): PaymentProvider | null {
  if (g.__payments !== undefined) return g.__payments;
  const key = process.env.STRIPE_SECRET_KEY;
  if (key) {
    g.__payments = createStripeProvider({ secretKey: key, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "" });
  } else if (process.env.NODE_ENV !== "production") {
    g.__payments = createFakeProvider();
  } else {
    g.__payments = null;
  }
  return g.__payments;
}

export function getStripeProvider(): StripeProvider | null {
  const p = getPaymentProvider();
  return p?.name === "stripe" ? (p as StripeProvider) : null;
}
