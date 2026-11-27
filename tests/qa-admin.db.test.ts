import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "@/db";
import { auditLog, profile, qaSettings, question, responderApplication, responderProfile, user } from "@/db/schema";
import { ensureProfile } from "@/lib/membership";
import { createFakeProvider } from "@/lib/payments/fake";
import {
  answerQuestion,
  askQuestion,
  expireOverdue,
  getResponderStanding,
  listAvailableResponders,
  markAuthorized,
  openDispute,
  refreshPayoutStatus,
  resolveDispute,
  saveResponderProfile,
  startPayoutOnboarding,
  type Actor,
} from "@/lib/qa";
import {
  applyAsResponder,
  decideResponderApplication,
  getFinance,
  getOverview,
  getUnlockedContent,
  listQuestionMeta,
  netSplit,
  setResponderPaused,
  unlockQuestion,
  updateQaSettings,
} from "@/lib/qa-admin";

const url = process.env.TEST_DATABASE_URL;
const ANSWER = "Thank you for trusting me with this. Here is what helped me in a similar situation...";
const BODY = "I want to tell my parents but I'm scared of how they'll react.";
const DEFAULTS = {
  feePercent: 20,
  answerHours: 48,
  priceMinCents: 500,
  priceMaxCents: 10000,
  maxOpenPerAsker: 3,
  overdueWarnAt: 2,
  overduePauseAt: 3,
};

describe.skipIf(!url)("Q&A admin console (postgres)", () => {
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
    // Truncating "user" cascades to qa_settings (updated_by FK), so recreate the row.
    await db
      .insert(qaSettings)
      .values({ id: 1, ...DEFAULTS })
      .onConflictDoUpdate({ target: qaSettings.id, set: DEFAULTS });
  });

  let n = 0;
  async function actor(over: Partial<typeof profile.$inferInsert> = {}): Promise<Actor & { handle: string }> {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "", email: `${id}@t.local` });
    await ensureProfile(db, id);
    await db
      .update(profile)
      .set({ status: "approved", approvedAt: new Date(), handle: `adm${++n}`, trustLevel: 1, ...over })
      .where(eq(profile.userId, id));
    const [p] = await db.select().from(profile).where(eq(profile.userId, id));
    return { userId: id, profile: p, handle: p.handle! };
  }
  async function readyResponder(payments: ReturnType<typeof createFakeProvider>, priceCents = 2000) {
    const r = await actor({ role: "responder" });
    await startPayoutOnboarding(db, payments, r, { returnUrl: "x", refreshUrl: "y" });
    await refreshPayoutStatus(db, payments, r.userId);
    const res = await saveResponderProfile(db, r, {
      headline: "",
      bio: "",
      topics: [],
      languages: [],
      priceCents,
      accepting: true,
    });
    expect(res).toEqual({ ok: true });
    return r;
  }
  async function ask(payments: ReturnType<typeof createFakeProvider>, asker: Actor, r: Actor, title = "Coming out") {
    const res = await askQuestion(db, payments, asker, {
      responderId: r.userId,
      title,
      body: BODY,
      crisisAcknowledged: true,
      locale: "en",
      baseUrl: "https://e.org",
    });
    if (!res.ok) return res;
    const [q] = await db.select().from(question).where(eq(question.id, res.questionId));
    await markAuthorized(db, {
      questionId: q.id,
      paymentRef: payments.paymentRefFor(q.id),
      amountCents: q.priceCents,
      currency: q.currency,
    });
    return { ok: true as const, id: q.id };
  }
  /** Make an open question miss its natural deadline. */
  const missDeadline = (id: string) =>
    db.execute(
      sql`update question set authorized_at = now() - (answer_hours + 1) * interval '1 hour', deadline_at = now() - interval '1 hour' where id = ${id}`,
    );

  it("lets admins change settings, logs the change, and applies it to new questions only", async () => {
    const payments = createFakeProvider();
    const admin = await actor({ role: "admin" });
    const member = await actor();
    const r = await readyResponder(payments);
    const asker = await actor();
    const before = await ask(payments, asker, r, "Before");

    expect(await updateQaSettings(db, member, DEFAULTS)).toEqual({ ok: false, error: "forbidden" });
    expect(await updateQaSettings(db, admin, { ...DEFAULTS, overduePauseAt: 1, overdueWarnAt: 2 })).toEqual({
      ok: false,
      error: "invalid-input",
    });
    expect(
      await updateQaSettings(db, admin, { ...DEFAULTS, feePercent: 25, answerHours: 24, maxOpenPerAsker: 2 }),
    ).toEqual({
      ok: true,
    });
    const [log] = await db.select().from(auditLog).where(eq(auditLog.action, "qa.settings-updated"));
    expect(log.meta).toEqual({
      feePercent: { from: 20, to: 25 },
      answerHours: { from: 48, to: 24 },
      maxOpenPerAsker: { from: 3, to: 2 },
    });

    const after = await ask(payments, asker, r, "After");
    const rows = Object.fromEntries((await db.select().from(question)).map((q) => [q.title, q]));
    expect(rows.Before).toMatchObject({ feeCents: 400, answerHours: 48 });
    expect(rows.After).toMatchObject({ feeCents: 500, answerHours: 24 });
    const deadline = rows.After.deadlineAt!.getTime() - rows.After.authorizedAt!.getTime();
    expect(Math.round(deadline / 3_600_000)).toBe(24);
    expect(before.ok && after.ok).toBe(true);
    expect(await ask(payments, asker, r, "Third")).toEqual({ ok: false, error: "too-many-open" });

    await updateQaSettings(db, admin, { ...DEFAULTS, priceMinCents: 2500 });
    expect(
      await saveResponderProfile(db, r, {
        headline: "",
        bio: "",
        topics: [],
        languages: [],
        priceCents: 2000,
        accepting: true,
      }),
    ).toEqual({ ok: false, error: "invalid-input" });
  });

  it("supports partial refunds that reverse the split proportionally", async () => {
    const payments = createFakeProvider();
    const admin = await actor({ role: "admin" });
    const r = await readyResponder(payments);
    const asker = await actor();
    const { id } = (await ask(payments, asker, r)) as { id: string };
    await answerQuestion(db, payments, r, { questionId: id, answer: ANSWER });
    await openDispute(db, asker, { questionId: id, reason: "Only half of my question was answered." });

    expect(await resolveDispute(db, payments, admin, { questionId: id, refundCents: 1000, note: "half" })).toEqual({
      ok: true,
    });
    const [q] = await db.select().from(question).where(eq(question.id, id));
    expect(q).toMatchObject({ status: "answered", refundedCents: 1000 });
    expect(netSplit(q)).toEqual({ charged: 2000, refunded: 1000, fee: 200, responder: 800 });
    expect(payments.ledger.at(-1)).toMatchObject({ op: "refund", amountCents: 1000 });
    const [log] = await db.select().from(auditLog).where(eq(auditLog.action, "question.refunded"));
    expect(log.meta).toEqual({ refundCents: 1000, note: "half" });

    const fin = await getFinance(db, admin, 30);
    expect(fin?.totals).toEqual({ charged: 2000, refunded: 1000, platform: 200, responders: 800 });
  });

  it("keeps content locked unless disputed or crisis-flagged, and logs every unlock", async () => {
    const payments = createFakeProvider();
    const admin = await actor({ role: "admin" });
    const otherAdmin = await actor({ role: "admin" });
    const r = await readyResponder(payments);
    const asker = await actor();
    const { id } = (await ask(payments, asker, r, "Private title")) as { id: string };

    const meta = await listQuestionMeta(db, {});
    expect(JSON.stringify(meta)).not.toContain("Private title");
    expect(JSON.stringify(meta)).not.toContain(asker.handle);

    expect(await unlockQuestion(db, admin, { questionId: id, reason: "review" })).toEqual({
      ok: false,
      error: "not-eligible",
    });
    await answerQuestion(db, payments, r, { questionId: id, answer: ANSWER });
    await openDispute(db, asker, { questionId: id, reason: "This answer did not help at all." });
    expect(await unlockQuestion(db, admin, { questionId: id, reason: "curious" })).toEqual({
      ok: false,
      error: "invalid-input",
    });
    expect(await getUnlockedContent(db, admin, id)).toBeNull();

    expect(await unlockQuestion(db, admin, { questionId: id, reason: "review" })).toEqual({ ok: true });
    const content = await getUnlockedContent(db, admin, id);
    expect(content).toMatchObject({ title: "Private title", askerHandle: asker.handle, reason: "review" });
    expect(await getUnlockedContent(db, otherAdmin, id)).toBeNull(); // per admin

    await db.execute(
      sql`update audit_log set created_at = now() - interval '31 minutes' where action = 'question.content-viewed'`,
    );
    expect(await getUnlockedContent(db, admin, id)).toBeNull(); // grant expires

    const member = await actor();
    expect(await unlockQuestion(db, member, { questionId: id, reason: "review" })).toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("warns before pausing responders who miss deadlines", async () => {
    const payments = createFakeProvider();
    const r = await readyResponder(payments);
    const asker = await actor();
    await db.update(qaSettings).set({ maxOpenPerAsker: 10 });

    const miss = async () => {
      const { id } = (await ask(payments, asker, r)) as { id: string };
      await missDeadline(id);
      await expireOverdue(db, payments);
    };

    await miss();
    expect(await getResponderStanding(db, r.userId)).toMatchObject({ missed: 1, warned: false, pausedAt: null });
    await miss();
    let standing = await getResponderStanding(db, r.userId);
    expect(standing).toMatchObject({ missed: 2, warned: true, pausedAt: null });
    expect((await listAvailableResponders(db)).map((x) => x.userId)).toEqual([r.userId]); // warned, still listed

    // Released early (e.g. suspension) or a failed payment doesn't count.
    const { id: released } = (await ask(payments, asker, r)) as { id: string };
    await db.execute(sql`update question set deadline_at = now() - interval '1 minute' where id = ${released}`);
    await expireOverdue(db, payments);
    expect((await getResponderStanding(db, r.userId)).missed).toBe(2);
    const [rel] = await db.select().from(question).where(eq(question.id, released));
    expect(rel.closeReason).toBe("released");

    await miss();
    standing = await getResponderStanding(db, r.userId);
    expect(standing.missed).toBe(3);
    expect(standing.pausedAt).not.toBeNull();
    expect(standing.pauseReason).toBe("overdue");
    expect(await listAvailableResponders(db)).toEqual([]);
    const actions = (await db.select({ a: auditLog.action }).from(auditLog)).map((x) => x.a);
    expect(actions).toEqual(expect.arrayContaining(["responder.warned", "responder.auto-paused"]));

    const admin = await actor({ role: "admin" });
    expect(await setResponderPaused(db, admin, { userId: r.userId, paused: false })).toEqual({ ok: true });
    const [rp] = await db.select().from(responderProfile).where(eq(responderProfile.userId, r.userId));
    expect(rp).toMatchObject({ pausedAt: null, pauseReason: null, overdueWarnedAt: null });
    expect((await listAvailableResponders(db)).map((x) => x.userId)).toEqual([r.userId]);
  });

  it("always warns first, even when the thresholds are equal", async () => {
    const payments = createFakeProvider();
    await db.update(qaSettings).set({ overdueWarnAt: 1, overduePauseAt: 1, maxOpenPerAsker: 10 });
    const r = await readyResponder(payments);
    const asker = await actor();
    for (const expected of [
      { warned: true, paused: false },
      { warned: true, paused: true },
    ]) {
      const { id } = (await ask(payments, asker, r)) as { id: string };
      await missDeadline(id);
      await expireOverdue(db, payments);
      const s = await getResponderStanding(db, r.userId);
      expect({ warned: s.warned, paused: !!s.pausedAt }).toEqual(expected);
    }
  });

  it("runs the responder application flow and wipes the text after a decision", async () => {
    const admin = await actor({ role: "admin" });
    const newbie = await actor({ trustLevel: 0 });
    const member = await actor();
    const input = {
      experience: "Came out at 19, have supported friends through family conflict.",
      topics: ["family", "bogus"],
      guidelinesAccepted: true,
    };

    expect(await applyAsResponder(db, newbie, input)).toEqual({ ok: false, error: "not-eligible" });
    expect(await applyAsResponder(db, member, { ...input, guidelinesAccepted: false })).toEqual({
      ok: false,
      error: "invalid-input",
    });
    expect(await applyAsResponder(db, member, input)).toEqual({ ok: true });
    expect(await applyAsResponder(db, member, input)).toEqual({ ok: false, error: "already-pending" });

    const [app] = await db.select().from(responderApplication);
    expect(app.topics).toEqual(["family"]);
    expect(await decideResponderApplication(db, member, { id: app.id, approve: true })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await decideResponderApplication(db, admin, { id: app.id, approve: true })).toEqual({ ok: true });
    const [after] = await db.select().from(responderApplication);
    expect(after).toMatchObject({ status: "approved", experience: null, reviewerId: admin.userId });
    const [p] = await db.select().from(profile).where(eq(profile.userId, member.userId));
    expect(p.role).toBe("responder");
  });

  it("summarises the last days without exposing content", async () => {
    const payments = createFakeProvider();
    const admin = await actor({ role: "admin" });
    const r = await readyResponder(payments);
    const asker = await actor();
    const a = (await ask(payments, asker, r, "Answered one")) as { id: string };
    const b = (await ask(payments, asker, r, "Missed one")) as { id: string };
    await ask(payments, asker, r, "Still open");
    await answerQuestion(db, payments, r, { questionId: a.id, answer: ANSWER });
    await missDeadline(b.id);
    await expireOverdue(db, payments);

    const o = await getOverview(db, admin, 7);
    expect(o).toMatchObject({
      questions: 3,
      answered: 1,
      closed: 2,
      onTime: 1,
      chargedCents: 2000,
      platformCents: 400,
      responderCents: 1600,
    });
    expect(o!.daily).toHaveLength(7);
    expect(o!.daily.at(-1)!.count).toBe(3);
    expect(JSON.stringify(o)).not.toContain("Answered one");
    expect(await getOverview(db, await actor(), 7)).toBeNull();
  });
});
