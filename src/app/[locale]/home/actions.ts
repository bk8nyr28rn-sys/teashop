"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { getViewer } from "@/lib/dal";
import { createInvite } from "@/lib/membership";

export type InviteFormState = { code?: string; error?: "not-allowed" } | undefined;

export async function createInviteAction(locale: string): Promise<InviteFormState> {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  const result = await createInvite(getDb(), { inviterId: viewer.userId });
  return result.ok ? { code: result.code } : { error: result.error };
}
