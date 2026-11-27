import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "@/db";
import { profile, question, user } from "@/db/schema";
import { deleteAccount, suspendUser } from "@/lib/accounts";
import { ensureProfile } from "@/lib/membership";
import { createFakeProvider } from "@/lib/payments/fake";
import {
  answerQuestion,
  askQuestion,
  cancelQuestion,
  expireOverdue,
  getQuestionView,
  listAvailableResponders,
  markAuthorized,
  openDispute,
  rateAnswer,
  resolveDispute,
  saveResponderProfile,
  startPayoutOnboarding,
  refreshPayoutStatus,
  type Actor,
} from "@/lib/qa";

const url = process.env.TEST_DATABASE_URL;
const ANSWER = "Thank you for trusting me with this. Here is what helped me in a similar situation...";
const BODY = "I want to tell my parents but I'm scared of how they'll react.";

describe.skipIf(!url)("paid Q&A (postgres)", () => {
  let db: Db;
  let close: () => Promise<void>;
  beforeAll(async () => {
    const conn = createDb(url!);
    db = conn.db;
    close = () => conn.client.end();
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  afterAll(async () => close?.());
  beforeEach(async () => {
    await db.execute(sql`truncate table "user", question restart identity cascade`);
  });

  let n = 0;
  async function actor(over: Partial<typeof profile.$inferInsert> = {}): Promise<Actor & { handle: string }> {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "", email: `${id}@t.local` });
    await ensureProfile(db, id);
    await db
      .update(profile)
      .set({ status: "approved", approvedAt: new Date(), handle: `qa${++n}`, trustLevel: 1, ...over })
      .where(eq(profile.userId, id));
    const [p] = await db.select().from(profile).where(eq(profile.userId, id));
    return { userId: id, profile: p, handle: p.handle! };
  }

  /** A responder who finished payout onboarding and is accepting questions at $20. */
  async function readyResponder(payments = createFakeProvider()) {
    const r = await actor({ role: "responder" });
    await startPayoutOnboarding(db, payments, r, { returnUrl: "x", refreshUrl: "y" });
    await refreshPayoutStatus(db, payments, r.userId);
    const saved = await saveResponderProfile(db, r, {
      headline: "Been there",
      bio: "Out for 10 years.",
      topics: ["coming-out", "bogus-topic"],
      languages: ["en"],
      priceCents: 2000,
      accepting: true,
    });
    expect(saved).toEqual({ ok: true });
    return r;
  }

  async function paidQuestion(payments: ReturnType<typeof createFakeProvider>, asker: Actor, responder: Actor) {
    const res = await askQuestion(db, payments, asker, {
      responderId: responder.userId,
      title: "Coming out to family",
      body: BODY,
      crisisAcknowledged: false,
      locale: "en",
      baseUrl: "https://example.org",
    });
    if (!res.ok) throw new Error(res.error);
    const opened = await markAuthorized(db, {
      questionId: res.questionId,
      paymentRef: payments.paymentRefFor(res.questionId),
      amountCents: 2000,
      currency: "usd",
    });
    expect(opened).toBe("opened");
    return res.questionId;
  }

  it("only lists responders who can actually be paid", async () => {
    const payments = createFakeProvider();
    const notReady = await actor({ role: "responder" });
    expect(
      await saveResponderProfile(db, notReady, {
        headline: "",
        bio: "",
        topics: [],
        languages: [],
        priceCents: 1500,
        accepting: true,
      }),
    ).toEqual({ ok: false, error: "payouts-not-ready" });
    const member = await actor();
    expect(
      await saveResponderProfile(db, member, {
        headline: "",
        bio: "",
        topics: [],
        languages: [],
        priceCents: 1500,
        accepting: false,
      }),
    ).toEqual({ ok: false, error: "forbidden" });

    const r = await readyResponder(payments);
    const list = await listAvailableResponders(db);
    expect(list.map((x) => x.userId)).toEqual([r.userId]);
    expect(list[0].topics).toEqual(["coming-out"]); // unknown topics dropped
  });

  it("runs ask → authorise → answer, capturing exactly once", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();

    const res = await askQuestion(db, payments, asker, {
      responderId: r.userId,
      title: "Coming out to family",
      body: BODY,
      crisisAcknowledged: false,
      locale: "zh",
      baseUrl: "https://example.org",
    });
    expect(res.ok && res.checkoutUrl).toBe(`/zh/dev/checkout/${(res as { questionId: string }).questionId}`);
    const id = (res as { questionId: string }).questionId;
    const [pending] = await db.select().from(question).where(eq(question.id, id));
    expect(pending).toMatchObject({ status: "awaiting_payment", priceCents: 2000, feeCents: 400, currency: "usd" });

    // The responder can't see or answer before the card is authorised.
    expect(await getQuestionView(db, r, id)).toBeNull();
    expect(await answerQuestion(db, payments, r, { questionId: id, answer: ANSWER })).toEqual({
      ok: false,
      error: "already-done",
    });

    expect(await markAuthorized(db, { questionId: id, paymentRef: "pi_x", amountCents: 999, currency: "usd" })).toBe(
      "mismatch",
    );
    expect(
      await markAuthorized(db, {
        questionId: id,
        paymentRef: payments.paymentRefFor(id),
        amountCents: 2000,
        currency: "USD",
      }),
    ).toBe("opened");
    expect(
      await markAuthorized(db, {
        questionId: id,
        paymentRef: payments.paymentRefFor(id),
        amountCents: 2000,
        currency: "usd",
      }),
    ).toBe("ignored"); // webhook retry

    const view = await getQuestionView(db, r, id);
    expect(view?.viewerRole).toBe("responder");
    expect(JSON.stringify(view)).not.toContain(asker.userId);
    expect(view?.responderHandle).toBeNull();

    const other = await readyResponder(payments);
    expect(await answerQuestion(db, payments, other, { questionId: id, answer: ANSWER })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(await answerQuestion(db, payments, r, { questionId: id, answer: "too short" })).toEqual({
      ok: false,
      error: "invalid-input",
    });

    const results = await Promise.all([
      answerQuestion(db, payments, r, { questionId: id, answer: ANSWER }),
      answerQuestion(db, payments, r, { questionId: id, answer: ANSWER }),
    ]);
    expect(results.filter((x) => x.ok)).toHaveLength(1);
    expect(payments.ledger.filter((e) => e.op === "capture")).toHaveLength(1);

    const asAsker = await getQuestionView(db, asker, id);
    expect(asAsker).toMatchObject({
      status: "answered",
      answer: ANSWER,
      viewerRole: "asker",
      responderHandle: r.handle,
    });
  });

  it("asks people to see crisis resources before paying", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    const input = {
      responderId: r.userId,
      title: "I can't do this anymore",
      body: "Some days I honestly want to die and I don't know who to talk to.",
      crisisAcknowledged: false,
      locale: "en",
      baseUrl: "https://example.org",
    };
    expect(await askQuestion(db, payments, asker, input)).toEqual({ ok: false, error: "crisis-check" });
    expect(await db.select().from(question)).toEqual([]);
    const res = await askQuestion(db, payments, asker, { ...input, crisisAcknowledged: true });
    expect(res.ok).toBe(true);
    const [q] = await db.select().from(question);
    expect(q.crisisFlag).toBe(true);
  });

  it("rejects self-questions, unavailable responders and too many open questions", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    const base = { title: "t", body: BODY, crisisAcknowledged: false, locale: "en", baseUrl: "https://e.org" };
    expect(await askQuestion(db, payments, r, { ...base, responderId: r.userId })).toEqual({
      ok: false,
      error: "self",
    });
    expect(await askQuestion(db, payments, asker, { ...base, responderId: asker.userId })).toEqual({
      ok: false,
      error: "self",
    });
    const pendingMember = await actor({ status: "pending" });
    expect(await askQuestion(db, payments, pendingMember, { ...base, responderId: r.userId })).toEqual({
      ok: false,
      error: "forbidden",
    });
    for (let i = 0; i < 3; i++)
      expect((await askQuestion(db, payments, asker, { ...base, responderId: r.userId })).ok).toBe(true);
    expect(await askQuestion(db, payments, asker, { ...base, responderId: r.userId })).toEqual({
      ok: false,
      error: "too-many-open",
    });
  });

  it("cancels and expires without ever charging", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    const a = await paidQuestion(payments, asker, r);
    const b = await paidQuestion(payments, asker, r);

    expect(await cancelQuestion(db, payments, r, a)).toEqual({ ok: false, error: "not-found" });
    expect(await cancelQuestion(db, payments, asker, a)).toEqual({ ok: true });

    await db
      .update(question)
      .set({ deadlineAt: new Date(Date.now() - 1000) })
      .where(eq(question.id, b));
    expect(await answerQuestion(db, payments, r, { questionId: b, answer: ANSWER })).toEqual({
      ok: false,
      error: "expired",
    });
    expect(await expireOverdue(db, payments)).toBe(1);
    expect(await expireOverdue(db, payments)).toBe(0);

    const statuses = Object.fromEntries((await db.select().from(question)).map((q) => [q.id, q.status]));
    expect(statuses).toEqual({ [a]: "cancelled", [b]: "expired" });
    expect(payments.ledger.filter((e) => e.op === "capture")).toEqual([]);
    expect(payments.ledger.filter((e) => e.op === "cancel").map((e) => e.ref)).toEqual([
      payments.paymentRefFor(a),
      payments.paymentRefFor(b),
    ]);
  });

  it("marks the question expired when capture is declined", async () => {
    const payments = createFakeProvider({ failCapture: true });
    const r = await readyResponder(payments);
    const asker = await actor();
    const id = await paidQuestion(payments, asker, r);
    expect(await answerQuestion(db, payments, r, { questionId: id, answer: ANSWER })).toEqual({
      ok: false,
      error: "payment-failed",
    });
    const [q] = await db.select().from(question).where(eq(question.id, id));
    expect(q.status).toBe("expired");
    expect(q.answer).toBeNull(); // no free answers
  });

  it("handles ratings, disputes and admin refunds", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    const admin = await actor({ role: "admin" });
    const id = await paidQuestion(payments, asker, r);
    await answerQuestion(db, payments, r, { questionId: id, answer: ANSWER });

    expect(await rateAnswer(db, asker, { questionId: id, rating: 6 })).toEqual({ ok: false, error: "invalid-input" });
    expect(await rateAnswer(db, r, { questionId: id, rating: 5 })).toEqual({ ok: false, error: "not-found" });
    expect(await rateAnswer(db, asker, { questionId: id, rating: 2, feedback: "Felt rushed" })).toEqual({ ok: true });

    expect(await getQuestionView(db, admin, id)).toBeNull(); // admins only see disputed questions
    expect(await openDispute(db, asker, { questionId: id, reason: "short" })).toEqual({
      ok: false,
      error: "invalid-input",
    });
    expect(
      await openDispute(db, asker, { questionId: id, reason: "The answer was copy-pasted and off-topic." }),
    ).toEqual({
      ok: true,
    });
    expect((await getQuestionView(db, admin, id))?.viewerRole).toBe("admin");

    const downgraded = { ...admin, profile: { ...admin.profile, role: "member" as const } }; // no 2FA yet
    expect(await resolveDispute(db, payments, downgraded, { questionId: id, refund: true })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await resolveDispute(db, payments, admin, { questionId: id, refund: true })).toEqual({ ok: true });
    expect(await resolveDispute(db, payments, admin, { questionId: id, refund: true })).toEqual({
      ok: false,
      error: "not-found",
    });
    const [q] = await db.select().from(question).where(eq(question.id, id));
    expect(q.status).toBe("refunded");
    expect(payments.ledger.filter((e) => e.op === "refund")).toHaveLength(1);
  });

  it("closes the dispute window after 7 days", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    const id = await paidQuestion(payments, asker, r);
    await answerQuestion(db, payments, r, { questionId: id, answer: ANSWER });
    await db.execute(sql`update question set answered_at = now() - interval '8 days' where id = ${id}`);
    expect(await openDispute(db, asker, { questionId: id, reason: "Changed my mind after a week." })).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("releases holds when a responder is suspended and erases texts when an asker deletes their account", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    const admin = await actor({ role: "admin" });
    const id = await paidQuestion(payments, asker, r);

    await suspendUser(db, admin, { userId: r.userId });
    expect(await expireOverdue(db, payments)).toBe(1);
    expect(await listAvailableResponders(db)).toEqual([]);

    await deleteAccount(db, asker.userId);
    const [q] = await db.select().from(question).where(eq(question.id, id));
    expect(q).toMatchObject({ askerId: null, title: "", body: "", status: "expired", priceCents: 2000 });
  });
});
