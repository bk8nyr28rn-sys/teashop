"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { requireArea } from "@/lib/dal";
import { decideApplication, type Decision } from "@/lib/membership";
import { setResponderRole, suspendUser, unsuspendUser } from "@/lib/accounts";
import { getPaymentProvider } from "@/lib/payments";
import { resolveDispute, type QaError } from "@/lib/qa";
import {
  decideResponderApplication,
  setResponderPaused,
  unlockQuestion,
  updateQaSettings,
  type AdminError,
} from "@/lib/qa-admin";

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

export async function setResponderAction(locale: string, userId: string, responder: boolean) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await requireArea(locale, "admin");
  await setResponderRole(getDb(), viewer, { userId, responder });
  refresh();
}

/* ------------------------------ Q&A console ------------------------------ */

async function admin(locale: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  return requireArea(locale, "admin");
}

export async function unlockQuestionAction(locale: string, questionId: string, fd: FormData) {
  const viewer = await admin(locale);
  const res = await unlockQuestion(getDb(), viewer, { questionId, reason: String(fd.get("reason") ?? "") });
  redirect(`/${locale}/admin/questions/${questionId}${res.ok ? "" : `?error=${res.error}`}`);
}

/** Echo the submitted amount on error — never fall back to the (full) default. */
export type RefundState = { error?: AdminError | QaError; done?: boolean; amount?: string; note?: string } | undefined;

export async function refundAction(
  locale: string,
  questionId: string,
  _p: RefundState,
  fd: FormData,
): Promise<RefundState> {
  const viewer = await admin(locale);
  const amount = String(fd.get("amount") ?? "");
  const note = String(fd.get("note") ?? "");
  const dollars = Number(amount.replace(",", "."));
  if (!Number.isFinite(dollars) || dollars <= 0) return { error: "invalid-input", amount, note };
  const provider = getPaymentProvider();
  if (!provider) return { error: "forbidden", amount, note };
  const res = await resolveDispute(getDb(), provider, viewer, {
    questionId,
    refundCents: Math.round(dollars * 100),
    note,
  });
  if (!res.ok) return { error: res.error, amount, note };
  refresh();
  return { done: true };
}

export async function keepPaymentAction(locale: string, questionId: string) {
  const viewer = await admin(locale);
  const provider = getPaymentProvider();
  if (!provider) return;
  await resolveDispute(getDb(), provider, viewer, { questionId, refundCents: 0 });
  refresh();
}

export async function setResponderPausedAction(locale: string, userId: string, paused: boolean) {
  const viewer = await admin(locale);
  await setResponderPaused(getDb(), viewer, { userId, paused });
  refresh();
}

export async function decideResponderAppAction(locale: string, id: string, approve: boolean) {
  const viewer = await admin(locale);
  await decideResponderApplication(getDb(), viewer, { id, approve });
  refresh();
}

/** On error the submitted values are echoed back so the form keeps the admin's edits. */
export type SettingsState =
  { error?: "invalid-input" | "forbidden"; done?: boolean; values?: Record<string, string> } | undefined;

export async function saveQaSettingsAction(locale: string, _p: SettingsState, fd: FormData): Promise<SettingsState> {
  const viewer = await admin(locale);
  const num = (k: string) => Number(fd.get(k));
  const res = await updateQaSettings(getDb(), viewer, {
    feePercent: num("feePercent"),
    answerHours: num("answerHours"),
    priceMinCents: Math.round(num("priceMin") * 100),
    priceMaxCents: Math.round(num("priceMax") * 100),
    maxOpenPerAsker: num("maxOpenPerAsker"),
    overdueWarnAt: num("overdueWarnAt"),
    overduePauseAt: num("overduePauseAt"),
  });
  if (!res.ok) {
    const values = Object.fromEntries(
      [...fd.entries()].filter(([k]) => !k.startsWith("$ACTION")).map(([k, v]) => [k, String(v)]),
    );
    return { error: res.error === "forbidden" ? "forbidden" : "invalid-input", values };
  }
  refresh();
  return { done: true };
}
