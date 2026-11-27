"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { hasLocale } from "@/i18n/config";
import { deleteAccount, signOutOtherSessions } from "@/lib/accounts";
import { getAuth } from "@/lib/auth";
import { getViewer, isFreshSession } from "@/lib/dal";
import { confirmSetup, verifyStepUp, type MfaError } from "@/lib/mfa";

async function viewerOrSignIn(locale: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  return viewer;
}

/* ------------------------------- Devices -------------------------------- */

export type SignOutState = { count?: number } | undefined;

export async function signOutOthersAction(locale: string): Promise<SignOutState> {
  const viewer = await viewerOrSignIn(locale);
  return { count: await signOutOtherSessions(getDb(), viewer.userId, viewer.session.id) };
}

/** Ends the current session so the user can re-authenticate (e.g. before deleting). */
export async function reauthenticateAction(locale: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  await getAuth()
    .api.signOut({ headers: await headers() })
    .catch(() => undefined);
  redirect(`/${locale}/sign-in`);
}

/* ------------------------------- Deletion ------------------------------- */

export type DeleteState = { error?: "stale-session" | "mismatch" } | undefined;

export async function deleteAccountAction(locale: string, _prev: DeleteState, fd: FormData): Promise<DeleteState> {
  const viewer = await viewerOrSignIn(locale);
  // Destructive + irreversible: require a recent sign-in (someone may have
  // picked up an unlocked phone) and an exact typed confirmation.
  if (!isFreshSession(viewer)) return { error: "stale-session" };
  const typed = String(fd.get("confirm") ?? "").trim();
  if (typed !== (viewer.profile.handle ?? "DELETE")) return { error: "mismatch" };

  // Clear the cookie first (the session row disappears with the user anyway).
  await getAuth()
    .api.signOut({ headers: await headers() })
    .catch(() => undefined);
  await deleteAccount(getDb(), viewer.userId);
  redirect(`/${locale}/goodbye`);
}

/* ---------------------------- Staff 2FA (MFA) --------------------------- */

export type MfaFormState = { error?: MfaError; backupCodes?: string[] } | undefined;

function isStaff(viewer: Awaited<ReturnType<typeof viewerOrSignIn>>) {
  return viewer.staffMfa !== null;
}

export async function confirmMfaSetupAction(locale: string, _prev: MfaFormState, fd: FormData): Promise<MfaFormState> {
  const viewer = await viewerOrSignIn(locale);
  if (!isStaff(viewer)) redirect(`/${locale}/settings`);
  const res = await confirmSetup(getDb(), {
    userId: viewer.userId,
    sessionId: viewer.session.id,
    code: String(fd.get("code") ?? ""),
  });
  // Backup codes are returned once, straight to the browser that enrolled.
  return res.ok ? { backupCodes: res.backupCodes } : { error: res.error };
}

export async function verifyMfaAction(locale: string, _prev: MfaFormState, fd: FormData): Promise<MfaFormState> {
  const viewer = await viewerOrSignIn(locale);
  if (!isStaff(viewer)) redirect(`/${locale}/settings`);
  const res = await verifyStepUp(getDb(), {
    userId: viewer.userId,
    sessionId: viewer.session.id,
    code: String(fd.get("code") ?? ""),
  });
  if (!res.ok) return { error: res.error };
  redirect(`/${locale}/${viewer.realRole === "admin" ? "admin" : "responder"}`);
}
