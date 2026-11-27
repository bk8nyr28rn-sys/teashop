import Stripe from "stripe";
import { PaymentError, type CheckoutInput, type PaymentEvent, type PaymentProvider } from "./types";

/**
 * Stripe implementation: Connect Express accounts for responders and
 * destination charges with manual capture.
 *
 * Product names are deliberately neutral ("Q&A session"): they appear on the
 * Checkout page and email receipts. Set a neutral statement descriptor in the
 * Stripe dashboard too — card statements are often seen by others.
 */
export function createStripeProvider(opts: {
  secretKey: string;
  webhookSecret: string;
  /** Test hook: point the SDK at a mock server. */
  clientConfig?: Stripe.StripeConfig;
}): PaymentProvider & { parseWebhook(rawBody: string, signature: string): PaymentEvent | null } {
  const stripe = new Stripe(opts.secretKey, { maxNetworkRetries: 2, ...opts.clientConfig });

  const stripeLocale = (l: string): Stripe.Checkout.SessionCreateParams.Locale => (l === "zh" ? "zh" : "en");

  return {
    name: "stripe",

    async createPayoutAccount({ userId }) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          capabilities: { transfers: { requested: true } },
          metadata: { userId },
        },
        { idempotencyKey: `payout-account-${userId}` },
      );
      return { accountId: account.id };
    },

    async onboardingLink({ accountId, returnUrl, refreshUrl }) {
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        return_url: returnUrl,
        refresh_url: refreshUrl,
      });
      return { url: link.url };
    },

    async payoutAccountReady(accountId) {
      const account = await stripe.accounts.retrieve(accountId);
      return account.capabilities?.transfers === "active" && account.payouts_enabled === true;
    },

    async createCheckout(input: CheckoutInput) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          // Payment methods come from the dashboard configuration; with manual
          // capture Stripe only offers methods that support it (cards, wallets).
          locale: stripeLocale(input.locale),
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency,
                unit_amount: input.amountCents,
                product_data: { name: "Q&A session" },
              },
            },
          ],
          payment_intent_data: {
            capture_method: "manual",
            application_fee_amount: input.feeCents,
            transfer_data: { destination: input.payoutAccountId },
            metadata: { questionId: input.questionId },
          },
          metadata: { questionId: input.questionId },
          client_reference_id: input.questionId,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
        { idempotencyKey: `checkout-${input.questionId}` },
      );
      if (!session.url) throw new PaymentError("Checkout session has no URL", "provider_error");
      return { checkoutRef: session.id, url: session.url };
    },

    async capture(paymentRef, idempotencyKey) {
      try {
        await stripe.paymentIntents.capture(paymentRef, {}, { idempotencyKey });
      } catch (e) {
        throw toPaymentError(e);
      }
    },

    async cancel(paymentRef) {
      try {
        await stripe.paymentIntents.cancel(paymentRef);
      } catch (e) {
        // Already cancelled / expired holds are fine: nothing will be charged.
        if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "payment_intent_unexpected_state")
          return;
        throw toPaymentError(e);
      }
    },

    async refund(paymentRef, idempotencyKey) {
      await stripe.refunds.create(
        { payment_intent: paymentRef, reverse_transfer: true, refund_application_fee: true },
        { idempotencyKey },
      );
    },

    parseWebhook(rawBody, signature) {
      // Throws on a bad signature — callers must reject the request. Several
      // comma-separated secrets are accepted: the platform endpoint and the
      // connected-accounts endpoint each have their own.
      const secrets = opts.webhookSecret
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      let event: Stripe.Event | undefined;
      let lastError: unknown = new Error("No webhook secret configured");
      for (const secret of secrets) {
        try {
          event = stripe.webhooks.constructEvent(rawBody, signature, secret);
          break;
        } catch (e) {
          lastError = e;
        }
      }
      if (!event) throw lastError;
      switch (event.type) {
        case "payment_intent.amount_capturable_updated": {
          const pi = event.data.object;
          const questionId = pi.metadata?.questionId;
          if (!questionId || pi.status !== "requires_capture") return null;
          return {
            type: "authorized",
            questionId,
            paymentRef: pi.id,
            amountCents: pi.amount_capturable,
            currency: pi.currency,
          };
        }
        case "checkout.session.expired": {
          const questionId = event.data.object.metadata?.questionId;
          return questionId ? { type: "checkout_expired", questionId } : null;
        }
        case "account.updated": {
          const a = event.data.object;
          return {
            type: "payout_account_updated",
            accountId: a.id,
            ready: a.capabilities?.transfers === "active" && a.payouts_enabled === true,
          };
        }
        case "charge.dispute.created": {
          const pi = event.data.object.payment_intent;
          const paymentRef = typeof pi === "string" ? pi : pi?.id;
          return paymentRef ? { type: "chargeback", paymentRef } : null;
        }
        default:
          return null;
      }
    },
  };
}

function toPaymentError(e: unknown): PaymentError {
  if (e instanceof Stripe.errors.StripeCardError) return new PaymentError(e.message, "declined");
  if (e instanceof Stripe.errors.StripeInvalidRequestError && e.code === "payment_intent_unexpected_state") {
    return new PaymentError(e.message, "authorization_expired");
  }
  return new PaymentError(e instanceof Error ? e.message : String(e), "provider_error");
}
