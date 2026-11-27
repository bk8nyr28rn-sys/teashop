import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { auditLog, profile, qaSettings, question, responderProfile, type QaSettings, type Question } from "@/db/schema";
import { platformFee, qaConfig } from "@/config/qa";
import { hasCrisisLanguage } from "./crisis";
import { PaymentError, type PaymentProvider } from "./payments/types";
import { canEnterMemberArea, type Viewer } from "./permissions";

/**
 * Paid Q&A lifecycle. Every money-moving transition is guarded by a row lock
 * or a conditional UPDATE so it happens at most once.
 */

export type Actor = { userId: string; profile: Viewer };

export type QaError =
  | "forbidden"
  | "not-found"
  | "invalid-input"
  | "unavailable"
  | "self"
  | "crisis-check"
  | "too-many-open"
  | "payouts-not-ready"
  | "expired"
  | "payment-failed"
  | "already-done";

type Fail = { ok: false; error: QaError };
const fail = (error: QaError): Fail => ({ ok: false, error });

const HOUR = 3_600_000;

const isApproved = (a: Actor) => canEnterMemberArea(a.profile);
/** Effective role — staff without verified 2FA are already downgraded by the DAL. */
const isResponder = (a: Actor) => isApproved(a) && (a.profile.role === "responder" || a.profile.role === "admin");
const isAdmin = (a: Actor) => isApproved(a) && a.profile.role === "admin";

const text = (v: unknown, min: number, max: number): string | null => {
  const t = String(v ?? "").trim();
  return t.length >= min && t.length <= max ? t : null;
};

async function audit(db: Db, actorId: string | null, action: string, targetId: string, meta?: Record<string, unknown>) {
  await db.insert(auditLog).values({ id: randomUUID(), actorId, action, targetType: "question", targetId, meta });
}

/* -------------------------------- Settings ------------------------------- */

const DEFAULT_SETTINGS: QaSettings = {
  id: 1,
  feePercent: qaConfig.defaultFeePercent,
  answerHours: qaConfig.answerHours,
  priceMinCents: qaConfig.priceMinCents,
  priceMaxCents: qaConfig.priceMaxCents,
  maxOpenPerAsker: qaConfig.maxOpenPerAsker,
  overdueWarnAt: 2,
  overduePauseAt: 3,
  updatedAt: new Date(0),
  updatedBy: null,
};

/** Admin-editable settings (single row). Falls back to code defaults if missing. */
export async function getQaSettings(db: Db): Promise<QaSettings> {
  const [row] = await db.select().from(qaSettings).where(eq(qaSettings.id, 1));
  return row ?? DEFAULT_SETTINGS;
}

/* --------------------------- Responder profile --------------------------- */

export async function getResponderProfile(db: Db, userId: string) {
  const [row] = await db.select().from(responderProfile).where(eq(responderProfile.userId, userId));
  return row ?? null;
}

export type ResponderInput = {
  headline: string;
  bio: string;
  topics: string[];
  languages: string[];
  priceCents: number;
  accepting: boolean;
};

export async function saveResponderProfile(db: Db, actor: Actor, input: ResponderInput): Promise<{ ok: true } | Fail> {
  if (!isResponder(actor)) return fail("forbidden");
  const headline = text(input.headline, 0, qaConfig.headlineMax);
  const bio = text(input.bio, 0, qaConfig.bioMax);
  const price = Math.round(input.priceCents);
  const topics = [...new Set(input.topics)].filter((t) => (qaConfig.topics as readonly string[]).includes(t));
  const languages = [...new Set(input.languages)].filter((l) => (qaConfig.languages as readonly string[]).includes(l));
  if (headline === null || bio === null || !Number.isInteger(price)) return fail("invalid-input");
  const settings = await getQaSettings(db);
  if (price < settings.priceMinCents || price > settings.priceMaxCents) return fail("invalid-input");

  const existing = await getResponderProfile(db, actor.userId);
  if (input.accepting && !existing?.payoutsReady) return fail("payouts-not-ready");

  const values = {
    headline,
    bio,
    topics,
    languages,
    priceCents: price,
    accepting: input.accepting,
    updatedAt: new Date(),
  };
  await db
    .insert(responderProfile)
    .values({ userId: actor.userId, ...values })
    .onConflictDoUpdate({ target: responderProfile.userId, set: values });
  return { ok: true };
}

/** Start (or resume) payout onboarding with the provider. Returns where to send the responder. */
export async function startPayoutOnboarding(
  db: Db,
  provider: PaymentProvider,
  actor: Actor,
  urls: { returnUrl: string; refreshUrl: string },
): Promise<{ ok: true; url: string } | Fail> {
  if (!isResponder(actor)) return fail("forbidden");
  await db.insert(responderProfile).values({ userId: actor.userId }).onConflictDoNothing();
  let row = (await getResponderProfile(db, actor.userId))!;
  if (!row.payoutAccountId) {
    const { accountId } = await provider.createPayoutAccount({ userId: actor.userId });
    await db
      .update(responderProfile)
      .set({ payoutAccountId: accountId })
      .where(and(eq(responderProfile.userId, actor.userId), isNull(responderProfile.payoutAccountId)));
    row = (await getResponderProfile(db, actor.userId))!;
  }
  const { url } = await provider.onboardingLink({ accountId: row.payoutAccountId!, ...urls });
  return { ok: true, url };
}

/** Ask the provider whether payouts work yet (after returning from onboarding). */
export async function refreshPayoutStatus(db: Db, provider: PaymentProvider, userId: string): Promise<boolean> {
  const row = await getResponderProfile(db, userId);
  if (!row?.payoutAccountId) return false;
  const ready = await provider.payoutAccountReady(row.payoutAccountId);
  await setPayoutsReady(db, row.payoutAccountId, ready);
  return ready;
}

export async function setPayoutsReady(db: Db, accountId: string, ready: boolean) {
  await db
    .update(responderProfile)
    .set(ready ? { payoutsReady: true } : { payoutsReady: false, accepting: false })
    .where(eq(responderProfile.payoutAccountId, accountId));
}

/** Responders people can ask right now. */
export async function listAvailableResponders(db: Db) {
  return db
    .select({
      userId: responderProfile.userId,
      handle: profile.handle,
      headline: responderProfile.headline,
      bio: responderProfile.bio,
      topics: responderProfile.topics,
      languages: responderProfile.languages,
      priceCents: responderProfile.priceCents,
      currency: responderProfile.currency,
    })
    .from(responderProfile)
    .innerJoin(profile, eq(profile.userId, responderProfile.userId))
    .where(
      and(
        eq(responderProfile.accepting, true),
        eq(responderProfile.payoutsReady, true),
        isNull(responderProfile.pausedAt),
        eq(profile.status, "approved"),
        inArray(profile.role, ["responder", "admin"]),
      ),
    )
    .orderBy(profile.handle);
}

/* -------------------------------- Asking -------------------------------- */

export async function askQuestion(
  db: Db,
  provider: PaymentProvider,
  actor: Actor,
  input: {
    responderId: string;
    title: string;
    body: string;
    crisisAcknowledged: boolean;
    locale: string;
    baseUrl: string;
  },
): Promise<{ ok: true; questionId: string; checkoutUrl: string } | Fail> {
  if (!isApproved(actor)) return fail("forbidden");
  if (input.responderId === actor.userId) return fail("self");
  const title = text(input.title, 1, qaConfig.titleMax);
  const body = text(input.body, qaConfig.bodyMin, qaConfig.bodyMax);
  if (!title || !body) return fail("invalid-input");

  const responder = (await listAvailableResponders(db)).find((r) => r.userId === input.responderId);
  if (!responder) return fail("unavailable");
  const [account] = await db
    .select({ payoutAccountId: responderProfile.payoutAccountId })
    .from(responderProfile)
    .where(eq(responderProfile.userId, input.responderId));
  if (!account?.payoutAccountId) return fail("unavailable");

  // Crisis language: show support resources before any payment. The asker
  // may still continue (their choice), and the responder sees the flag.
  const crisis = hasCrisisLanguage(title, body);
  if (crisis && !input.crisisAcknowledged) return fail("crisis-check");

  const [{ n }] = await db
    .select({ n: count() })
    .from(question)
    .where(and(eq(question.askerId, actor.userId), inArray(question.status, ["awaiting_payment", "open"])));
  const settings = await getQaSettings(db);
  if (n >= settings.maxOpenPerAsker) return fail("too-many-open");

  const id = randomUUID();
  // Fee and answer window are snapshotted: later setting changes never touch this question.
  const feeCents = platformFee(responder.priceCents, settings.feePercent);
  await db.insert(question).values({
    id,
    askerId: actor.userId,
    responderId: input.responderId,
    title,
    body,
    priceCents: responder.priceCents,
    feeCents,
    answerHours: settings.answerHours,
    currency: responder.currency,
    crisisFlag: crisis,
  });

  try {
    const back = `${input.baseUrl}/${input.locale}/questions/${id}`;
    const checkout = await provider.createCheckout({
      questionId: id,
      amountCents: responder.priceCents,
      feeCents,
      currency: responder.currency,
      payoutAccountId: account.payoutAccountId,
      locale: input.locale,
      successUrl: `${back}?checkout=done`,
      cancelUrl: `${back}?checkout=cancelled`,
    });
    await db.update(question).set({ checkoutRef: checkout.checkoutRef }).where(eq(question.id, id));
    return { ok: true, questionId: id, checkoutUrl: checkout.url };
  } catch (e) {
    await db.delete(question).where(eq(question.id, id));
    console.error("[qa] checkout failed", e);
    return fail("payment-failed");
  }
}

/**
 * The card was authorised (webhook / fake checkout). Opens the question and
 * starts the answer clock. Amount and currency must match what we priced.
 */
export async function markAuthorized(
  db: Db,
  ev: { questionId: string; paymentRef: string; amountCents: number; currency: string },
): Promise<"opened" | "ignored" | "mismatch"> {
  const [q] = await db.select().from(question).where(eq(question.id, ev.questionId));
  if (!q || q.status !== "awaiting_payment") return "ignored";
  if (q.priceCents !== ev.amountCents || q.currency !== ev.currency.toLowerCase()) return "mismatch";
  const now = new Date();
  const rows = await db
    .update(question)
    .set({
      status: "open",
      paymentRef: ev.paymentRef,
      authorizedAt: now,
      deadlineAt: new Date(now.getTime() + q.answerHours * HOUR),
    })
    .where(and(eq(question.id, ev.questionId), eq(question.status, "awaiting_payment")))
    .returning({ id: question.id });
  return rows.length ? "opened" : "ignored";
}

export async function markCheckoutExpired(db: Db, questionId: string) {
  await db
    .update(question)
    .set({ status: "cancelled", closedAt: new Date(), closeReason: "cancelled" })
    .where(and(eq(question.id, questionId), eq(question.status, "awaiting_payment")));
}

/* ------------------------------- Answering ------------------------------ */

/** Deliver the answer. Payment is captured first; the answer is saved only if that succeeds. */
export async function answerQuestion(
  db: Db,
  provider: PaymentProvider,
  actor: Actor,
  input: { questionId: string; answer: string },
): Promise<{ ok: true } | Fail> {
  if (!isResponder(actor)) return fail("forbidden");
  const answer = text(input.answer, qaConfig.answerMin, qaConfig.answerMax);
  if (!answer) return fail("invalid-input");

  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(question).where(eq(question.id, input.questionId)).for("update");
    if (!q || q.responderId !== actor.userId) return fail("not-found");
    if (q.status !== "open") return fail("already-done");
    if (!q.paymentRef || !q.deadlineAt || q.deadlineAt.getTime() <= Date.now()) return fail("expired");

    try {
      await provider.capture(q.paymentRef, `capture-${q.id}`);
    } catch (e) {
      const code = e instanceof PaymentError ? e.code : "provider_error";
      if (code === "provider_error") throw e; // transient: let the responder retry
      await tx
        .update(question)
        .set({ status: "expired", closedAt: new Date(), closeReason: "payment_failed" })
        .where(eq(question.id, q.id));
      return fail("payment-failed");
    }
    const now = new Date();
    await tx
      .update(question)
      .set({ status: "answered", answer, answeredAt: now, closedAt: now })
      .where(eq(question.id, q.id));
    return { ok: true } as const;
  });
}

/** Asker withdraws before an answer arrives. Nothing is charged. */
export async function cancelQuestion(
  db: Db,
  provider: PaymentProvider,
  actor: Actor,
  questionId: string,
): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(question).where(eq(question.id, questionId)).for("update");
    if (!q || q.askerId !== actor.userId) return fail("not-found");
    if (q.status !== "awaiting_payment" && q.status !== "open") return fail("already-done");
    if (q.status === "open" && q.paymentRef) await provider.cancel(q.paymentRef);
    await tx
      .update(question)
      .set({ status: "cancelled", closedAt: new Date(), closeReason: "cancelled" })
      .where(eq(question.id, q.id));
    return { ok: true } as const;
  });
}

/** Release holds on overdue questions and clean up abandoned checkouts. Run from cron and lazily. */
export async function expireOverdue(db: Db, provider: PaymentProvider, now = new Date()): Promise<number> {
  const overdue = await db
    .select({
      id: question.id,
      paymentRef: question.paymentRef,
      responderId: question.responderId,
      authorizedAt: question.authorizedAt,
      answerHours: question.answerHours,
      deadlineAt: question.deadlineAt,
    })
    .from(question)
    .where(and(eq(question.status, "open"), lt(question.deadlineAt, now)))
    .limit(100);

  let expired = 0;
  const missedBy = new Set<string>();
  for (const q of overdue) {
    // A deadline pulled forward (suspension, removal, account deletion) isn't the responder's miss.
    const natural = q.authorizedAt ? q.authorizedAt.getTime() + q.answerHours * HOUR : 0;
    const reason = q.deadlineAt && q.deadlineAt.getTime() < natural - 60_000 ? "released" : "deadline";
    try {
      if (q.paymentRef) await provider.cancel(q.paymentRef);
      const rows = await db
        .update(question)
        .set({ status: "expired", closedAt: now, closeReason: reason })
        .where(and(eq(question.id, q.id), eq(question.status, "open")))
        .returning({ id: question.id });
      expired += rows.length;
      if (rows.length && reason === "deadline" && q.responderId) missedBy.add(q.responderId);
    } catch (e) {
      console.error("[qa] failed to expire", q.id, e);
    }
  }
  for (const responderId of missedBy) await evaluateMissedDeadlines(db, responderId);

  await db
    .update(question)
    .set({ status: "cancelled", closedAt: now, closeReason: "cancelled" })
    .where(
      and(
        eq(question.status, "awaiting_payment"),
        lt(question.createdAt, new Date(now.getTime() - qaConfig.checkoutTtlMinutes * 60_000)),
      ),
    );
  return expired;
}

/* --------------------------- Missed deadlines --------------------------- */

const STRIKE_WINDOW_MS = 30 * 24 * HOUR;

export async function missedDeadlines(db: Db, responderId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(question)
    .where(
      and(
        eq(question.responderId, responderId),
        eq(question.status, "expired"),
        eq(question.closeReason, "deadline"),
        gt(question.closedAt, new Date(Date.now() - STRIKE_WINDOW_MS)),
      ),
    );
  return n;
}

/**
 * Warn first, then pause: at `overdueWarnAt` misses (30 days) the responder is
 * warned; only a responder who was already warned is paused at
 * `overduePauseAt`. Someone who jumps straight past both still gets the warning first.
 */
export async function evaluateMissedDeadlines(db: Db, responderId: string): Promise<"none" | "warned" | "paused"> {
  const [settings, rp, missed] = await Promise.all([
    getQaSettings(db),
    getResponderProfile(db, responderId),
    missedDeadlines(db, responderId),
  ]);
  if (!rp || rp.pausedAt) return "none";
  const warnedRecently = !!rp.overdueWarnedAt && rp.overdueWarnedAt.getTime() > Date.now() - STRIKE_WINDOW_MS;

  if (warnedRecently && missed >= settings.overduePauseAt) {
    await db
      .update(responderProfile)
      .set({ pausedAt: new Date(), pauseReason: "overdue" })
      .where(eq(responderProfile.userId, responderId));
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorId: null,
      action: "responder.auto-paused",
      targetType: "user",
      targetId: responderId,
      meta: { missed },
    });
    return "paused";
  }
  if (!warnedRecently && missed >= settings.overdueWarnAt) {
    await db
      .update(responderProfile)
      .set({ overdueWarnedAt: new Date() })
      .where(eq(responderProfile.userId, responderId));
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorId: null,
      action: "responder.warned",
      targetType: "user",
      targetId: responderId,
      meta: { missed },
    });
    return "warned";
  }
  return "none";
}

/** What the responder desk shows about their standing. */
export async function getResponderStanding(db: Db, responderId: string) {
  const [settings, rp, missed] = await Promise.all([
    getQaSettings(db),
    getResponderProfile(db, responderId),
    missedDeadlines(db, responderId),
  ]);
  return {
    missed,
    warnAt: settings.overdueWarnAt,
    pauseAt: settings.overduePauseAt,
    warned: !!rp?.overdueWarnedAt && rp.overdueWarnedAt.getTime() > Date.now() - STRIKE_WINDOW_MS,
    pausedAt: rp?.pausedAt ?? null,
    pauseReason: rp?.pauseReason ?? null,
  };
}

/* ------------------------- Feedback and disputes ------------------------ */

export async function rateAnswer(
  db: Db,
  actor: Actor,
  input: { questionId: string; rating: number; feedback?: string },
): Promise<{ ok: true } | Fail> {
  const rating = Math.round(input.rating);
  const feedback = text(input.feedback ?? "", 0, 1000);
  if (rating < 1 || rating > 5 || feedback === null) return fail("invalid-input");
  const rows = await db
    .update(question)
    .set({ rating, feedback: feedback || null })
    .where(and(eq(question.id, input.questionId), eq(question.askerId, actor.userId), eq(question.status, "answered")))
    .returning({ id: question.id });
  return rows.length ? { ok: true } : fail("not-found");
}

export async function openDispute(
  db: Db,
  actor: Actor,
  input: { questionId: string; reason: string },
): Promise<{ ok: true } | Fail> {
  const reason = text(input.reason, 10, 1000);
  if (!reason) return fail("invalid-input");
  const rows = await db
    .update(question)
    .set({ disputeReason: reason, disputedAt: new Date() })
    .where(
      and(
        eq(question.id, input.questionId),
        eq(question.askerId, actor.userId),
        eq(question.status, "answered"),
        isNull(question.disputedAt),
        sql`${question.answeredAt} > now() - make_interval(days => ${qaConfig.disputeWindowDays})`,
      ),
    )
    .returning({ id: question.id });
  if (!rows.length) return fail("not-found");
  await audit(db, actor.userId, "question.disputed", input.questionId);
  return { ok: true };
}

/**
 * Admin decision on a dispute: refund any amount up to what's left (0 keeps
 * the payment). Partial refunds reverse the responder's share and the platform
 * fee proportionally; a full refund marks the question refunded.
 */
export async function resolveDispute(
  db: Db,
  provider: PaymentProvider,
  actor: Actor,
  input: { questionId: string; refundCents: number; note?: string },
): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  const refundCents = Math.round(input.refundCents);
  if (!Number.isInteger(refundCents) || refundCents < 0) return fail("invalid-input");
  return db.transaction(async (tx) => {
    const [q] = await tx.select().from(question).where(eq(question.id, input.questionId)).for("update");
    if (!q || !q.disputedAt || q.disputeResolvedAt) return fail("not-found");
    if (refundCents > 0) {
      if (q.status !== "answered" || !q.paymentRef) return fail("already-done");
      if (refundCents > q.priceCents - q.refundedCents) return fail("invalid-input");
      await provider.refund(q.paymentRef, `refund-${q.id}-${q.refundedCents}`, refundCents);
    }
    const refunded = q.refundedCents + refundCents;
    await tx
      .update(question)
      .set({
        disputeResolvedAt: new Date(),
        refundedCents: refunded,
        ...(refunded === q.priceCents ? { status: "refunded" as const } : {}),
      })
      .where(eq(question.id, q.id));
    await tx.insert(auditLog).values({
      id: randomUUID(),
      actorId: actor.userId,
      action: refundCents > 0 ? "question.refunded" : "question.dispute-rejected",
      targetType: "question",
      targetId: q.id,
      meta: { refundCents, ...(input.note?.trim() ? { note: input.note.trim().slice(0, 500) } : {}) },
    });
    return { ok: true } as const;
  });
}

/** A card chargeback arrived from the provider: surface it to admins. */
export async function flagChargeback(db: Db, paymentRef: string) {
  await db
    .update(question)
    .set({
      disputedAt: new Date(),
      disputeReason: sql`coalesce(${question.disputeReason}, 'Card chargeback opened with the bank')`,
    })
    .where(and(eq(question.paymentRef, paymentRef), isNull(question.disputeResolvedAt)));
}

/* -------------------------------- Reading ------------------------------- */

export type QuestionView = {
  viewerRole: "asker" | "responder";
  id: string;
  title: string;
  body: string;
  status: Question["status"];
  priceCents: number;
  feeCents: number;
  refundedCents: number;
  currency: string;
  crisisFlag: boolean;
  deadlineAt: Date | null;
  answer: string | null;
  answeredAt: Date | null;
  rating: number | null;
  feedback: string | null;
  disputedAt: Date | null;
  disputeReason: string | null;
  disputeResolvedAt: Date | null;
  createdAt: Date;
  /** Shown to the asker. The responder never learns who asked. */
  responderHandle: string | null;
};

/**
 * Load a question for the viewer, or null. Askers see everything; responders
 * see the question but never the asker. Admins never read content here — only
 * through the logged unlock in the admin console (lib/qa-admin.ts).
 */
export async function getQuestionView(db: Db, actor: Actor, id: string): Promise<QuestionView | null> {
  const [row] = await db
    .select({ q: question, responderHandle: profile.handle })
    .from(question)
    .leftJoin(profile, eq(profile.userId, question.responderId))
    .where(eq(question.id, id));
  if (!row) return null;
  const q = row.q;

  let viewerRole: QuestionView["viewerRole"] | null = null;
  if (q.askerId === actor.userId) viewerRole = "asker";
  else if (q.responderId === actor.userId && isResponder(actor) && q.status !== "awaiting_payment")
    viewerRole = "responder";
  if (!viewerRole) return null;

  return {
    viewerRole,
    id: q.id,
    title: q.title,
    body: q.body,
    status: q.status,
    priceCents: q.priceCents,
    feeCents: q.feeCents,
    refundedCents: q.refundedCents,
    currency: q.currency,
    crisisFlag: q.crisisFlag,
    deadlineAt: q.deadlineAt,
    answer: q.answer,
    answeredAt: q.answeredAt,
    rating: q.rating,
    feedback: q.feedback,
    disputedAt: q.disputedAt,
    disputeReason: q.disputeReason,
    disputeResolvedAt: q.disputeResolvedAt,
    createdAt: q.createdAt,
    responderHandle: viewerRole === "responder" ? null : row.responderHandle,
  };
}

export async function listMyQuestions(db: Db, askerId: string) {
  return db
    .select({
      id: question.id,
      title: question.title,
      status: question.status,
      createdAt: question.createdAt,
      deadlineAt: question.deadlineAt,
      responderHandle: profile.handle,
    })
    .from(question)
    .leftJoin(profile, eq(profile.userId, question.responderId))
    .where(
      and(
        eq(question.askerId, askerId),
        sql`(${question.status} <> 'awaiting_payment' or ${question.createdAt} > now() - interval '2 hours')`,
      ),
    )
    .orderBy(desc(question.createdAt))
    .limit(50);
}

/** The responder's queue: open questions by deadline (crisis-flagged first), then recent history. */
export async function listResponderQueue(db: Db, responderId: string) {
  const base = {
    id: question.id,
    title: question.title,
    status: question.status,
    crisisFlag: question.crisisFlag,
    deadlineAt: question.deadlineAt,
    priceCents: question.priceCents,
    feeCents: question.feeCents,
    currency: question.currency,
    answeredAt: question.answeredAt,
  };
  const [open, history] = await Promise.all([
    db
      .select(base)
      .from(question)
      .where(and(eq(question.responderId, responderId), eq(question.status, "open")))
      .orderBy(desc(question.crisisFlag), asc(question.deadlineAt)),
    db
      .select(base)
      .from(question)
      .where(and(eq(question.responderId, responderId), inArray(question.status, ["answered", "refunded", "expired"])))
      .orderBy(desc(question.closedAt))
      .limit(20),
  ]);
  return { open, history };
}

/** Open disputes for the admin console — metadata and the asker's stated reason, never the question text. */
export async function listOpenDisputes(db: Db) {
  return db
    .select({
      id: question.id,
      disputeReason: question.disputeReason,
      disputedAt: question.disputedAt,
      priceCents: question.priceCents,
      feeCents: question.feeCents,
      refundedCents: question.refundedCents,
      currency: question.currency,
      status: question.status,
      rating: question.rating,
      answeredAt: question.answeredAt,
      responderHandle: profile.handle,
    })
    .from(question)
    .leftJoin(profile, eq(profile.userId, question.responderId))
    .where(and(isNotNull(question.disputedAt), isNull(question.disputeResolvedAt)))
    .orderBy(asc(question.disputedAt));
}

/** On suspension / account deletion: let pending questions expire at the next sweep (holds released). */
export async function releasePendingQuestionsFor(db: Db, userId: string) {
  await db
    .update(question)
    .set({ deadlineAt: new Date() })
    .where(and(eq(question.status, "open"), or(eq(question.askerId, userId), eq(question.responderId, userId))));
  await db.update(responderProfile).set({ accepting: false }).where(eq(responderProfile.userId, userId));
}
