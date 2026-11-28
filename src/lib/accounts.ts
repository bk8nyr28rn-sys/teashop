import { randomUUID } from "node:crypto";
import { and, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { hasLocale, type Locale } from "@/i18n/config";
import { auditLog, comment, post, profile, question, session, user, verification } from "@/db/schema";
import { canEnterMemberArea, type Viewer } from "./permissions";
import { releasePendingQuestionsFor } from "./qa";

/**
 * Account-level safety actions: platform suspension, self-service deletion,
 * and signing out other devices.
 */

export type Actor = { userId: string; profile: Viewer };
export type AccountError = "forbidden" | "not-found" | "cannot-target-admin" | "cannot-target-self";
type Fail = { ok: false; error: AccountError };
const fail = (error: AccountError): Fail => ({ ok: false, error });

const isAdmin = (a: Actor) => canEnterMemberArea(a.profile) && a.profile.role === "admin";

/* ------------------------------ Suspension ------------------------------ */

/**
 * Suspend a member: blocks every member area and revokes all their sessions
 * immediately. Admins cannot be suspended here (demote via CLI first).
 */
export async function suspendUser(
  db: Db,
  actor: Actor,
  input: { userId: string; reason?: string },
): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  if (input.userId === actor.userId) return fail("cannot-target-self");
  const [target] = await db.select().from(profile).where(eq(profile.userId, input.userId));
  if (!target) return fail("not-found");
  if (target.role === "admin") return fail("cannot-target-admin");

  await db.transaction(async (tx) => {
    await tx
      .update(profile)
      .set({ status: "suspended", suspendedAt: new Date() })
      .where(and(eq(profile.userId, input.userId), ne(profile.status, "suspended")));
    await tx.delete(session).where(eq(session.userId, input.userId));
    await tx.insert(auditLog).values({
      id: randomUUID(),
      actorId: actor.userId,
      action: "user.suspended",
      targetType: "user",
      targetId: input.userId,
      meta: input.reason?.trim() ? { reason: input.reason.trim().slice(0, 500) } : null,
    });
  });
  // Pending paid questions involving them expire at the next sweep (holds released).
  await releasePendingQuestionsFor(db, input.userId);
  return { ok: true };
}

/** Admin: appoint or remove a responder. Admin roles are only changed via the CLI. */
export async function setResponderRole(
  db: Db,
  actor: Actor,
  input: { userId: string; responder: boolean },
): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  const [target] = await db.select().from(profile).where(eq(profile.userId, input.userId));
  if (!target || target.status !== "approved") return fail("not-found");
  if (target.role === "admin") return fail("cannot-target-admin");
  await db
    .update(profile)
    .set({ role: input.responder ? "responder" : "member" })
    .where(eq(profile.userId, input.userId));
  if (!input.responder) await releasePendingQuestionsFor(db, input.userId);
  await db.insert(auditLog).values({
    id: randomUUID(),
    actorId: actor.userId,
    action: input.responder ? "user.responder.added" : "user.responder.removed",
    targetType: "user",
    targetId: input.userId,
  });
  return { ok: true };
}

/** Lift a suspension, returning the user to where they were before membership-wise. */
export async function unsuspendUser(db: Db, actor: Actor, userId: string): Promise<{ ok: true } | Fail> {
  if (!isAdmin(actor)) return fail("forbidden");
  const rows = await db
    .update(profile)
    .set({
      status: sql`case when ${profile.approvedAt} is not null then 'approved' else 'new' end::membership_status`,
      suspendedAt: null,
    })
    .where(and(eq(profile.userId, userId), eq(profile.status, "suspended")))
    .returning({ userId: profile.userId });
  if (!rows.length) return fail("not-found");
  await db.insert(auditLog).values({
    id: randomUUID(),
    actorId: actor.userId,
    action: "user.unsuspended",
    targetType: "user",
    targetId: userId,
  });
  return { ok: true };
}

/** Admin lookup by nickname prefix. Never searches by email. */
export async function findMembers(db: Db, query: string, limit = 20) {
  const q = query.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{1,20}$/.test(q)) return [];
  return db
    .select({
      userId: profile.userId,
      handle: profile.handle,
      role: profile.role,
      status: profile.status,
      trustLevel: profile.trustLevel,
    })
    .from(profile)
    .where(ilike(profile.handle, `${q}%`))
    .orderBy(profile.handle)
    .limit(limit);
}

export async function listSuspended(db: Db, limit = 50) {
  return db
    .select({ userId: profile.userId, handle: profile.handle, suspendedAt: profile.suspendedAt })
    .from(profile)
    .where(eq(profile.status, "suspended"))
    .orderBy(profile.suspendedAt)
    .limit(limit);
}

/* ------------------------------- Sessions ------------------------------- */

/** "Sign out everywhere else" — e.g. after a phone was lost or seen by someone. */
export async function signOutOtherSessions(db: Db, userId: string, keepSessionId: string): Promise<number> {
  const rows = await db
    .delete(session)
    .where(and(eq(session.userId, userId), ne(session.id, keepSessionId)))
    .returning({ id: session.id });
  return rows.length;
}

/* ------------------------------- Deletion ------------------------------- */

const OTP_TYPES = ["sign-in", "email-verification", "forget-password", "change-email"] as const;

/**
 * Permanently delete an account.
 *
 * - Text of every post and comment they wrote is erased first; the rows stay
 *   as "deleted by the author" tombstones with no author, so other people's
 *   replies in those threads survive.
 * - Everything else tied to the user (profile, sessions, memberships,
 *   invites, applications, reports about them, 2FA) goes via FK cascades.
 * - Pending sign-in codes for their email are removed.
 */
export async function deleteAccount(db: Db, userId: string): Promise<{ ok: true } | Fail> {
  const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
  if (!u) return fail("not-found");

  await db.transaction(async (tx) => {
    await tx
      .update(post)
      .set({ title: "", body: "", removedAt: sql`coalesce(${post.removedAt}, now())`, removal: "author" })
      .where(eq(post.authorId, userId));
    await tx
      .update(comment)
      .set({ body: "", removedAt: sql`coalesce(${comment.removedAt}, now())`, removal: "author" })
      .where(eq(comment.authorId, userId));
    // Paid questions they asked: erase the texts, keep amounts for accounting.
    await tx
      .update(question)
      .set({ title: "", body: "", answer: null, feedback: null, disputeReason: null })
      .where(eq(question.askerId, userId));
    await tx
      .update(question)
      .set({ deadlineAt: sql`now()` })
      .where(
        and(eq(question.status, "open"), sql`(${question.askerId} = ${userId} or ${question.responderId} = ${userId})`),
      );
    await tx.delete(verification).where(
      inArray(
        verification.identifier,
        OTP_TYPES.map((t) => `${t}-otp-${u.email}`),
      ),
    );
    await tx.delete(user).where(eq(user.id, userId));
    // Opaque id only — no personal data is kept about a deleted account.
    await tx.insert(auditLog).values({
      id: randomUUID(),
      actorId: null,
      action: "account.deleted",
      targetType: "user",
      targetId: userId,
    });
  });
  return { ok: true };
}

/* ------------------------------- Language ------------------------------- */

/** Remembers the user's UI language on their account (used for emails and new devices). */
export async function setPreferredLocale(db: Db, userId: string, locale: Locale): Promise<void> {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  await db.update(profile).set({ locale }).where(eq(profile.userId, userId));
}
