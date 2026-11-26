import "./load-env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { auditLog, profile, user } from "../src/db/schema";

/**
 * Bootstrap an administrator from the command line (no "first user becomes
 * admin" shortcut). The person must have signed in once already.
 *
 *   npm run admin:grant -- someone@example.com
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run admin:grant -- <email>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const { db, client } = createDb(url);
  try {
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!u) throw new Error("No account with that email. Sign in once first, then re-run.");

    const now = new Date();
    await db
      .insert(profile)
      .values({ userId: u.id, role: "admin", status: "approved", trustLevel: 3, approvedAt: now, ageConfirmedAt: now })
      .onConflictDoUpdate({
        target: profile.userId,
        set: { role: "admin", status: "approved", trustLevel: 3, approvedAt: now },
      });
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorId: null,
      action: "admin.granted-via-cli",
      targetType: "user",
      targetId: u.id,
    });
    console.log("Admin role granted.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
