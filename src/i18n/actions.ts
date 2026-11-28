"use server";

import { getDb } from "@/db";
import { setPreferredLocale } from "@/lib/accounts";
import { getViewer } from "@/lib/dal";
import { hasLocale } from "./config";

/** Saves an explicit language choice on the signed-in user's account. The cookie is set client-side. */
export async function saveLocaleAction(locale: string): Promise<void> {
  if (!hasLocale(locale)) return;
  const viewer = await getViewer();
  if (viewer) await setPreferredLocale(getDb(), viewer.userId, locale);
}
