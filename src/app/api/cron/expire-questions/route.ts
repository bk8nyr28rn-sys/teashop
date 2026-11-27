import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { getPaymentProvider } from "@/lib/payments";
import { expireOverdue } from "@/lib/qa";

/**
 * Releases card holds on unanswered questions past their deadline.
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const provider = getPaymentProvider();
  if (!provider) return Response.json({ expired: 0, skipped: "payments not configured" });
  const expired = await expireOverdue(getDb(), provider);
  return Response.json({ expired });
}
