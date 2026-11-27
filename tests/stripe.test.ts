import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import Stripe from "stripe";
import { createStripeProvider } from "@/lib/payments/stripe";
import { productionEnvErrors } from "@/lib/env";

/**
 * Exercises the real Stripe SDK against a local mock server: verifies the
 * exact parameters we send (manual capture, fee, destination, idempotency)
 * and webhook signature handling, without network access or keys.
 */
type Captured = { method: string; path: string; body: URLSearchParams; idempotencyKey?: string };

const WEBHOOK_SECRET = "whsec_test_secret";

describe("Stripe provider", () => {
  let server: Server;
  let calls: Captured[] = [];
  let provider: ReturnType<typeof createStripeProvider>;

  const responses: Record<string, unknown> = {
    "POST /v1/accounts": { id: "acct_123", object: "account" },
    "POST /v1/account_links": { object: "account_link", url: "https://connect.stripe.com/setup/x" },
    "GET /v1/accounts/acct_123": {
      id: "acct_123",
      object: "account",
      payouts_enabled: true,
      capabilities: { transfers: "active" },
    },
    "POST /v1/checkout/sessions": {
      id: "cs_test_1",
      object: "checkout.session",
      url: "https://checkout.stripe.com/c/x",
    },
    "POST /v1/payment_intents/pi_1/capture": { id: "pi_1", object: "payment_intent", status: "succeeded" },
    "POST /v1/refunds": { id: "re_1", object: "refund" },
  };

  beforeAll(async () => {
    server = createServer(async (req: IncomingMessage, res) => {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const path = (req.url ?? "").split("?")[0];
      calls.push({
        method: req.method ?? "",
        path,
        body: new URLSearchParams(raw),
        idempotencyKey: req.headers["idempotency-key"] as string | undefined,
      });
      const body = responses[`${req.method} ${path}`];
      res.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body ?? { error: { type: "invalid_request_error", message: "not mocked" } }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    provider = createStripeProvider({
      secretKey: "sk_test_123",
      webhookSecret: WEBHOOK_SECRET,
      clientConfig: { host: "127.0.0.1", port, protocol: "http", maxNetworkRetries: 0 },
    });
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));
  beforeEach(() => {
    calls = [];
  });

  it("creates a manual-capture destination charge with the platform fee", async () => {
    const res = await provider.createCheckout({
      questionId: "q_1",
      amountCents: 2000,
      feeCents: 400,
      currency: "usd",
      payoutAccountId: "acct_123",
      locale: "zh",
      successUrl: "https://example.org/zh/questions/q_1?checkout=done",
      cancelUrl: "https://example.org/zh/questions/q_1?checkout=cancelled",
    });
    expect(res).toEqual({ checkoutRef: "cs_test_1", url: "https://checkout.stripe.com/c/x" });
    const [call] = calls;
    expect(call.path).toBe("/v1/checkout/sessions");
    expect(call.idempotencyKey).toBe("checkout-q_1");
    const b = call.body;
    expect(b.get("mode")).toBe("payment");
    expect(b.get("locale")).toBe("zh");
    expect(b.get("payment_intent_data[capture_method]")).toBe("manual");
    expect(b.get("payment_intent_data[application_fee_amount]")).toBe("400");
    expect(b.get("payment_intent_data[transfer_data][destination]")).toBe("acct_123");
    expect(b.get("payment_intent_data[metadata][questionId]")).toBe("q_1");
    expect(b.get("line_items[0][price_data][unit_amount]")).toBe("2000");
    expect(b.get("line_items[0][price_data][product_data][name]")).toBe("Q&A session"); // neutral on receipts
  });

  it("captures, refunds and onboards with the right parameters", async () => {
    await provider.capture("pi_1", "capture-q_1");
    await provider.refund("pi_1", "refund-q_1");
    expect(calls[0]).toMatchObject({ path: "/v1/payment_intents/pi_1/capture", idempotencyKey: "capture-q_1" });
    expect(calls[1].path).toBe("/v1/refunds");
    expect(calls[1].body.get("reverse_transfer")).toBe("true");
    expect(calls[1].body.get("refund_application_fee")).toBe("true");

    calls = [];
    expect(await provider.createPayoutAccount({ userId: "u_1" })).toEqual({ accountId: "acct_123" });
    expect(calls[0].body.get("type")).toBe("express");
    expect(calls[0].body.get("capabilities[transfers][requested]")).toBe("true");
    expect(calls[0].idempotencyKey).toBe("payout-account-u_1");
    expect(
      await provider.onboardingLink({
        accountId: "acct_123",
        returnUrl: "https://e.org/r",
        refreshUrl: "https://e.org/f",
      }),
    ).toEqual({ url: "https://connect.stripe.com/setup/x" });
    expect(await provider.payoutAccountReady("acct_123")).toBe(true);
  });

  describe("webhooks", () => {
    const signer = new Stripe("sk_test_123");
    const sign = (payload: string, secret = WEBHOOK_SECRET) =>
      signer.webhooks.generateTestHeaderString({ payload, secret });
    const event = (type: string, object: Record<string, unknown>) =>
      JSON.stringify({ id: "evt_1", object: "event", type, data: { object }, api_version: "2026-11-18.endive" });

    it("maps an authorisation to the question", () => {
      const payload = event("payment_intent.amount_capturable_updated", {
        id: "pi_9",
        object: "payment_intent",
        status: "requires_capture",
        amount_capturable: 2000,
        currency: "usd",
        metadata: { questionId: "q_9" },
      });
      expect(provider.parseWebhook(payload, sign(payload))).toEqual({
        type: "authorized",
        questionId: "q_9",
        paymentRef: "pi_9",
        amountCents: 2000,
        currency: "usd",
      });
    });

    it("rejects forged or tampered events", () => {
      const payload = event("payment_intent.amount_capturable_updated", {
        id: "pi_9",
        object: "payment_intent",
        status: "requires_capture",
        amount_capturable: 2000,
        currency: "usd",
        metadata: { questionId: "q_9" },
      });
      expect(() => provider.parseWebhook(payload, sign(payload, "whsec_wrong"))).toThrow();
      expect(() => provider.parseWebhook(payload.replace("2000", "1"), sign(payload))).toThrow();
    });

    it("accepts any of several endpoint secrets (platform + connected accounts)", () => {
      const multi = createStripeProvider({ secretKey: "sk_test_1", webhookSecret: "whsec_platform, whsec_connect" });
      const payload = event("account.updated", {
        id: "acct_2",
        object: "account",
        payouts_enabled: true,
        capabilities: { transfers: "active" },
      });
      expect(multi.parseWebhook(payload, sign(payload, "whsec_connect"))).toMatchObject({ ready: true });
      expect(multi.parseWebhook(payload, sign(payload, "whsec_platform"))).toMatchObject({ ready: true });
      expect(() => multi.parseWebhook(payload, sign(payload, "whsec_other"))).toThrow();
    });

    it("maps payout and chargeback events, ignores the rest", () => {
      const acct = event("account.updated", {
        id: "acct_5",
        object: "account",
        payouts_enabled: false,
        capabilities: { transfers: "inactive" },
      });
      expect(provider.parseWebhook(acct, sign(acct))).toEqual({
        type: "payout_account_updated",
        accountId: "acct_5",
        ready: false,
      });
      const dispute = event("charge.dispute.created", { id: "dp_1", object: "dispute", payment_intent: "pi_7" });
      expect(provider.parseWebhook(dispute, sign(dispute))).toEqual({ type: "chargeback", paymentRef: "pi_7" });
      const other = event("customer.created", { id: "cus_1", object: "customer" });
      expect(provider.parseWebhook(other, sign(other))).toBeNull();
    });
  });

  it("requires the full Stripe configuration in production", () => {
    const base = {
      DATABASE_URL: "postgres://x",
      BETTER_AUTH_SECRET: "x".repeat(32),
      BETTER_AUTH_URL: "https://e.org",
      RESEND_API_KEY: "re_1",
      EMAIL_FROM: "A <a@e.org>",
    };
    expect(productionEnvErrors(base)).toEqual([]);
    const errs = productionEnvErrors({ ...base, STRIPE_SECRET_KEY: "sk_test_1" }).map((e) => e.split(":")[0]);
    expect(errs).toEqual(["STRIPE_WEBHOOK_SECRET", "CRON_SECRET"]);
    expect(
      productionEnvErrors({
        ...base,
        STRIPE_SECRET_KEY: "sk_live_1",
        STRIPE_WEBHOOK_SECRET: "whsec_1",
        CRON_SECRET: "c".repeat(16),
      }),
    ).toEqual([]);
  });
});
