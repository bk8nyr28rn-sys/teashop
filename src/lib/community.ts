import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  auditLog,
  circle,
  circleMember,
  comment,
  post,
  profile,
  report,
  type Circle,
  type CircleMember,
  type ReportReason,
  type ReportTarget,
} from "@/db/schema";
import { LIMITS } from "./community-limits";
import {
  can,
  canEnterMemberArea,
  canModerateCircle,
  circleJoinOutcome,
  dailyLimit,
  earnedTrustLevel,
  type CircleJoinOutcome,
  type Viewer,
} from "./permissions";

/**
 * Community domain logic: circles, posts, comments, reports. Every mutation
 * re-checks permissions here, so callers (server actions) stay thin.
 */

export type Actor = { userId: string; profile: Viewer };

export { LIMITS };

export type CommunityError =
  | "not-found"
  | "forbidden"
  | "must-join"
  | "trust-too-low"
  | "rate-limited"
  | "invalid-input"
  | "already-reported"
  | "own-content";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: CommunityError };
const fail = (error: CommunityError) => ({ ok: false, error }) as const;

const DAY_MS = 86_400_000;

/* ------------------------------- Access --------------------------------- */

export type CircleAccess = {
  membership: Pick<CircleMember, "role" | "status"> | null;
  canRead: boolean;
  canWrite: boolean;
  isModerator: boolean;
  joinOutcome: CircleJoinOutcome;
};

export function accessFor(
  actor: Actor,
  c: Pick<Circle, "visibility" | "minTrustLevel">,
  m: CircleAccess["membership"],
): CircleAccess {
  const p = actor.profile;
  const approved = canEnterMemberArea(p);
  const isAdmin = approved && p.role === "admin";
  const active = m?.status === "active";
  return {
    membership: m,
    // Private circles stay private: only joined members (and admins) can read them.
    canRead: isAdmin || (approved && (active || c.visibility === "open")),
    canWrite: isAdmin || (approved && active),
    isModerator: canModerateCircle(p, m),
    joinOutcome: circleJoinOutcome(p, c, m),
  };
}

async function membershipOf(db: Db, circleId: string, userId: string) {
  const [m] = await db
    .select({ role: circleMember.role, status: circleMember.status })
    .from(circleMember)
    .where(and(eq(circleMember.circleId, circleId), eq(circleMember.userId, userId)));
  return m ?? null;
}

export async function loadCircle(db: Db, actor: Actor, by: { slug: string } | { id: string }) {
  const [c] = await db
    .select()
    .from(circle)
    .where("slug" in by ? eq(circle.slug, by.slug) : eq(circle.id, by.id));
  if (!c) return null;
  return { circle: c, access: accessFor(actor, c, await membershipOf(db, c.id, actor.userId)) };
}

/* ------------------------------ Membership ------------------------------ */

export async function joinCircle(
  db: Db,
  actor: Actor,
  circleId: string,
): Promise<Result<{ status: "joined" | "requested" }>> {
  const loaded = await loadCircle(db, actor, { id: circleId });
  if (!loaded) return fail("not-found");
  const outcome = loaded.access.joinOutcome;
  if (outcome !== "join" && outcome !== "request") {
    return fail(outcome === "trust-too-low" ? "trust-too-low" : "forbidden");
  }
  const status = outcome === "join" ? "active" : "pending";
  await db.insert(circleMember).values({ circleId, userId: actor.userId, status }).onConflictDoNothing();
  return { ok: true, status: status === "active" ? "joined" : "requested" };
}

/** Leave or cancel a request. Bans stick (a banned member can't "leave" to reset). */
export async function leaveCircle(db: Db, actor: Actor, circleId: string): Promise<Result> {
  await db
    .delete(circleMember)
    .where(
      and(
        eq(circleMember.circleId, circleId),
        eq(circleMember.userId, actor.userId),
        ne(circleMember.status, "banned"),
      ),
    );
  return { ok: true };
}

async function requireModerator(db: Db, actor: Actor, circleId: string) {
  return canModerateCircle(actor.profile, await membershipOf(db, circleId, actor.userId));
}

export async function decideJoinRequest(
  db: Db,
  actor: Actor,
  input: { circleId: string; userId: string; approve: boolean },
): Promise<Result> {
  if (!(await requireModerator(db, actor, input.circleId))) return fail("forbidden");
  const where = and(
    eq(circleMember.circleId, input.circleId),
    eq(circleMember.userId, input.userId),
    eq(circleMember.status, "pending"),
  );
  const rows = input.approve
    ? await db.update(circleMember).set({ status: "active" }).where(where).returning()
    : await db.delete(circleMember).where(where).returning();
  if (rows.length === 0) return fail("not-found");
  await audit(db, actor.userId, `circle.request.${input.approve ? "approved" : "declined"}`, "circle", input.circleId, {
    userId: input.userId,
  });
  return { ok: true };
}

/** Admin-only: appoint or remove a circle moderator (must be an active member). */
export async function setModerator(
  db: Db,
  actor: Actor,
  input: { circleId: string; userId: string; moderator: boolean },
): Promise<Result> {
  if (!canEnterMemberArea(actor.profile) || actor.profile.role !== "admin") return fail("forbidden");
  const rows = await db
    .update(circleMember)
    .set({ role: input.moderator ? "moderator" : "member" })
    .where(
      and(
        eq(circleMember.circleId, input.circleId),
        eq(circleMember.userId, input.userId),
        eq(circleMember.status, "active"),
      ),
    )
    .returning();
  if (rows.length === 0) return fail("not-found");
  await audit(
    db,
    actor.userId,
    input.moderator ? "circle.moderator.added" : "circle.moderator.removed",
    "circle",
    input.circleId,
    {
      userId: input.userId,
    },
  );
  return { ok: true };
}

/* ------------------------------- Content -------------------------------- */

function clean(text: unknown, max: number): string | null {
  const t = String(text ?? "").trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

/** Serialises a user's writes so concurrent requests can't slip past the daily limit. */
async function lockUser(tx: Parameters<Parameters<Db["transaction"]>[0]>[0], userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
}

export async function createPost(
  db: Db,
  actor: Actor,
  input: { circleId: string; title: string; body: string },
): Promise<Result<{ id: string }>> {
  const title = clean(input.title, LIMITS.titleMax);
  const body = clean(input.body, LIMITS.postBodyMax);
  if (!title || !body) return fail("invalid-input");
  const loaded = await loadCircle(db, actor, { id: input.circleId });
  if (!loaded) return fail("not-found");
  if (!loaded.access.canWrite) return fail("must-join");
  if (!can(actor.profile, "post")) return fail("trust-too-low");

  return db.transaction(async (tx) => {
    await lockUser(tx, actor.userId);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(post)
      .where(and(eq(post.authorId, actor.userId), gt(post.createdAt, new Date(Date.now() - DAY_MS))));
    if (n >= dailyLimit(actor.profile, "post")) return fail("rate-limited");
    const id = randomUUID();
    await tx.insert(post).values({ id, circleId: input.circleId, authorId: actor.userId, title, body });
    return { ok: true, id } as const;
  });
}

/** Loads a post plus the actor's access to its circle. Removed posts are invisible except to moderators. */
export async function loadPost(db: Db, actor: Actor, postId: string) {
  const [row] = await db
    .select({ post, authorHandle: profile.handle })
    .from(post)
    .innerJoin(profile, eq(profile.userId, post.authorId))
    .where(eq(post.id, postId));
  if (!row) return null;
  const p = row.post;
  const loaded = await loadCircle(db, actor, { id: p.circleId });
  if (!loaded || !loaded.access.canRead) return null;
  if (p.removedAt && !loaded.access.isModerator) return null;
  return { post: p, authorHandle: row.authorHandle, ...loaded };
}

export async function createComment(
  db: Db,
  actor: Actor,
  input: { postId: string; body: string },
): Promise<Result<{ id: string }>> {
  const body = clean(input.body, LIMITS.commentMax);
  if (!body) return fail("invalid-input");
  const loaded = await loadPost(db, actor, input.postId);
  if (!loaded || loaded.post.removedAt) return fail("not-found");
  if (!loaded.access.canWrite) return fail("must-join");
  if (!can(actor.profile, "comment")) return fail("forbidden");

  return db.transaction(async (tx) => {
    await lockUser(tx, actor.userId);
    const [{ n }] = await tx
      .select({ n: count() })
      .from(comment)
      .where(and(eq(comment.authorId, actor.userId), gt(comment.createdAt, new Date(Date.now() - DAY_MS))));
    if (n >= dailyLimit(actor.profile, "comment")) return fail("rate-limited");
    const id = randomUUID();
    await tx.insert(comment).values({ id, postId: input.postId, authorId: actor.userId, body });
    return { ok: true, id } as const;
  });
}

/** Author deletion erases the text for good (privacy), keeping a tombstone for thread order. */
export async function deleteOwn(db: Db, actor: Actor, target: ReportTarget, id: string): Promise<Result> {
  const now = new Date();
  const rows =
    target === "post"
      ? await db
          .update(post)
          .set({ title: "", body: "", removedAt: now, removedBy: actor.userId, removal: "author" })
          .where(and(eq(post.id, id), eq(post.authorId, actor.userId), isNull(post.removedAt)))
          .returning({ id: post.id })
      : await db
          .update(comment)
          .set({ body: "", removedAt: now, removedBy: actor.userId, removal: "author" })
          .where(and(eq(comment.id, id), eq(comment.authorId, actor.userId), isNull(comment.removedAt)))
          .returning({ id: comment.id });
  return rows.length ? { ok: true } : fail("not-found");
}

/** Where a post/comment lives and who wrote it. */
async function locate(db: Db, target: ReportTarget, id: string) {
  if (target === "post") {
    const [r] = await db
      .select({ circleId: post.circleId, authorId: post.authorId, removedAt: post.removedAt })
      .from(post)
      .where(eq(post.id, id));
    return r ?? null;
  }
  const [r] = await db
    .select({ circleId: post.circleId, authorId: comment.authorId, removedAt: comment.removedAt })
    .from(comment)
    .innerJoin(post, eq(post.id, comment.postId))
    .where(eq(comment.id, id));
  return r ?? null;
}

export async function moderatorRemove(db: Db, actor: Actor, target: ReportTarget, id: string): Promise<Result> {
  const where = await locate(db, target, id);
  if (!where) return fail("not-found");
  if (!(await requireModerator(db, actor, where.circleId))) return fail("forbidden");
  const set = { removedAt: new Date(), removedBy: actor.userId, removal: "moderator" as const };
  if (target === "post")
    await db
      .update(post)
      .set(set)
      .where(and(eq(post.id, id), isNull(post.removedAt)));
  else
    await db
      .update(comment)
      .set(set)
      .where(and(eq(comment.id, id), isNull(comment.removedAt)));
  await audit(db, actor.userId, `${target}.removed`, target, id);
  return { ok: true };
}

/* ------------------------------- Reports -------------------------------- */

export const REPORT_REASONS: ReportReason[] = ["harassment", "hate", "outing", "sexual", "spam", "self_harm", "other"];

export async function createReport(
  db: Db,
  actor: Actor,
  input: { targetType: ReportTarget; targetId: string; reason: string; details?: string },
): Promise<Result> {
  if (!REPORT_REASONS.includes(input.reason as ReportReason)) return fail("invalid-input");
  const details = (input.details ?? "").trim();
  if (details.length > LIMITS.reportDetailsMax) return fail("invalid-input");
  const where = await locate(db, input.targetType, input.targetId);
  if (!where || where.removedAt) return fail("not-found");
  if (where.authorId === actor.userId) return fail("own-content");
  const loaded = await loadCircle(db, actor, { id: where.circleId });
  if (!loaded?.access.canRead) return fail("not-found");

  const inserted = await db
    .insert(report)
    .values({
      id: randomUUID(),
      reporterId: actor.userId,
      targetType: input.targetType,
      targetId: input.targetId,
      circleId: where.circleId,
      authorId: where.authorId,
      reason: input.reason as ReportReason,
      details: details || null,
    })
    .onConflictDoNothing()
    .returning({ id: report.id });
  return inserted.length ? { ok: true } : fail("already-reported");
}

/**
 * Uphold (content removed, counts against the author's trust) or dismiss.
 * All open reports on the same target are resolved together.
 */
export async function resolveReport(
  db: Db,
  actor: Actor,
  input: { reportId: string; decision: "upheld" | "dismissed" },
): Promise<Result> {
  const [r] = await db.select().from(report).where(eq(report.id, input.reportId));
  if (!r || r.status !== "open") return fail("not-found");
  if (!(await requireModerator(db, actor, r.circleId))) return fail("forbidden");
  if (r.authorId === actor.userId) return fail("own-content");

  if (input.decision === "upheld") {
    const removed = await moderatorRemove(db, actor, r.targetType, r.targetId);
    if (!removed.ok) return removed;
  }
  await db
    .update(report)
    .set({ status: input.decision, handledBy: actor.userId, handledAt: new Date() })
    .where(and(eq(report.targetType, r.targetType), eq(report.targetId, r.targetId), eq(report.status, "open")));
  await audit(db, actor.userId, `report.${input.decision}`, r.targetType, r.targetId);
  return { ok: true };
}

/* -------------------------------- Trust --------------------------------- */

/** Re-evaluate and persist the member's trust level. Cheap: two indexed counts. */
export async function refreshTrust(db: Db, userId: string): Promise<number | null> {
  const [p] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!p || p.status !== "approved" || !p.approvedAt || p.trustLevel >= 3) return p?.trustLevel ?? null;

  const [[posts], [comments], [reports]] = await Promise.all([
    db
      .select({ n: count() })
      .from(post)
      .where(and(eq(post.authorId, userId), sql`${post.removal} is distinct from 'moderator'`)),
    db
      .select({ n: count() })
      .from(comment)
      .where(and(eq(comment.authorId, userId), sql`${comment.removal} is distinct from 'moderator'`)),
    db
      .select({ n: count() })
      .from(report)
      .where(and(eq(report.authorId, userId), eq(report.status, "upheld"))),
  ]);
  const level = earnedTrustLevel(p.trustLevel, {
    daysSinceApproval: (Date.now() - p.approvedAt.getTime()) / DAY_MS,
    contributions: posts.n + comments.n,
    upheldReports: reports.n,
  });
  if (level !== p.trustLevel) {
    await db.update(profile).set({ trustLevel: level }).where(eq(profile.userId, userId));
  }
  return level;
}

/* ------------------------------- Queries -------------------------------- */

const commentCount = sql<number>`(select count(*)::int from ${comment} c where c.post_id = ${post.id} and c.removed_at is null)`;

const postSummary = {
  id: post.id,
  title: post.title,
  createdAt: post.createdAt,
  authorHandle: profile.handle,
  comments: commentCount,
};

export async function listCirclePosts(db: Db, circleId: string, limit = 50) {
  return db
    .select(postSummary)
    .from(post)
    .innerJoin(profile, eq(profile.userId, post.authorId))
    .where(and(eq(post.circleId, circleId), isNull(post.removedAt)))
    .orderBy(desc(post.createdAt))
    .limit(limit);
}

/** Latest posts from circles the user actively belongs to — the "precise" feed. */
export async function listFeed(db: Db, userId: string, limit = 30) {
  return db
    .select({ ...postSummary, circleSlug: circle.slug, circleName: circle.name })
    .from(post)
    .innerJoin(profile, eq(profile.userId, post.authorId))
    .innerJoin(circle, eq(circle.id, post.circleId))
    .innerJoin(
      circleMember,
      and(eq(circleMember.circleId, post.circleId), eq(circleMember.userId, userId), eq(circleMember.status, "active")),
    )
    .where(isNull(post.removedAt))
    .orderBy(desc(post.createdAt))
    .limit(limit);
}

export async function listComments(db: Db, postId: string, includeRemoved: boolean) {
  return db
    .select({
      id: comment.id,
      body: comment.body,
      createdAt: comment.createdAt,
      authorId: comment.authorId,
      authorHandle: profile.handle,
      removedAt: comment.removedAt,
      removal: comment.removal,
    })
    .from(comment)
    .innerJoin(profile, eq(profile.userId, comment.authorId))
    .where(and(eq(comment.postId, postId), includeRemoved ? undefined : isNull(comment.removedAt)))
    .orderBy(comment.createdAt)
    .limit(500);
}

export async function listPendingRequests(db: Db, circleId: string) {
  return db
    .select({
      userId: circleMember.userId,
      handle: profile.handle,
      trustLevel: profile.trustLevel,
      createdAt: circleMember.createdAt,
    })
    .from(circleMember)
    .innerJoin(profile, eq(profile.userId, circleMember.userId))
    .where(and(eq(circleMember.circleId, circleId), eq(circleMember.status, "pending")))
    .orderBy(circleMember.createdAt);
}

export async function listMembers(db: Db, circleId: string) {
  return db
    .select({ userId: circleMember.userId, handle: profile.handle, role: circleMember.role })
    .from(circleMember)
    .innerJoin(profile, eq(profile.userId, circleMember.userId))
    .where(and(eq(circleMember.circleId, circleId), eq(circleMember.status, "active")))
    .orderBy(desc(circleMember.role), profile.handle)
    .limit(200);
}

/** Open reports, grouped per target, with a snapshot of the reported text. */
export async function listOpenReports(db: Db, circleIds: string[] | "all") {
  const rows = await db
    .select({
      id: report.id,
      circleId: report.circleId,
      circleSlug: circle.slug,
      targetType: report.targetType,
      targetId: report.targetId,
      reason: report.reason,
      details: report.details,
      createdAt: report.createdAt,
      authorHandle: profile.handle,
      postTitle: post.title,
      postBody: post.body,
      postId: sql<string>`coalesce(${post.id}, (select c.post_id from ${comment} c where c.id = ${report.targetId}))`,
      commentBody: sql<
        string | null
      >`(select c.body from ${comment} c where c.id = ${report.targetId} and ${report.targetType} = 'comment')`,
    })
    .from(report)
    .innerJoin(circle, eq(circle.id, report.circleId))
    .innerJoin(profile, eq(profile.userId, report.authorId))
    .leftJoin(post, and(eq(report.targetType, "post"), eq(post.id, report.targetId)))
    .where(
      and(
        eq(report.status, "open"),
        circleIds === "all" ? undefined : inArray(report.circleId, circleIds.length ? circleIds : [""]),
      ),
    )
    .orderBy(report.createdAt)
    .limit(100);
  return rows;
}

/* -------------------------------- Audit --------------------------------- */

async function audit(
  db: Db,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(auditLog).values({ id: randomUUID(), actorId, action, targetType, targetId, meta });
}
