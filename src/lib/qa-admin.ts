import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  application,
  auditLog,
  profile,
  qaSettings,
  question,
  report,
  responderApplication,
  responderProfile,
  type QaSettings,
} from "@/db/schema";
import { qaConfig } from "@/config/qa";
import { setResponderRole } from "./accounts";
import { canEnterMemberArea, type Viewer } from "./permissions";
import { getQaSettings, missedDeadlines } from "./qa";

/**
 * Admin console for paid Q&A.
 *
 * Privacy rule: admins work with metadata (amounts, status, timing,
 * responder). A question's title, text, answer and asker are only revealed
 * through `unlockQuestion` — allowed for disputed or crisis-flagged questions,
 * with a stated reason, recorded in the audit log, valid for 30 minutes.
 */

export type Actor = { userId: string; profile: Viewer };
export type AdminError = "forbidden" | "not-found" | "invalid-input" | "already-pending" | "not-eligible";
type Fail = { ok: false; error: AdminError };
const fail = (error: AdminError): Fail => ({ ok: false, error });

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const UNLOCK_MS = 30 * 60_000;

const isAdmin = (a: Actor) => canEnterMemberArea(a.profile) && a.profile.role === "admin";

async function audit(
  db: Db,
  actorId: string | null,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({ id: randomUUID(), actorId, action, targetType, targetId, meta });
}

/* ------------------------------ Money math ------------------------------ */

/** What actually stays charged after (partial) refunds, split between responder and platform. */
export function netSplit(q: { priceCents: number; feeCents: number; refundedCents: number; status: string }) {
  if (q.status !== "answered" && q.status !== "refunded") return { charged: 0, refunded: 0, fee: 0, responder: 0 };
  const net = q.priceCents - q.refundedCents;
  const fee = q.priceCents ? Math.round((q.feeCents * net) / q.priceCents) : 0;
  return { charged: q.priceCents, refunded: q.refundedCents, fee, responder: net - fee };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/* ------------------------------- Overview ------------------------------- */

const metaColumns = {
  id: question.id,
  status: question.status,
  priceCents: question.priceCents,
  feeCents: question.feeCents,
  refundedCents: question.refundedCents,
  currency: question.currency,
  answerHours: question.answerHours,
  crisisFlag: question.crisisFlag,
  createdAt: question.createdAt,
  authorizedAt: question.authorizedAt,
  answeredAt: question.answeredAt,
  deadlineAt: question.deadlineAt,
  closeReason: question.closeReason,
  rating: question.rating,
  disputedAt: question.disputedAt,
  disputeResolvedAt: question.disputeResolvedAt,
  responderId: question.responderId,
  responderHandle: profile.handle,
};

export type QuestionMeta = Awaited<ReturnType<typeof listQuestionMeta>>[number];

/** Metadata only — never titles, text, answers or askers. */
export async function listQuestionMeta(
  db: Db,
  opts: { sinceDays?: number; filter?: QuestionFilter; limit?: number } = {},
) {
  const conds = [sql`${question.status} <> 'awaiting_payment'`];
  if (opts.sinceDays) conds.push(gt(question.createdAt, new Date(Date.now() - opts.sinceDays * DAY)));
  switch (opts.filter) {
    case "open":
    case "answered":
    case "expired":
    case "refunded":
      conds.push(eq(question.status, opts.filter));
      break;
    case "disputed":
      conds.push(isNotNull(question.disputedAt), isNull(question.disputeResolvedAt));
      break;
    case "crisis":
      conds.push(eq(question.crisisFlag, true));
      break;
  }
  return db
    .select(metaColumns)
    .from(question)
    .leftJoin(profile, eq(profile.userId, question.responderId))
    .where(and(...conds))
    .orderBy(desc(question.createdAt))
    .limit(opts.limit ?? 200);
}

export const QUESTION_FILTERS = ["all", "open", "answered", "expired", "refunded", "disputed", "crisis"] as const;
export type QuestionFilter = (typeof QUESTION_FILTERS)[number];

const responseHours = (q: QuestionMeta) =>
  q.answeredAt && q.authorizedAt ? (q.answeredAt.getTime() - q.authorizedAt.getTime()) / HOUR : null;

export async function getOverview(db: Db, actor: Actor, days = 7) {
  if (!isAdmin(actor)) return null;
  const qs = await listQuestionMeta(db, { sinceDays: days, limit: 5000 });
  const answered = qs.filter((q) => q.status === "answered" || q.status === "refunded");
  const missed = qs.filter((q) => q.status === "expired" && q.closeReason === "deadline");
  const onTime = answered.filter((q) => {
    const h = responseHours(q);
    return h !== null && h <= q.answerHours;
  });
  const money = qs.map(netSplit);
  const ratings = qs.map((q) => q.rating).filter((r): r is number => !!r);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const daily = [...Array(days)].map((_, i) => {
    const from = startOfToday.getTime() - (days - 1 - i) * DAY;
    return {
      day: new Date(from),
      count: qs.filter((q) => q.createdAt.getTime() >= from && q.createdAt.getTime() < from + DAY).length,
    };
  });

  // Needs attention (not limited to the window).
  const open = await listQuestionMeta(db, { filter: "open", limit: 500 });
  const now = Date.now();
  const crisisWaiting = open
    .filter((q) => q.crisisFlag)
    .map((q) => ({
      id: q.id,
      responder: q.responderHandle,
      waitedHours: q.authorizedAt ? (now - q.authorizedAt.getTime()) / HOUR : 0,
    }));
  const expiringSoon = open
    .filter((q) => !q.crisisFlag && q.deadlineAt && q.deadlineAt.getTime() - now < 12 * HOUR)
    .map((q) => ({
      id: q.id,
      responder: q.responderHandle,
      hoursLeft: Math.max(0, (q.deadlineAt!.getTime() - now) / HOUR),
    }));
  const [[disputes], [responderApps], [memberApps], [openReports], warned] = await Promise.all([
    db
      .select({ n: count() })
      .from(question)
      .where(and(isNotNull(question.disputedAt), isNull(question.disputeResolvedAt))),
    db.select({ n: count() }).from(responderApplication).where(eq(responderApplication.status, "pending")),
    db.select({ n: count() }).from(application).where(eq(application.status, "pending")),
    db.select({ n: count() }).from(report).where(eq(report.status, "open")),
    db
      .select({
        handle: profile.handle,
        pausedAt: responderProfile.pausedAt,
        pauseReason: responderProfile.pauseReason,
      })
      .from(responderProfile)
      .innerJoin(profile, eq(profile.userId, responderProfile.userId))
      .where(
        sql`(${responderProfile.pausedAt} is not null and ${responderProfile.pauseReason} = 'overdue') or ${responderProfile.overdueWarnedAt} > now() - interval '30 days'`,
      ),
  ]);

  return {
    days,
    questions: qs.length,
    answered: answered.length,
    closed: answered.length + missed.length,
    onTime: onTime.length,
    medianResponseHours: median(answered.map(responseHours).filter((h): h is number => h !== null)),
    chargedCents: money.reduce((a, m) => a + m.charged, 0),
    refundedCents: money.reduce((a, m) => a + m.refunded, 0),
    platformCents: money.reduce((a, m) => a + m.fee, 0),
    responderCents: money.reduce((a, m) => a + m.responder, 0),
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    daily,
    attention: {
      crisisWaiting,
      expiringSoon,
      disputes: disputes.n,
      responderApplications: responderApps.n,
      memberApplications: memberApps.n,
      openReports: openReports.n,
      responders: warned.map((w) => ({ handle: w.handle, paused: !!w.pausedAt })),
    },
  };
}

/* ---------------------------- Content unlock ---------------------------- */

export const UNLOCK_REASONS = ["review", "safety", "legal"] as const;
export type UnlockReason = (typeof UNLOCK_REASONS)[number];

export const canUnlock = (q: { disputedAt: Date | null; crisisFlag: boolean }) => !!q.disputedAt || q.crisisFlag;

export async function getQuestionMeta(db: Db, actor: Actor, id: string) {
  if (!isAdmin(actor)) return null;
  const [row] = await db
    .select(metaColumns)
    .from(question)
    .leftJoin(profile, eq(profile.userId, question.responderId))
    .where(eq(question.id, id));
  return row ?? null;
}

/** Record why the admin needs to read this question. Only for disputed or crisis-flagged questions. */
export async function unlockQuestion(
  db: Db,
  actor: Actor,
  input: { questionId: string; reason: string },
): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  if (!(UNLOCK_REASONS as readonly string[]).includes(input.reason)) return fail("invalid-input");
  const meta = await getQuestionMeta(db, actor, input.questionId);
  if (!meta) return fail("not-found");
  if (!canUnlock(meta)) return fail("not-eligible");
  await audit(db, actor.userId, "question.content-viewed", "question", input.questionId, { reason: input.reason });
  return { ok: true };
}

/** The content, if this admin unlocked it within the last 30 minutes; otherwise null. */
export async function getUnlockedContent(db: Db, actor: Actor, id: string) {
  if (!isAdmin(actor)) return null;
  const [grant] = await db
    .select({ at: auditLog.createdAt, meta: auditLog.meta })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.actorId, actor.userId),
        eq(auditLog.action, "question.content-viewed"),
        eq(auditLog.targetId, id),
        gt(auditLog.createdAt, new Date(Date.now() - UNLOCK_MS)),
      ),
    )
    .orderBy(desc(auditLog.createdAt))
    .limit(1);
  if (!grant) return null;
  const asker = profile;
  const [row] = await db
    .select({
      title: question.title,
      body: question.body,
      answer: question.answer,
      feedback: question.feedback,
      disputeReason: question.disputeReason,
      askerHandle: asker.handle,
    })
    .from(question)
    .leftJoin(asker, eq(asker.userId, question.askerId))
    .where(eq(question.id, id));
  return row
    ? { ...row, reason: (grant.meta as { reason?: string } | null)?.reason ?? null, unlockedAt: grant.at }
    : null;
}

/* ------------------------------ Responders ------------------------------ */

export async function listRespondersForAdmin(db: Db, actor: Actor) {
  if (!isAdmin(actor)) return [];
  const rows = await db
    .select({
      userId: responderProfile.userId,
      handle: profile.handle,
      headline: responderProfile.headline,
      priceCents: responderProfile.priceCents,
      currency: responderProfile.currency,
      accepting: responderProfile.accepting,
      payoutsReady: responderProfile.payoutsReady,
      pausedAt: responderProfile.pausedAt,
      pauseReason: responderProfile.pauseReason,
      overdueWarnedAt: responderProfile.overdueWarnedAt,
    })
    .from(responderProfile)
    .innerJoin(profile, eq(profile.userId, responderProfile.userId))
    .where(and(inArray(profile.role, ["responder", "admin"]), eq(profile.status, "approved")))
    .orderBy(profile.handle);

  const since = new Date(Date.now() - 30 * DAY);
  return Promise.all(
    rows.map(async (r) => {
      const qs = await db
        .select(metaColumns)
        .from(question)
        .leftJoin(profile, eq(profile.userId, question.responderId))
        .where(and(eq(question.responderId, r.userId), gte(question.createdAt, since)));
      const answered = qs.filter((q) => q.status === "answered" || q.status === "refunded");
      const missed = await missedDeadlines(db, r.userId);
      const onTime = answered.filter((q) => {
        const h = responseHours(q);
        return h !== null && h <= q.answerHours;
      }).length;
      const ratings = qs.map((q) => q.rating).filter((x): x is number => !!x);
      return {
        ...r,
        answered: answered.length,
        missed,
        onTimePercent: answered.length + missed ? Math.round((onTime / (answered.length + missed)) * 100) : null,
        averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
        earnedCents: qs.map(netSplit).reduce((a, m) => a + m.responder, 0),
        state: r.pausedAt ? "paused" : !r.payoutsReady ? "onboarding" : r.accepting ? "active" : "away",
      } as const;
    }),
  );
}

/** Pause (admin decision) or resume. Resuming also clears any missed-deadline warning. */
export async function setResponderPaused(
  db: Db,
  actor: Actor,
  input: { userId: string; paused: boolean },
): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  const rows = await db
    .update(responderProfile)
    .set(
      input.paused
        ? { pausedAt: new Date(), pauseReason: "admin" }
        : { pausedAt: null, pauseReason: null, overdueWarnedAt: null },
    )
    .where(eq(responderProfile.userId, input.userId))
    .returning({ userId: responderProfile.userId });
  if (!rows.length) return fail("not-found");
  await audit(db, actor.userId, input.paused ? "responder.paused" : "responder.resumed", "user", input.userId);
  return { ok: true };
}

/* ----------------------- Responder applications ------------------------- */

export async function applyAsResponder(
  db: Db,
  actor: Actor,
  input: { experience: string; topics: string[]; guidelinesAccepted: boolean },
): Promise<{ ok: true } | Fail> {
  const p = actor.profile;
  if (!canEnterMemberArea(p) || p.role !== "member") return fail("not-eligible");
  if (p.trustLevel < 1) return fail("not-eligible");
  const experience = input.experience.trim();
  if (experience.length < 30 || experience.length > 1000 || !input.guidelinesAccepted) return fail("invalid-input");
  const topics = [...new Set(input.topics)].filter((t) => (qaConfig.topics as readonly string[]).includes(t));
  try {
    await db.insert(responderApplication).values({
      id: randomUUID(),
      userId: actor.userId,
      experience,
      topics,
      guidelinesAcceptedAt: new Date(),
    });
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === "23505" || (e as { code?: string }).code === "23505") {
      return fail("already-pending");
    }
    throw e;
  }
  return { ok: true };
}

export async function getMyResponderApplication(db: Db, userId: string) {
  const [row] = await db
    .select({ status: responderApplication.status, createdAt: responderApplication.createdAt })
    .from(responderApplication)
    .where(eq(responderApplication.userId, userId))
    .orderBy(desc(responderApplication.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listResponderApplications(db: Db, actor: Actor) {
  if (!isAdmin(actor)) return [];
  return db
    .select({
      id: responderApplication.id,
      userId: responderApplication.userId,
      handle: profile.handle,
      trustLevel: profile.trustLevel,
      memberSince: profile.approvedAt,
      experience: responderApplication.experience,
      topics: responderApplication.topics,
      createdAt: responderApplication.createdAt,
    })
    .from(responderApplication)
    .innerJoin(profile, eq(profile.userId, responderApplication.userId))
    .where(eq(responderApplication.status, "pending"))
    .orderBy(responderApplication.createdAt);
}

/** Approve (makes them a responder — they must still set up 2FA and payouts) or decline. Text is wiped. */
export async function decideResponderApplication(
  db: Db,
  actor: Actor,
  input: { id: string; approve: boolean },
): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  const [app] = await db
    .update(responderApplication)
    .set({
      status: input.approve ? "approved" : "declined",
      reviewerId: actor.userId,
      decidedAt: new Date(),
      experience: null,
    })
    .where(and(eq(responderApplication.id, input.id), eq(responderApplication.status, "pending")))
    .returning({ userId: responderApplication.userId });
  if (!app) return fail("not-found");
  if (input.approve) {
    const res = await setResponderRole(db, actor, { userId: app.userId, responder: true });
    if (!res.ok) return fail("not-eligible");
  }
  await audit(
    db,
    actor.userId,
    input.approve ? "responder.application-approved" : "responder.application-declined",
    "user",
    app.userId,
  );
  return { ok: true };
}

/* -------------------------------- Finance -------------------------------- */

export async function getFinance(db: Db, actor: Actor, days = 30) {
  if (!isAdmin(actor)) return null;
  const qs = await listQuestionMeta(db, { sinceDays: days, limit: 10000 });
  const totals = { charged: 0, refunded: 0, platform: 0, responders: 0 };
  const byResponder = new Map<
    string,
    { handle: string | null; answered: number; charged: number; refunded: number; responder: number; platform: number }
  >();
  for (const q of qs) {
    const m = netSplit(q);
    if (!m.charged) continue;
    totals.charged += m.charged;
    totals.refunded += m.refunded;
    totals.platform += m.fee;
    totals.responders += m.responder;
    const key = q.responderId ?? "—";
    const row = byResponder.get(key) ?? {
      handle: q.responderHandle,
      answered: 0,
      charged: 0,
      refunded: 0,
      responder: 0,
      platform: 0,
    };
    row.answered += 1;
    row.charged += m.charged;
    row.refunded += m.refunded;
    row.responder += m.responder;
    row.platform += m.fee;
    byResponder.set(key, row);
  }
  return { days, totals, byResponder: [...byResponder.values()].sort((a, b) => b.charged - a.charged) };
}

/* -------------------------------- Settings ------------------------------- */

export type SettingsInput = Omit<QaSettings, "id" | "updatedAt" | "updatedBy">;

export async function updateQaSettings(db: Db, actor: Actor, input: SettingsInput): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  const v = Object.fromEntries(Object.entries(input).map(([k, x]) => [k, Math.round(Number(x))])) as SettingsInput;
  const valid =
    v.feePercent >= 0 &&
    v.feePercent <= 50 &&
    v.answerHours >= 12 &&
    v.answerHours <= 168 &&
    v.priceMinCents >= 100 &&
    v.priceMaxCents >= v.priceMinCents &&
    v.priceMaxCents <= 100_000 &&
    v.maxOpenPerAsker >= 1 &&
    v.maxOpenPerAsker <= 10 &&
    v.overdueWarnAt >= 1 &&
    v.overduePauseAt >= v.overdueWarnAt &&
    v.overduePauseAt <= 20;
  if (!valid) return fail("invalid-input");
  const before = await getQaSettings(db);
  await db
    .insert(qaSettings)
    .values({ id: 1, ...v, updatedAt: new Date(), updatedBy: actor.userId })
    .onConflictDoUpdate({ target: qaSettings.id, set: { ...v, updatedAt: new Date(), updatedBy: actor.userId } });
  const changed = Object.fromEntries(
    (Object.keys(v) as (keyof SettingsInput)[])
      .filter((k) => before[k] !== v[k])
      .map((k) => [k, { from: before[k], to: v[k] }]),
  );
  await audit(db, actor.userId, "qa.settings-updated", "settings", "qa", changed);
  return { ok: true };
}

/* ------------------------------- Audit log ------------------------------- */

export async function listAuditLog(db: Db, actor: Actor, limit = 100) {
  if (!isAdmin(actor)) return [];
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      targetType: auditLog.targetType,
      targetId: auditLog.targetId,
      meta: auditLog.meta,
      createdAt: auditLog.createdAt,
      actorHandle: profile.handle,
    })
    .from(auditLog)
    .leftJoin(profile, eq(profile.userId, auditLog.actorId))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}
