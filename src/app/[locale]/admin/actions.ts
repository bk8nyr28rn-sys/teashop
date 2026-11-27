"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { requireArea } from "@/lib/dal";
import { decideApplication, type Decision } from "@/lib/membership";
import { suspendUser, unsuspendUser } from "@/lib/accounts";

export async function decideApplicationAction(locale: string, applicationId: string, decision: Decision) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  if (decision !== "approved" && decision !== "rejected") throw new Error("Invalid decision");
  // Re-check authorization inside the action: never trust the page that rendered the form.
  const { userId } = await requireArea(locale, "admin");
  const result = await decideApplication(getDb(), { applicationId, reviewerId: userId, decision });
  if (result.ok && result.evidenceKeyToDelete) {
    // TODO(storage): delete the evidence object from R2 once uploads are wired.
  }
  refresh();
}

export async function suspendAction(locale: string, userId: string, fd: FormData) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await requireArea(locale, "admin");
  await suspendUser(getDb(), viewer, { userId, reason: String(fd.get("reason") ?? "") });
  refresh();
}

export async function unsuspendAction(locale: string, userId: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await requireArea(locale, "admin");
  await unsuspendUser(getDb(), viewer, userId);
  refresh();
}
