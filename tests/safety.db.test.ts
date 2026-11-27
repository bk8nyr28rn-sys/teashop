import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "@/db";
import {
  auditLog,
  circle,
  circleMember,
  comment,
  mfaSession,
  post,
  profile,
  report,
  session,
  staffMfa,
  user,
  verification,
} from "@/db/schema";
import { deleteAccount, findMembers, signOutOtherSessions, suspendUser, unsuspendUser } from "@/lib/accounts";
import { banFromCircle, joinCircle, leaveCircle, unbanFromCircle, type Actor } from "@/lib/community";
import { ensureProfile } from "@/lib/membership";
import {
  backupCodesLeft,
  beginSetup,
  confirmSetup,
  currentCounter,
  MAX_FAILED_ATTEMPTS,
  mfaStatus,
  totpForCounter,
  verifyStepUp,
} from "@/lib/mfa";

const url = process.env.TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";

describe.skipIf(!url)("account safety (postgres)", () => {
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
    await db.execute(sql`truncate table "user", circle, verification restart identity cascade`);
  });

  let n = 0;
  async function actor(over: Partial<typeof profile.$inferInsert> = {}): Promise<Actor & { email: string }> {
    const id = randomUUID();
    const email = `${id}@t.local`;
    await db.insert(user).values({ id, name: "", email });
    await ensureProfile(db, id);
    await db
      .update(profile)
      .set({ status: "approved", approvedAt: new Date(), handle: `user${++n}`, trustLevel: 1, ...over })
      .where(eq(profile.userId, id));
    const [p] = await db.select().from(profile).where(eq(profile.userId, id));
    return { userId: id, profile: p, email };
  }
  async function newSession(userId: string) {
    const id = randomUUID();
    await db.insert(session).values({ id, userId, token: randomUUID(), expiresAt: new Date(Date.now() + 86_400_000) });
    return id;
  }

  /* --------------------------------- MFA --------------------------------- */

  describe("staff TOTP", () => {
    async function enrolled() {
      const a = await actor({ role: "admin" });
      const sid = await newSession(a.userId);
      const setup = await beginSetup(db, { userId: a.userId, issuer: "Test", account: "admin" });
      if (!setup.ok) throw new Error("setup failed");
      const c = currentCounter();
      const res = await confirmSetup(db, {
        userId: a.userId,
        sessionId: sid,
        code: await totpForCounter(setup.secret, c),
      });
      if (!res.ok) throw new Error(`confirm failed: ${res.error}`);
      return { a, sid, secret: setup.secret, counter: c, backupCodes: res.backupCodes };
    }

    it("keeps the pending secret stable and never stores it in plain text", async () => {
      const a = await actor({ role: "admin" });
      const s1 = await beginSetup(db, { userId: a.userId, issuer: "Test", account: "a" });
      const s2 = await beginSetup(db, { userId: a.userId, issuer: "Test", account: "a" });
      expect(s1.ok && s2.ok && s1.secret === s2.secret).toBe(true);
      const [row] = await db.select().from(staffMfa).where(eq(staffMfa.userId, a.userId));
      expect(row.secretEnc).not.toContain((s1 as { secret: string }).secret);
      expect((s1 as { uri: string }).uri).toMatch(/^otpauth:\/\/totp\/Test:a\?secret=/);
    });

    it("enrols, verifies the enrolling session, and hands out 10 backup codes", async () => {
      const { a, sid, backupCodes } = await enrolled();
      expect(backupCodes).toHaveLength(10);
      expect(await mfaStatus(db, a.userId, sid)).toEqual({ enrolled: true, verified: true });
      const other = await newSession(a.userId);
      expect(await mfaStatus(db, a.userId, other)).toEqual({ enrolled: true, verified: false });
      expect(await beginSetup(db, { userId: a.userId, issuer: "T", account: "a" })).toEqual({
        ok: false,
        error: "already-enrolled",
      });
    });

    it("rejects replayed codes and accepts the next time step", async () => {
      const { a, secret, counter } = await enrolled();
      const sid = await newSession(a.userId);
      const replay = await verifyStepUp(db, {
        userId: a.userId,
        sessionId: sid,
        code: await totpForCounter(secret, counter),
      });
      expect(replay).toEqual({ ok: false, error: "invalid-code" });
      const next = await verifyStepUp(db, {
        userId: a.userId,
        sessionId: sid,
        code: await totpForCounter(secret, counter + 1),
      });
      expect(next).toEqual({ ok: true, usedBackupCode: false });
      expect((await mfaStatus(db, a.userId, sid)).verified).toBe(true);
    });

    it("accepts each backup code exactly once (any formatting)", async () => {
      const { a, backupCodes } = await enrolled();
      const s1 = await newSession(a.userId);
      const s2 = await newSession(a.userId);
      const code = backupCodes[0];
      expect(
        await verifyStepUp(db, { userId: a.userId, sessionId: s1, code: code.toLowerCase().replace("-", " ") }),
      ).toEqual({
        ok: true,
        usedBackupCode: true,
      });
      expect(await verifyStepUp(db, { userId: a.userId, sessionId: s2, code })).toEqual({
        ok: false,
        error: "invalid-code",
      });
      expect(await backupCodesLeft(db, a.userId)).toBe(9);
    });

    it(`locks after ${MAX_FAILED_ATTEMPTS} wrong codes, even for a correct one`, async () => {
      const { a, secret, counter } = await enrolled();
      const sid = await newSession(a.userId);
      const results = [];
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        results.push(await verifyStepUp(db, { userId: a.userId, sessionId: sid, code: "000000" }));
      }
      expect(results.at(-1)).toEqual({ ok: false, error: "locked" });
      const correct = await verifyStepUp(db, {
        userId: a.userId,
        sessionId: sid,
        code: await totpForCounter(secret, counter + 1),
      });
      expect(correct).toEqual({ ok: false, error: "locked" });
    });

    it("forgets verification when the session ends", async () => {
      const { a, sid } = await enrolled();
      await db.delete(session).where(eq(session.id, sid));
      expect(await db.select().from(mfaSession).where(eq(mfaSession.userId, a.userId))).toEqual([]);
    });
  });

  /* ------------------------------ Suspension ----------------------------- */

  it("suspends a member, revokes sessions, and restores status on unsuspend", async () => {
    const admin = await actor({ role: "admin" });
    const m = await actor();
    await newSession(m.userId);
    await newSession(m.userId);

    expect(await suspendUser(db, m, { userId: admin.userId })).toEqual({ ok: false, error: "forbidden" });
    expect(await suspendUser(db, admin, { userId: admin.userId })).toEqual({ ok: false, error: "cannot-target-self" });
    const otherAdmin = await actor({ role: "admin" });
    expect(await suspendUser(db, admin, { userId: otherAdmin.userId })).toEqual({
      ok: false,
      error: "cannot-target-admin",
    });
    // An admin whose effective role was downgraded (no 2FA) can't suspend either.
    expect(
      await suspendUser(db, { ...admin, profile: { ...admin.profile, role: "member" } }, { userId: m.userId }),
    ).toEqual({
      ok: false,
      error: "forbidden",
    });

    expect(await suspendUser(db, admin, { userId: m.userId, reason: "harassment in DMs" })).toEqual({ ok: true });
    const [p] = await db.select().from(profile).where(eq(profile.userId, m.userId));
    expect(p.status).toBe("suspended");
    expect(await db.select().from(session).where(eq(session.userId, m.userId))).toEqual([]);
    const [log] = await db.select().from(auditLog).where(eq(auditLog.action, "user.suspended"));
    expect(log.meta).toEqual({ reason: "harassment in DMs" });

    expect(await unsuspendUser(db, admin, m.userId)).toEqual({ ok: true });
    const [after] = await db.select().from(profile).where(eq(profile.userId, m.userId));
    expect(after.status).toBe("approved");
    expect(after.suspendedAt).toBeNull();

    // A user suspended before ever being approved goes back to onboarding.
    const fresh = await actor({ status: "pending", approvedAt: null });
    await suspendUser(db, admin, { userId: fresh.userId });
    await unsuspendUser(db, admin, fresh.userId);
    const [f] = await db.select().from(profile).where(eq(profile.userId, fresh.userId));
    expect(f.status).toBe("new");
  });

  it("finds members by nickname prefix only", async () => {
    await actor({ handle: "river_fox" });
    await actor({ handle: "river_cat" });
    await actor({ handle: "moon" });
    expect((await findMembers(db, "@river")).map((r) => r.handle)).toEqual(["river_cat", "river_fox"]);
    expect(await findMembers(db, "%")).toEqual([]);
    expect(await findMembers(db, "someone@example.com")).toEqual([]);
  });

  it("signs out other sessions but keeps the current one", async () => {
    const a = await actor();
    const keep = await newSession(a.userId);
    await newSession(a.userId);
    await newSession(a.userId);
    expect(await signOutOtherSessions(db, a.userId, keep)).toBe(2);
    const left = await db.select({ id: session.id }).from(session).where(eq(session.userId, a.userId));
    expect(left).toEqual([{ id: keep }]);
  });

  /* ------------------------------ Circle bans ---------------------------- */

  it("lets moderators ban members, and bans survive leaving", async () => {
    const c = randomUUID();
    await db
      .insert(circle)
      .values({ id: c, slug: "c", name: { en: "C" }, description: { en: "d" }, visibility: "open" });
    const mod = await actor();
    const otherMod = await actor();
    const m = await actor();
    const admin = await actor({ role: "admin" });
    await db.insert(circleMember).values([
      { circleId: c, userId: mod.userId, role: "moderator", status: "active" },
      { circleId: c, userId: otherMod.userId, role: "moderator", status: "active" },
      { circleId: c, userId: m.userId, status: "active" },
    ]);

    expect(await banFromCircle(db, m, { circleId: c, userId: mod.userId })).toEqual({ ok: false, error: "forbidden" });
    expect(await banFromCircle(db, mod, { circleId: c, userId: otherMod.userId })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await banFromCircle(db, mod, { circleId: c, userId: admin.userId })).toEqual({
      ok: false,
      error: "forbidden",
    });
    expect(await banFromCircle(db, mod, { circleId: c, userId: m.userId })).toEqual({ ok: true });

    await leaveCircle(db, m, c);
    expect(await joinCircle(db, m, c)).toEqual({ ok: false, error: "forbidden" });
    // Banning someone who never joined also blocks them.
    const stranger = await actor();
    expect(await banFromCircle(db, mod, { circleId: c, userId: stranger.userId })).toEqual({ ok: true });
    expect(await joinCircle(db, stranger, c)).toEqual({ ok: false, error: "forbidden" });

    expect(await unbanFromCircle(db, mod, { circleId: c, userId: m.userId })).toEqual({ ok: true });
    expect(await joinCircle(db, m, c)).toEqual({ ok: true, status: "joined" });
    expect(await banFromCircle(db, admin, { circleId: c, userId: otherMod.userId })).toEqual({ ok: true });
  });

  /* ------------------------------- Deletion ------------------------------ */

  it("deletes an account, erases its text, and keeps others' replies", async () => {
    const c = randomUUID();
    await db
      .insert(circle)
      .values({ id: c, slug: "c", name: { en: "C" }, description: { en: "d" }, visibility: "open" });
    const leaver = await actor();
    const friend = await actor();
    await newSession(leaver.userId);
    const postId = randomUUID();
    await db
      .insert(post)
      .values({ id: postId, circleId: c, authorId: leaver.userId, title: "My story", body: "Private details" });
    const friendComment = randomUUID();
    const leaverComment = randomUUID();
    await db.insert(comment).values([
      { id: friendComment, postId, authorId: friend.userId, body: "Sending love" },
      { id: leaverComment, postId, authorId: leaver.userId, body: "Thanks!" },
    ]);
    await db.insert(report).values({
      id: randomUUID(),
      reporterId: friend.userId,
      targetType: "comment",
      targetId: leaverComment,
      circleId: c,
      authorId: leaver.userId,
      reason: "spam",
    });
    await db.insert(verification).values({
      id: randomUUID(),
      identifier: `sign-in-otp-${leaver.email}`,
      value: "hash",
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await deleteAccount(db, leaver.userId)).toEqual({ ok: true });

    expect(await db.select().from(user).where(eq(user.id, leaver.userId))).toEqual([]);
    expect(await db.select().from(profile).where(eq(profile.userId, leaver.userId))).toEqual([]);
    expect(await db.select().from(session).where(eq(session.userId, leaver.userId))).toEqual([]);
    expect(await db.select().from(report)).toEqual([]);
    expect(await db.select().from(verification)).toEqual([]);

    const [p] = await db.select().from(post).where(eq(post.id, postId));
    expect(p).toMatchObject({ title: "", body: "", authorId: null, removal: "author" });
    const comments = await db.select().from(comment).where(eq(comment.postId, postId));
    expect(comments.find((x) => x.id === friendComment)?.body).toBe("Sending love");
    expect(comments.find((x) => x.id === leaverComment)).toMatchObject({ body: "", authorId: null });

    const text = JSON.stringify(await db.select().from(auditLog));
    expect(text).not.toContain(leaver.email);
    expect(await deleteAccount(db, leaver.userId)).toEqual({ ok: false, error: "not-found" });
  });
});
