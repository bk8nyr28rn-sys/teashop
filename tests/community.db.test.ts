import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "@/db";
import { circle, circleMember, comment, post, profile, report, user, type CircleVisibility } from "@/db/schema";
import {
  createComment,
  createPost,
  createReport,
  decideJoinRequest,
  deleteOwn,
  joinCircle,
  leaveCircle,
  listComments,
  listFeed,
  listOpenReports,
  loadPost,
  refreshTrust,
  resolveReport,
  setModerator,
  type Actor,
} from "@/lib/community";
import { ensureProfile } from "@/lib/membership";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("community (postgres)", () => {
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
    await db.execute(sql`truncate table "user", circle restart identity cascade`);
  });

  let n = 0;
  async function actor(over: Partial<typeof profile.$inferInsert> = {}): Promise<Actor> {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "", email: `${id}@t.local` });
    await ensureProfile(db, id);
    const set = { status: "approved" as const, approvedAt: new Date(), handle: `u${++n}`, trustLevel: 1, ...over };
    await db.update(profile).set(set).where(eq(profile.userId, id));
    const [p] = await db.select().from(profile).where(eq(profile.userId, id));
    return { userId: id, profile: p };
  }
  async function makeCircle(visibility: CircleVisibility, minTrustLevel = 0) {
    const id = randomUUID();
    await db
      .insert(circle)
      .values({ id, slug: id.slice(0, 8), name: { en: "C" }, description: { en: "d" }, visibility, minTrustLevel });
    return id;
  }
  const member = async (circleId: string, a: Actor, role: "member" | "moderator" = "member") =>
    db.insert(circleMember).values({ circleId, userId: a.userId, status: "active", role });

  it("joins open circles directly and requests approval circles", async () => {
    const open = await makeCircle("open");
    const gated = await makeCircle("approval", 1);
    const invite = await makeCircle("invite");
    const newbie = await actor({ trustLevel: 0 });
    const regular = await actor({ trustLevel: 1 });

    expect(await joinCircle(db, newbie, open)).toEqual({ ok: true, status: "joined" });
    expect(await joinCircle(db, newbie, gated)).toEqual({ ok: false, error: "trust-too-low" });
    expect(await joinCircle(db, regular, gated)).toEqual({ ok: true, status: "requested" });
    expect(await joinCircle(db, regular, invite)).toEqual({ ok: false, error: "forbidden" });

    const mod = await actor();
    await member(gated, mod, "moderator");
    const outsider = await actor();
    expect(await decideJoinRequest(db, outsider, { circleId: gated, userId: regular.userId, approve: true })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await decideJoinRequest(db, mod, { circleId: gated, userId: regular.userId, approve: true })).toEqual({
      ok: true,
    });
    const [m] = await db.select().from(circleMember).where(eq(circleMember.userId, regular.userId));
    expect(m.status).toBe("active");
  });

  it("keeps bans when leaving", async () => {
    const c = await makeCircle("open");
    const a = await actor();
    await db.insert(circleMember).values({ circleId: c, userId: a.userId, status: "banned" });
    await leaveCircle(db, a, c);
    expect(await joinCircle(db, a, c)).toEqual({ ok: false, error: "forbidden" });
  });

  it("hides private circles from non-members and requires joining to write", async () => {
    const gated = await makeCircle("approval");
    const author = await actor();
    await member(gated, author);
    const created = await createPost(db, author, { circleId: gated, title: "Hi", body: "Hello" });
    expect(created.ok).toBe(true);
    const postId = (created as { id: string }).id;

    const outsider = await actor({ trustLevel: 3 });
    expect(await loadPost(db, outsider, postId)).toBeNull();
    expect(await createComment(db, outsider, { postId, body: "x" })).toEqual({ ok: false, error: "not-found" });
    expect(await createPost(db, outsider, { circleId: gated, title: "a", body: "b" })).toEqual({
      ok: false,
      error: "must-join",
    });

    const open = await makeCircle("open");
    const p2 = (await (async () => {
      await member(open, author);
      return createPost(db, author, { circleId: open, title: "Open", body: "Body" });
    })()) as { id: string };
    expect(await loadPost(db, outsider, p2.id)).not.toBeNull(); // open circles are readable
    expect(await createComment(db, outsider, { postId: p2.id, body: "hi" })).toEqual({ ok: false, error: "must-join" });

    const admin = await actor({ role: "admin" });
    expect(await loadPost(db, admin, postId)).not.toBeNull();
  });

  it("enforces trust level and daily limits on posting", async () => {
    const c = await makeCircle("open");
    const newbie = await actor({ trustLevel: 0 });
    await member(c, newbie);
    expect(await createPost(db, newbie, { circleId: c, title: "t", body: "b" })).toEqual({
      ok: false,
      error: "trust-too-low",
    });

    const a = await actor({ trustLevel: 1 });
    await member(c, a);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createPost(db, a, { circleId: c, title: `t${i}`, body: "b" })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.error === "rate-limited")).toHaveLength(3);

    expect(await createPost(db, a, { circleId: c, title: "", body: "b" })).toEqual({
      ok: false,
      error: "invalid-input",
    });
    expect(await createPost(db, a, { circleId: c, title: "x".repeat(121), body: "b" })).toEqual({
      ok: false,
      error: "invalid-input",
    });
  });

  it("lets authors erase their own content and nobody else's", async () => {
    const c = await makeCircle("open");
    const a = await actor();
    const b = await actor();
    await member(c, a);
    await member(c, b);
    const { id: postId } = (await createPost(db, a, { circleId: c, title: "Secret", body: "Private story" })) as {
      id: string;
    };
    const { id: commentId } = (await createComment(db, b, { postId, body: "reply" })) as { id: string };

    expect(await deleteOwn(db, b, "post", postId)).toEqual({ ok: false, error: "not-found" });
    expect(await deleteOwn(db, b, "comment", commentId)).toEqual({ ok: true });
    expect(await deleteOwn(db, a, "post", postId)).toEqual({ ok: true });

    const [p] = await db.select().from(post).where(eq(post.id, postId));
    expect(p.title).toBe("");
    expect(p.body).toBe("");
    expect(p.removal).toBe("author");
    const [cm] = await db.select().from(comment).where(eq(comment.id, commentId));
    expect(cm.body).toBe("");
    expect(await loadPost(db, b, postId)).toBeNull();
  });

  it("runs the report → uphold flow and counts against trust", async () => {
    const c = await makeCircle("open");
    const author = await actor({ approvedAt: new Date(Date.now() - 20 * 86_400_000) });
    const reporter = await actor();
    const reporter2 = await actor();
    const mod = await actor();
    for (const a of [author, reporter, reporter2]) await member(c, a);
    await member(c, mod, "moderator");

    const { id: postId } = (await createPost(db, author, { circleId: c, title: "Bad", body: "Rude text" })) as {
      id: string;
    };
    expect(await createReport(db, author, { targetType: "post", targetId: postId, reason: "spam" })).toEqual({
      ok: false,
      error: "own-content",
    });
    expect(await createReport(db, reporter, { targetType: "post", targetId: postId, reason: "nonsense" })).toEqual({
      ok: false,
      error: "invalid-input",
    });
    expect(
      await createReport(db, reporter, {
        targetType: "post",
        targetId: postId,
        reason: "outing",
        details: "posted a screenshot",
      }),
    ).toEqual({ ok: true });
    expect(await createReport(db, reporter, { targetType: "post", targetId: postId, reason: "outing" })).toEqual({
      ok: false,
      error: "already-reported",
    });
    expect(await createReport(db, reporter2, { targetType: "post", targetId: postId, reason: "harassment" })).toEqual({
      ok: true,
    });

    const open = await listOpenReports(db, [c]);
    expect(open).toHaveLength(2);
    expect(open[0].postBody).toBe("Rude text");

    const bystander = await actor();
    expect(await resolveReport(db, bystander, { reportId: open[0].id, decision: "upheld" })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await resolveReport(db, mod, { reportId: open[0].id, decision: "upheld" })).toEqual({ ok: true });

    // Both reports on the target are resolved together; content is hidden but kept.
    const statuses = await db.select({ s: report.status }).from(report);
    expect(statuses.map((r) => r.s)).toEqual(["upheld", "upheld"]);
    const [p] = await db.select().from(post).where(eq(post.id, postId));
    expect(p.removal).toBe("moderator");
    expect(p.body).toBe("Rude text");
    expect(await loadPost(db, reporter, postId)).toBeNull();
    expect(await loadPost(db, mod, postId)).not.toBeNull();

    // 20 days in with ≥5 contributions would normally reach level 2 — an upheld report blocks it.
    for (let i = 0; i < 5; i++)
      await db.insert(comment).values({ id: randomUUID(), postId, authorId: author.userId, body: "c" });
    expect(await refreshTrust(db, author.userId)).toBe(1);
  });

  it("promotes trust from activity", async () => {
    const c = await makeCircle("open");
    const a = await actor({ trustLevel: 0, approvedAt: new Date(Date.now() - 15 * 86_400_000) });
    await member(c, a);
    const other = await actor();
    await member(c, other);
    const { id: postId } = (await createPost(db, other, { circleId: c, title: "t", body: "b" })) as { id: string };
    expect(await refreshTrust(db, a.userId)).toBe(1);
    for (let i = 0; i < 5; i++) await createComment(db, a, { postId, body: `c${i}` });
    expect(await refreshTrust(db, a.userId)).toBe(2);
  });

  it("builds a feed only from joined circles and lets admins appoint moderators", async () => {
    const joined = await makeCircle("open");
    const notJoined = await makeCircle("open");
    const me = await actor();
    const other = await actor();
    await member(joined, me);
    await member(joined, other);
    await member(notJoined, other);
    await createPost(db, other, { circleId: joined, title: "In feed", body: "b" });
    await createPost(db, other, { circleId: notJoined, title: "Not in feed", body: "b" });
    const feed = await listFeed(db, me.userId);
    expect(feed.map((f) => f.title)).toEqual(["In feed"]);

    expect(await setModerator(db, other, { circleId: joined, userId: me.userId, moderator: true })).toEqual({
      ok: false,
      error: "forbidden",
    });
    const admin = await actor({ role: "admin" });
    expect(await setModerator(db, admin, { circleId: joined, userId: me.userId, moderator: true })).toEqual({
      ok: true,
    });
    const comments = await listComments(db, feed[0].id, false);
    expect(comments).toEqual([]);
  });
});
