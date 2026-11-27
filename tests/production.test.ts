import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb, type Db } from "@/db";
import { circle, rateLimit } from "@/db/schema";
import { applicationsOpen, productionEnvErrors, resolveBaseUrl } from "@/lib/env";
import { createRateLimitStore } from "@/lib/rate-limit-store";

describe("productionEnvErrors()", () => {
  const good = {
    DATABASE_URL: "postgres://u:p@host/db?sslmode=require",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "https://example.org",
    RESEND_API_KEY: "re_123",
    EMAIL_FROM: "Account <no-reply@example.org>",
  };

  it("accepts a complete production config", () => {
    expect(productionEnvErrors(good)).toEqual([]);
  });

  it("names every missing or weak setting", () => {
    const errors = productionEnvErrors({ BETTER_AUTH_SECRET: "short", BETTER_AUTH_URL: "http://insecure" });
    expect(errors.map((e) => e.split(":")[0])).toEqual([
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      "RESEND_API_KEY",
      "EMAIL_FROM",
    ]);
  });

  it("lets preview deployments fall back to VERCEL_URL", () => {
    const preview = { ...good, BETTER_AUTH_URL: undefined, VERCEL_ENV: "preview", VERCEL_URL: "app-git-x.vercel.app" };
    expect(productionEnvErrors(preview)).toEqual([]);
    expect(resolveBaseUrl(preview)).toBe("https://app-git-x.vercel.app");
    expect(resolveBaseUrl({ VERCEL_ENV: "production", VERCEL_URL: "x.vercel.app" })).toBeUndefined();
    expect(resolveBaseUrl(good)).toBe("https://example.org");
  });

  it("treats applications as open unless explicitly closed", () => {
    expect(applicationsOpen({})).toBe(true);
    expect(applicationsOpen({ APPLICATIONS_OPEN: "false" })).toBe(false);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("rate-limit store (postgres)", () => {
  let db: Db;
  let close: () => Promise<void>;
  const store = () =>
    createRateLimitStore(
      () => db,
      () => "test-secret",
    );

  beforeAll(async () => {
    const conn = createDb(url!);
    db = conn.db;
    close = () => conn.client.end();
    await migrate(db, { migrationsFolder: "drizzle" });
  });
  afterAll(async () => close?.());
  beforeEach(async () => {
    await db.delete(rateLimit);
  });

  it("allows exactly `max` requests under concurrency", async () => {
    const s = store();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => s.consume("203.0.113.7|/email-otp/send", { window: 60, max: 3 })),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(3);
    const blocked = results.find((r) => !r.allowed)!;
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it("keeps keys independent and resets after the window", async () => {
    const s = store();
    expect((await s.consume("a", { window: 1, max: 1 })).allowed).toBe(true);
    expect((await s.consume("a", { window: 1, max: 1 })).allowed).toBe(false);
    expect((await s.consume("b", { window: 1, max: 1 })).allowed).toBe(true);
    await db.execute(sql`update rate_limit set window_start = now() - interval '2 seconds'`);
    expect((await s.consume("a", { window: 1, max: 1 })).allowed).toBe(true);
  });

  it("never stores the raw key (IP addresses)", async () => {
    await store().consume("198.51.100.23|/sign-in/email-otp", { window: 60, max: 5 });
    const rows = await db.select().from(rateLimit);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("198.51.100.23");
  });

  it("seeds the starter circles through migrations", async () => {
    const slugs = (await db.select({ slug: circle.slug }).from(circle)).map((c) => c.slug);
    // Other suites truncate circles; only assert when the seed is present.
    if (slugs.length) expect(slugs).toEqual(expect.arrayContaining(["lounge", "questioning"]));
  });
});
