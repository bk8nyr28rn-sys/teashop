import { createHmac } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { rateLimit } from "@/db/schema";

/**
 * Better Auth rate-limit storage backed by Postgres.
 *
 * - Shared by all serverless instances (in-memory limits are per instance,
 *   which makes them nearly useless on Vercel).
 * - Atomic: one upsert both checks and increments, so concurrent requests
 *   can't all slip past a stale read.
 * - Private: the key ("ip|path") is HMAC-hashed with the server secret, so the
 *   table never contains an IP address.
 */
export function createRateLimitStore(getDb: () => Db, secret: () => string) {
  return {
    async consume(key: string, rule: { window: number; max: number }) {
      const keyHash = createHmac("sha256", secret()).update(key).digest("base64url");
      const windowSecs = Math.max(1, Math.trunc(rule.window));
      const expired = sql`${rateLimit.windowStart} <= now() - make_interval(secs => ${windowSecs})`;
      const db = getDb();

      const [row] = await db
        .insert(rateLimit)
        .values({ keyHash, count: 1 })
        .onConflictDoUpdate({
          target: rateLimit.keyHash,
          set: {
            count: sql`case when ${expired} then 1 else ${rateLimit.count} + 1 end`,
            windowStart: sql`case when ${expired} then now() else ${rateLimit.windowStart} end`,
          },
        })
        .returning({
          count: rateLimit.count,
          elapsed: sql<number>`extract(epoch from now() - ${rateLimit.windowStart})::float8`,
        });

      // Opportunistic cleanup of stale counters (~1% of calls).
      if (Math.random() < 0.01) {
        void db
          .delete(rateLimit)
          .where(lt(rateLimit.windowStart, sql`now() - interval '1 day'`))
          .catch(() => undefined);
      }

      if (row.count <= rule.max) return { allowed: true, retryAfter: null };
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(windowSecs - row.elapsed)) };
    },
  };
}
