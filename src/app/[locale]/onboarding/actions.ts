"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { getViewer } from "@/lib/dal";
import { redeemInvite, submitApplication, type JoinError } from "@/lib/membership";
import { APPLICATION_QUESTIONS } from "@/lib/application-questions";

/** On error the submitted values are echoed back so the form can be refilled. */
export type JoinFormState = { error?: JoinError; values?: Record<string, string> } | undefined;

function echo(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$ACTION")) values[k] = v;
  return values;
}

async function viewerOrRedirect(locale: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  return viewer;
}

export async function redeemInviteAction(
  locale: string,
  _prev: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const viewer = await viewerOrRedirect(locale);
  const result = await redeemInvite(getDb(), {
    userId: viewer.userId,
    code: String(formData.get("code") ?? ""),
    handle: String(formData.get("handle") ?? ""),
    ageConfirmed: formData.get("ageConfirmed") === "on",
  });
  if (!result.ok) return { error: result.error, values: echo(formData) };
  redirect(`/${locale}/home`);
}

export async function submitApplicationAction(
  locale: string,
  _prev: JoinFormState,
  formData: FormData,
): Promise<JoinFormState> {
  const viewer = await viewerOrRedirect(locale);
  const answers = Object.fromEntries(
    APPLICATION_QUESTIONS.map((id) => [id, String(formData.get(`answer_${id}`) ?? "")]),
  );
  const result = await submitApplication(getDb(), {
    userId: viewer.userId,
    handle: String(formData.get("handle") ?? ""),
    ageConfirmed: formData.get("ageConfirmed") === "on",
    answers,
  });
  if (!result.ok) return { error: result.error, values: echo(formData) };
  redirect(`/${locale}/pending`);
}
