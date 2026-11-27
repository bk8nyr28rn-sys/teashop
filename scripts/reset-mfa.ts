import "./load-env";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { auditLog, user } from "../src/db/schema";
import { resetMfa } from "../src/lib/mfa";

/**
 * Lost authenticator recovery for staff. Run only after confirming the
 * person's identity out of band — this removes their second factor.
 *
 *   npm run mfa:reset -- someone@example.com
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run mfa:reset -- <email>");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const { db, client } = createDb(url);
  try {
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    if (!u) throw new Error("No account with that email.");
    await resetMfa(db, u.id);
    await db.insert(auditLog).values({
      id: randomUUID(),
      actorId: null,
      action: "mfa.reset-via-cli",
      targetType: "user",
      targetId: u.id,
    });
    console.log("Two-factor enrolment removed. They must set it up again on next staff access.");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
