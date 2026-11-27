import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "@/db";
import { application, auditLog, invite, profile, user } from "@/db/schema";
import { createInvite, decideApplication, ensureProfile, redeemInvite, submitApplication } from "@/lib/membership";

/**
 * Integration tests against a real PostgreSQL. Skipped unless
 * TEST_DATABASE_URL points at a throwaway database (it gets wiped).
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("membership (postgres)", () => {
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

  async function newUser(over: Partial<typeof profile.$inferInsert> = {}) {
    const id = randomUUID();
    await db.insert(user).values({ id, name: "", email: `${id}@test.local` });
    await ensureProfile(db, id);
    if (Object.keys(over).length) await db.update(profile).set(over).where(eq(profile.userId, id));
    return id;
  }

  const answers = {
    why: "I want a safe community to talk with.",
    lookingFor: "Friends and honest conversations.",
    guidelines: "Be kind and respect everyone's privacy.",
  };

  it("redeems an invite and records the inviter", async () => {
    const inviter = await newUser({ status: "approved", trustLevel: 2 });
    const created = await createInvite(db, { inviterId: inviter });
    expect(created.ok).toBe(true);
    const code = (created as { code: string }).code;

    const joiner = await newUser();
    const res = await redeemInvite(db, {
      userId: joiner,
      code: code.toLowerCase(),
      handle: "New_One",
      ageConfirmed: true,
    });
    expect(res).toEqual({ ok: true });

    const [p] = await db.select().from(profile).where(eq(profile.userId, joiner));
    expect(p.status).toBe("approved");
    expect(p.invitedBy).toBe(inviter);
    expect(p.handle).toBe("new_one");
    expect(p.ageConfirmedAt).not.toBeNull();
    const [inv] = await db.select().from(invite).where(eq(invite.code, code));
    expect(inv.uses).toBe(1);
  });

  it("never over-redeems a single-use invite under concurrency", async () => {
    const inviter = await newUser({ status: "approved", trustLevel: 2 });
    const { code } = (await createInvite(db, { inviterId: inviter })) as { code: string };
    const joiners = await Promise.all(Array.from({ length: 6 }, () => newUser()));

    const results = await Promise.all(
      joiners.map((id, i) => redeemInvite(db, { userId: id, code, handle: `racer_${i}`, ageConfirmed: true })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [inv] = await db.select().from(invite).where(eq(invite.code, code));
    expect(inv.uses).toBe(1);
    const approved = await db.select().from(profile).where(eq(profile.status, "approved"));
    expect(approved).toHaveLength(2); // inviter + one winner
  });

  it("rejects own, expired, revoked and suspended-inviter codes", async () => {
    const inviter = await newUser({ status: "approved", trustLevel: 2 });
    const joiner = await newUser();
    const make = async () => ((await createInvite(db, { inviterId: inviter })) as { code: string }).code;

    // An approved member cannot redeem anything, including their own code.
    const own = await make();
    expect(await redeemInvite(db, { userId: inviter, code: own, handle: "self_x", ageConfirmed: true })).toEqual({
      ok: false,
      error: "not-allowed",
    });

    const expired = await make();
    await db
      .update(invite)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invite.code, expired));
    expect((await redeemInvite(db, { userId: joiner, code: expired, handle: "joiner", ageConfirmed: true })).ok).toBe(
      false,
    );

    const revoked = await make();
    await db.update(invite).set({ revokedAt: new Date() }).where(eq(invite.code, revoked));
    expect((await redeemInvite(db, { userId: joiner, code: revoked, handle: "joiner", ageConfirmed: true })).ok).toBe(
      false,
    );

    const valid = await make();
    await db.update(profile).set({ status: "suspended" }).where(eq(profile.userId, inviter));
    expect((await redeemInvite(db, { userId: joiner, code: valid, handle: "joiner", ageConfirmed: true })).ok).toBe(
      false,
    );

    const [p] = await db.select().from(profile).where(eq(profile.userId, joiner));
    expect(p.status).toBe("new");
  });

  it("validates age, handle and duplicates", async () => {
    const taken = await newUser({ status: "approved", handle: "taken" });
    void taken;
    const u = await newUser();
    expect(await submitApplication(db, { userId: u, handle: "ok_name", ageConfirmed: false, answers })).toEqual({
      ok: false,
      error: "age-not-confirmed",
    });
    expect(await submitApplication(db, { userId: u, handle: "No Spaces", ageConfirmed: true, answers })).toEqual({
      ok: false,
      error: "invalid-handle",
    });
    expect(await submitApplication(db, { userId: u, handle: "taken", ageConfirmed: true, answers })).toEqual({
      ok: false,
      error: "handle-taken",
    });
    expect(
      await submitApplication(db, {
        userId: u,
        handle: "ok_name",
        ageConfirmed: true,
        answers: { ...answers, why: "short" },
      }),
    ).toEqual({ ok: false, error: "invalid-answers" });
  });

  it("runs the application review lifecycle and wipes answers", async () => {
    const admin = await newUser({ status: "approved", role: "admin", trustLevel: 3 });
    const applicant = await newUser();

    expect(
      await submitApplication(db, { userId: applicant, handle: "applicant", ageConfirmed: true, answers }),
    ).toEqual({ ok: true });
    expect(
      (await submitApplication(db, { userId: applicant, handle: "applicant", ageConfirmed: true, answers })).ok,
    ).toBe(false);

    const [app] = await db.select().from(application).where(eq(application.userId, applicant));
    expect(app.status).toBe("pending");
    expect(app.answers).toHaveLength(3);

    expect(await decideApplication(db, { applicationId: app.id, reviewerId: applicant, decision: "approved" })).toEqual(
      {
        ok: false,
        error: "self-review",
      },
    );

    const res = await decideApplication(db, { applicationId: app.id, reviewerId: admin, decision: "approved" });
    expect(res).toEqual({ ok: true, evidenceKeyToDelete: null });

    const [after] = await db.select().from(application).where(eq(application.id, app.id));
    expect(after.status).toBe("approved");
    expect(after.answers).toBeNull();
    expect(after.reviewerId).toBe(admin);
    const [p] = await db.select().from(profile).where(eq(profile.userId, applicant));
    expect(p.status).toBe("approved");
    const logs = await db.select().from(auditLog).where(eq(auditLog.targetId, app.id));
    expect(logs.map((l) => l.action)).toEqual(["application.approved"]);

    // Deciding twice is a no-op.
    expect(await decideApplication(db, { applicationId: app.id, reviewerId: admin, decision: "rejected" })).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("lets a rejected applicant re-apply and a pending applicant use an invite", async () => {
    const admin = await newUser({ status: "approved", role: "admin", trustLevel: 3 });
    const u = await newUser();
    await submitApplication(db, { userId: u, handle: "retry_me", ageConfirmed: true, answers });
    const [app] = await db.select().from(application).where(eq(application.userId, u));
    await decideApplication(db, { applicationId: app.id, reviewerId: admin, decision: "rejected" });
    expect(await submitApplication(db, { userId: u, handle: "retry_me", ageConfirmed: true, answers })).toEqual({
      ok: true,
    });

    const { code } = (await createInvite(db, { inviterId: admin })) as { code: string };
    expect(await redeemInvite(db, { userId: u, code, handle: "retry_me", ageConfirmed: true })).toEqual({ ok: true });
    const apps = await db.select().from(application).where(eq(application.userId, u));
    expect(apps.map((a) => a.status).sort()).toEqual(["rejected", "withdrawn"]);
    expect(apps.every((a) => a.answers === null)).toBe(true);
  });

  it("only trusted members can create invites, with capped uses", async () => {
    const newbie = await newUser({ status: "approved", trustLevel: 0 });
    expect(await createInvite(db, { inviterId: newbie })).toEqual({ ok: false, error: "not-allowed" });
    const regular = await newUser({ status: "approved", trustLevel: 2 });
    const { code } = (await createInvite(db, { inviterId: regular, maxUses: 50 })) as { code: string };
    const [inv] = await db.select().from(invite).where(eq(invite.code, code));
    expect(inv.maxUses).toBe(3);
  });
});
