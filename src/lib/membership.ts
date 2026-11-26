import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { application, auditLog, invite, profile, type ApplicationAnswers } from "@/db/schema";
import { ANSWER_MAX, ANSWER_MIN, APPLICATION_QUESTIONS } from "./application-questions";
import { generateInviteCode, normalizeInviteCode } from "./invite-code";
import { can } from "./permissions";

/**
 * Membership state transitions. Every function takes `db` so it can run
 * against a test database; server actions are thin wrappers around these.
 */

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

export function normalizeHandle(input: string): string | null {
  const h = input.trim().toLowerCase();
  return HANDLE_RE.test(h) ? h : null;
}

export async function ensureProfile(db: Db, userId: string) {
  await db.insert(profile).values({ userId }).onConflictDoNothing();
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  return row;
}

type JoinBase = { userId: string; handle: string; ageConfirmed: boolean };

export type JoinError =
  | "age-not-confirmed"
  | "invalid-handle"
  | "handle-taken"
  | "invalid-invite"
  | "invalid-answers"
  | "not-allowed";

export type JoinResult = { ok: true } | { ok: false; error: JoinError };

/** Statuses from which a user may (re)start joining. */
const CAN_START_JOIN = ["new", "rejected", "pending"] as const;

function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as { code?: string; constraint_name?: string; cause?: unknown };
  if (err?.code === "23505") return !constraint || err.constraint_name === constraint;
  return err?.cause ? isUniqueViolation(err.cause, constraint) : false;
}

export async function redeemInvite(db: Db, input: JoinBase & { code: string }): Promise<JoinResult> {
  if (!input.ageConfirmed) return { ok: false, error: "age-not-confirmed" };
  const handle = normalizeHandle(input.handle);
  if (!handle) return { ok: false, error: "invalid-handle" };
  const code = normalizeInviteCode(input.code);
  if (!code) return { ok: false, error: "invalid-invite" };

  try {
    return await db.transaction(async (tx) => {
      const [me] = await tx
        .select({ status: profile.status })
        .from(profile)
        .where(eq(profile.userId, input.userId))
        .for("update");
      if (!me || !(CAN_START_JOIN as readonly string[]).includes(me.status)) {
        return { ok: false, error: "not-allowed" } as const;
      }

      // Atomically consume one use; concurrent redemptions cannot overshoot.
      const now = new Date();
      const [used] = await tx
        .update(invite)
        .set({ uses: sql`${invite.uses} + 1` })
        .where(
          and(
            eq(invite.code, code),
            isNull(invite.revokedAt),
            gt(invite.expiresAt, now),
            lt(invite.uses, invite.maxUses),
            sql`${invite.inviterId} <> ${input.userId}`,
            // Inviter must still be an approved member in good standing.
            sql`exists (select 1 from ${profile} p where p.user_id = ${invite.inviterId} and p.status = 'approved')`,
          ),
        )
        .returning({ inviterId: invite.inviterId });
      // Nothing has been written yet, so returning leaves no partial state.
      if (!used) return { ok: false, error: "invalid-invite" } as const;

      await tx
        .update(application)
        .set({ status: "withdrawn", answers: null, decidedAt: now })
        .where(and(eq(application.userId, input.userId), eq(application.status, "pending")));

      await tx
        .update(profile)
        .set({
          status: "approved",
          approvedAt: now,
          invitedBy: used.inviterId,
          handle,
          ageConfirmedAt: now,
        })
        .where(eq(profile.userId, input.userId));

      await tx.insert(auditLog).values({
        id: randomUUID(),
        actorId: input.userId,
        action: "invite.redeemed",
        targetType: "invite",
        targetId: code,
      });
      return { ok: true } as const;
    });
  } catch (e) {
    if (isUniqueViolation(e, "profile_handle_unique")) return { ok: false, error: "handle-taken" };
    throw e;
  }
}

export async function submitApplication(
  db: Db,
  input: JoinBase & { answers: Record<string, string> },
): Promise<JoinResult> {
  if (!input.ageConfirmed) return { ok: false, error: "age-not-confirmed" };
  const handle = normalizeHandle(input.handle);
  if (!handle) return { ok: false, error: "invalid-handle" };

  const answers: ApplicationAnswers = [];
  for (const questionId of APPLICATION_QUESTIONS) {
    const answer = (input.answers[questionId] ?? "").trim();
    if (answer.length < ANSWER_MIN || answer.length > ANSWER_MAX) {
      return { ok: false, error: "invalid-answers" };
    }
    answers.push({ questionId, answer });
  }

  try {
    return await db.transaction(async (tx) => {
      const [me] = await tx
        .select({ status: profile.status })
        .from(profile)
        .where(eq(profile.userId, input.userId))
        .for("update");
      if (!me || !["new", "rejected"].includes(me.status)) {
        return { ok: false, error: "not-allowed" } as const;
      }
      await tx.insert(application).values({ id: randomUUID(), userId: input.userId, answers });
      await tx
        .update(profile)
        .set({ status: "pending", handle, ageConfirmedAt: new Date() })
        .where(eq(profile.userId, input.userId));
      return { ok: true } as const;
    });
  } catch (e) {
    if (isUniqueViolation(e, "profile_handle_unique")) return { ok: false, error: "handle-taken" };
    if (isUniqueViolation(e, "application_one_pending_per_user")) return { ok: false, error: "not-allowed" };
    throw e;
  }
}

export type Decision = "approved" | "rejected";

export type DecideResult =
  | { ok: true; evidenceKeyToDelete: string | null }
  | { ok: false; error: "not-found" | "self-review" };

/**
 * Approve or reject an application. Answers and the evidence reference are
 * wiped in the same transaction; the caller must delete the stored evidence
 * object returned in `evidenceKeyToDelete`.
 */
export async function decideApplication(
  db: Db,
  input: { applicationId: string; reviewerId: string; decision: Decision },
): Promise<DecideResult> {
  return db.transaction(async (tx) => {
    const [app] = await tx
      .select()
      .from(application)
      .where(and(eq(application.id, input.applicationId), eq(application.status, "pending")))
      .for("update");
    if (!app) return { ok: false, error: "not-found" } as const;
    if (app.userId === input.reviewerId) return { ok: false, error: "self-review" } as const;

    const now = new Date();
    await tx
      .update(application)
      .set({
        status: input.decision,
        reviewerId: input.reviewerId,
        decidedAt: now,
        answers: null,
        evidenceKey: null,
        evidenceExpiresAt: null,
      })
      .where(eq(application.id, app.id));

    await tx
      .update(profile)
      .set(input.decision === "approved" ? { status: "approved", approvedAt: now } : { status: "rejected" })
      .where(and(eq(profile.userId, app.userId), eq(profile.status, "pending")));

    await tx.insert(auditLog).values({
      id: randomUUID(),
      actorId: input.reviewerId,
      action: `application.${input.decision}`,
      targetType: "application",
      targetId: app.id,
    });
    return { ok: true, evidenceKeyToDelete: app.evidenceKey } as const;
  });
}

export type CreateInviteResult = { ok: true; code: string } | { ok: false; error: "not-allowed" };

export async function createInvite(
  db: Db,
  input: { inviterId: string; maxUses?: number; ttlDays?: number },
): Promise<CreateInviteResult> {
  const [me] = await db.select().from(profile).where(eq(profile.userId, input.inviterId));
  if (!me || !can(me, "createInvite")) return { ok: false, error: "not-allowed" };

  const maxUses = Math.min(Math.max(input.maxUses ?? 1, 1), me.role === "admin" ? 100 : 3);
  const ttlDays = Math.min(Math.max(input.ttlDays ?? 7, 1), 30);
  const code = generateInviteCode();
  await db.insert(invite).values({
    code,
    inviterId: input.inviterId,
    maxUses,
    expiresAt: new Date(Date.now() + ttlDays * 86_400_000),
  });
  return { ok: true, code };
}

/** Pending applications, oldest first (for the admin review queue). */
export async function listPendingApplications(db: Db, limit = 50) {
  return db
    .select({
      id: application.id,
      answers: application.answers,
      createdAt: application.createdAt,
      handle: profile.handle,
    })
    .from(application)
    .innerJoin(profile, eq(profile.userId, application.userId))
    .where(inArray(application.status, ["pending"]))
    .orderBy(application.createdAt)
    .limit(limit);
}
