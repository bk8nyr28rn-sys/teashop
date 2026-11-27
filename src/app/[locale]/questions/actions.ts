"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { requireArea } from "@/lib/dal";
import { resolveBaseUrl } from "@/lib/env";
import { getPaymentProvider } from "@/lib/payments";
import {
  answerQuestion,
  askQuestion,
  cancelQuestion,
  getQuestionView,
  markAuthorized,
  openDispute,
  rateAnswer,
  refreshPayoutStatus,
  resolveDispute,
  saveResponderProfile,
  startPayoutOnboarding,
  type QaError,
} from "@/lib/qa";

export type QaFormState =
  { error?: QaError; crisis?: boolean; done?: boolean; values?: Record<string, string> } | undefined;

async function member(locale: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  return requireArea(locale, "member");
}

function payments() {
  const p = getPaymentProvider();
  if (!p) throw new Error("Payments are not configured");
  return p;
}

async function baseUrl() {
  const configured = resolveBaseUrl(process.env);
  if (configured) return configured;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/* ------------------------------- Asking -------------------------------- */

export async function askAction(
  locale: string,
  responderId: string,
  _p: QaFormState,
  fd: FormData,
): Promise<QaFormState> {
  const viewer = await member(locale);
  const title = String(fd.get("title") ?? "");
  const body = String(fd.get("body") ?? "");
  const res = await askQuestion(getDb(), payments(), viewer, {
    responderId,
    title,
    body,
    crisisAcknowledged: fd.get("crisisAck") === "on",
    locale,
    baseUrl: await baseUrl(),
  });
  if (!res.ok) return { error: res.error, crisis: res.error === "crisis-check", values: { title, body } };
  redirect(res.checkoutUrl);
}

export async function cancelQuestionAction(locale: string, questionId: string) {
  const viewer = await member(locale);
  await cancelQuestion(getDb(), payments(), viewer, questionId);
  refresh();
}

export async function rateAction(
  locale: string,
  questionId: string,
  _p: QaFormState,
  fd: FormData,
): Promise<QaFormState> {
  const viewer = await member(locale);
  const res = await rateAnswer(getDb(), viewer, {
    questionId,
    rating: Number(fd.get("rating")),
    feedback: String(fd.get("feedback") ?? ""),
  });
  if (!res.ok) return { error: res.error };
  refresh();
  return { done: true };
}

export async function disputeAction(
  locale: string,
  questionId: string,
  _p: QaFormState,
  fd: FormData,
): Promise<QaFormState> {
  const viewer = await member(locale);
  const reason = String(fd.get("reason") ?? "");
  const res = await openDispute(getDb(), viewer, { questionId, reason });
  if (!res.ok) return { error: res.error, values: { reason } };
  refresh();
  return { done: true };
}

/** Development-only stand-in for Stripe Checkout. */
export async function devAuthorizeAction(locale: string, questionId: string) {
  const viewer = await member(locale);
  const provider = payments();
  if (provider.name !== "fake") throw new Error("Not available");
  const q = await getQuestionView(getDb(), viewer, questionId);
  if (!q || q.viewerRole !== "asker") throw new Error("Not found");
  await markAuthorized(getDb(), {
    questionId,
    paymentRef: `fake_pi_${questionId}`,
    amountCents: q.priceCents,
    currency: q.currency,
  });
  redirect(`/${locale}/questions/${questionId}?checkout=done`);
}

/* ------------------------------ Responding ----------------------------- */

export async function answerAction(
  locale: string,
  questionId: string,
  _p: QaFormState,
  fd: FormData,
): Promise<QaFormState> {
  const viewer = await requireArea(hasLocale(locale) ? locale : "en", "responder");
  const answer = String(fd.get("answer") ?? "");
  const res = await answerQuestion(getDb(), payments(), viewer, { questionId, answer });
  if (!res.ok) return { error: res.error, values: { answer } };
  refresh();
  return { done: true };
}

export async function saveResponderProfileAction(locale: string, _p: QaFormState, fd: FormData): Promise<QaFormState> {
  const viewer = await requireArea(hasLocale(locale) ? locale : "en", "responder");
  const values = {
    headline: String(fd.get("headline") ?? ""),
    bio: String(fd.get("bio") ?? ""),
    price: String(fd.get("price") ?? ""),
  };
  const res = await saveResponderProfile(getDb(), viewer, {
    headline: values.headline,
    bio: values.bio,
    topics: fd.getAll("topics").map(String),
    languages: fd.getAll("languages").map(String),
    priceCents: Math.round(Number(values.price) * 100),
    accepting: fd.get("accepting") === "on",
  });
  if (!res.ok) return { error: res.error, values };
  refresh();
  return { done: true };
}

export async function startPayoutsAction(locale: string) {
  const viewer = await requireArea(hasLocale(locale) ? locale : "en", "responder");
  const back = `${await baseUrl()}/${locale}/responder/profile`;
  const res = await startPayoutOnboarding(getDb(), payments(), viewer, {
    returnUrl: `${back}?payouts=return`,
    refreshUrl: `${back}?payouts=refresh`,
  });
  if (!res.ok) redirect(`/${locale}/responder/profile`);
  redirect(res.url);
}

export async function refreshPayoutsAction(locale: string) {
  const viewer = await requireArea(hasLocale(locale) ? locale : "en", "responder");
  await refreshPayoutStatus(getDb(), payments(), viewer.userId);
  refresh();
}

/* -------------------------------- Admin -------------------------------- */

export async function resolveDisputeAction(locale: string, questionId: string, refund: boolean) {
  const viewer = await requireArea(hasLocale(locale) ? locale : "en", "admin");
  await resolveDispute(getDb(), payments(), viewer, { questionId, refund });
  refresh();
}
