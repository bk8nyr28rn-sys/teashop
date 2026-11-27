import { getDb } from "@/db";
import { getStripeProvider } from "@/lib/payments";
import { flagChargeback, markAuthorized, markCheckoutExpired, setPayoutsReady } from "@/lib/qa";

/**
 * Stripe webhook. Subscribe to: payment_intent.amount_capturable_updated,
 * checkout.session.expired, account.updated, charge.dispute.created.
 * Every handler is idempotent — Stripe retries deliveries.
 */
export async function POST(request: Request) {
  const stripe = getStripeProvider();
  if (!stripe) return new Response("Payments are not configured", { status: 404 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.parseWebhook(rawBody, signature);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  if (!event) return Response.json({ received: true });

  const db = getDb();
  switch (event.type) {
    case "authorized": {
      const result = await markAuthorized(db, event);
      if (result === "mismatch") {
        // Never keep a hold we didn't price. Release it and flag in logs.
        console.error("[stripe] authorised amount mismatch; releasing hold", event.questionId);
        await stripe.cancel(event.paymentRef);
      }
      break;
    }
    case "checkout_expired":
      await markCheckoutExpired(db, event.questionId);
      break;
    case "payout_account_updated":
      await setPayoutsReady(db, event.accountId, event.ready);
      break;
    case "chargeback":
      await flagChargeback(db, event.paymentRef);
      break;
  }
  return Response.json({ received: true });
}
