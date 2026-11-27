/**
 * Payment provider boundary. The Q&A logic only talks to this interface, so
 * it can run against Stripe in production and a fake provider in dev/tests.
 *
 * Money model ("authorise now, capture on answer"):
 *   checkout  → card authorised only (manual capture), nothing charged
 *   answered  → capture: Stripe charges the card, pays the responder's
 *               connected account and keeps the platform fee
 *   no answer → cancel: the hold is released, the asker is never charged
 *   dispute   → refund (reversing the transfer and the platform fee)
 */
export interface PaymentProvider {
  readonly name: "stripe" | "fake";

  /** Connected account for a responder's payouts. */
  createPayoutAccount(input: { userId: string }): Promise<{ accountId: string }>;
  onboardingLink(input: { accountId: string; returnUrl: string; refreshUrl: string }): Promise<{ url: string }>;
  payoutAccountReady(accountId: string): Promise<boolean>;

  createCheckout(input: CheckoutInput): Promise<{ checkoutRef: string; url: string }>;
  capture(paymentRef: string, idempotencyKey: string): Promise<void>;
  /** Release an uncaptured authorisation. Must be safe to call twice. */
  cancel(paymentRef: string): Promise<void>;
  /** Refund `amountCents` (or everything). Responder share and platform fee are reversed proportionally. */
  refund(paymentRef: string, idempotencyKey: string, amountCents?: number): Promise<void>;
}

export type CheckoutInput = {
  questionId: string;
  amountCents: number;
  feeCents: number;
  currency: string;
  payoutAccountId: string;
  locale: string;
  successUrl: string;
  cancelUrl: string;
};

/** Provider events the app reacts to (normalised from webhooks). */
export type PaymentEvent =
  | { type: "authorized"; questionId: string; paymentRef: string; amountCents: number; currency: string }
  | { type: "checkout_expired"; questionId: string }
  | { type: "payout_account_updated"; accountId: string; ready: boolean }
  | { type: "chargeback"; paymentRef: string };

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly code: "declined" | "authorization_expired" | "provider_error",
  ) {
    super(message);
  }
}
