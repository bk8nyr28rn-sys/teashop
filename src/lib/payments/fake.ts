import { PaymentError, type CheckoutInput, type PaymentProvider } from "./types";

/**
 * In-memory provider for local development and tests. Never used in
 * production (see getPaymentProvider). Its "checkout" is a dev page that
 * simulates the card authorisation.
 */
export type FakeLedgerEntry = { op: "checkout" | "capture" | "cancel" | "refund"; ref: string; key?: string };

export function createFakeProvider(opts: { failCapture?: boolean } = {}) {
  const ledger: FakeLedgerEntry[] = [];
  const captured = new Set<string>();

  const provider: PaymentProvider & { ledger: FakeLedgerEntry[]; paymentRefFor(questionId: string): string } = {
    name: "fake",
    ledger,
    paymentRefFor: (questionId) => `fake_pi_${questionId}`,

    async createPayoutAccount({ userId }) {
      return { accountId: `acct_fake_${userId}` };
    },
    async onboardingLink({ returnUrl }) {
      return { url: returnUrl }; // instantly "onboarded"
    },
    async payoutAccountReady() {
      return true;
    },

    async createCheckout(input: CheckoutInput) {
      const checkoutRef = `fake_cs_${input.questionId}`;
      ledger.push({ op: "checkout", ref: checkoutRef });
      return { checkoutRef, url: `/${input.locale}/dev/checkout/${input.questionId}` };
    },
    async capture(paymentRef, key) {
      if (opts.failCapture) throw new PaymentError("Card declined (fake)", "declined");
      // Same idempotency semantics as Stripe: a repeated key is a no-op.
      if (!captured.has(key)) ledger.push({ op: "capture", ref: paymentRef, key });
      captured.add(key);
    },
    async cancel(paymentRef) {
      ledger.push({ op: "cancel", ref: paymentRef });
    },
    async refund(paymentRef, key) {
      ledger.push({ op: "refund", ref: paymentRef, key });
    },
  };
  return provider;
}
