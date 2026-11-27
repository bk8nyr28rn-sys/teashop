import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import type { Profile, Role } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { getAuth } from "./auth";
import { refreshTrust } from "./community";
import { ensureProfile } from "./membership";
import { mfaStatus } from "./mfa";
import { canEnterAdminArea, canEnterMemberArea, canEnterResponderArea, landingPathFor } from "./permissions";

/**
 * Data Access Layer: the single place that turns the request's session cookie
 * into a viewer. Everything sensitive must go through here (or re-check in a
 * server action) — the proxy's cookie check is only a fast pre-filter.
 */

/**
 * null  – not staff, no second factor needed
 * setup – staff who haven't enrolled an authenticator yet
 * verify – enrolled, but this session hasn't passed the second factor
 * ok    – verified for this session
 */
export type StaffMfaState = null | "setup" | "verify" | "ok";

export type ViewerContext = {
  userId: string;
  email: string;
  session: { id: string; createdAt: Date };
  /**
   * Effective profile used for every permission check. Staff who haven't
   * passed 2FA in this session are downgraded to `member` here, so no code
   * path can use admin/responder powers without the second factor.
   */
  profile: Profile;
  /** The stored role, before the 2FA downgrade. */
  realRole: Role;
  staffMfa: StaffMfaState;
};

const STAFF: Role[] = ["admin", "responder"];

export const getViewer = cache(async (): Promise<ViewerContext | null> => {
  // Read request headers *before* touching auth/DB: during prerendering this
  // is where Next.js stops, so builds never need a database connection.
  const requestHeaders = await headers();
  const s = await getAuth().api.getSession({ headers: requestHeaders });
  if (!s) return null;
  const db = getDb();
  let profile = await ensureProfile(db, s.user.id);
  if (profile.status === "approved") {
    // Trust grows with time and activity; re-evaluate once per request.
    const level = await refreshTrust(db, s.user.id);
    if (level !== null && level !== profile.trustLevel) profile = { ...profile, trustLevel: level };
  }

  const realRole = profile.role;
  let staffMfa: StaffMfaState = null;
  if (STAFF.includes(realRole) && profile.status === "approved") {
    const mfa = await mfaStatus(db, s.user.id, s.session.id);
    staffMfa = !mfa.enrolled ? "setup" : mfa.verified ? "ok" : "verify";
    if (staffMfa !== "ok") profile = { ...profile, role: "member" };
  }

  return {
    userId: s.user.id,
    email: s.user.email,
    session: { id: s.session.id, createdAt: new Date(s.session.createdAt) },
    profile,
    realRole,
    staffMfa,
  };
});

export async function requireViewer(locale: Locale): Promise<ViewerContext> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  return viewer;
}

type Area = "member" | "responder" | "admin";

const AREA_CHECK = {
  member: canEnterMemberArea,
  responder: canEnterResponderArea,
  admin: canEnterAdminArea,
} as const;

/** Viewer who may enter `area`; otherwise redirect to where they belong. */
export async function requireArea(locale: Locale, area: Area): Promise<ViewerContext> {
  const viewer = await requireViewer(locale);
  if (!AREA_CHECK[area](viewer.profile)) {
    // Staff without a verified second factor go to the security page instead.
    if (area !== "member" && viewer.staffMfa && viewer.staffMfa !== "ok") {
      if (AREA_CHECK[area]({ ...viewer.profile, role: viewer.realRole })) redirect(`/${locale}/settings/security`);
    }
    const fallback = viewer.profile.status === "approved" ? "/home" : landingPathFor(viewer.profile.status);
    redirect(`/${locale}${fallback}`);
  }
  return viewer;
}

/** Sessions younger than this count as "fresh" for destructive actions. */
export const FRESH_SESSION_MS = 15 * 60_000;

export function isFreshSession(viewer: ViewerContext): boolean {
  return Date.now() - viewer.session.createdAt.getTime() < FRESH_SESSION_MS;
}
