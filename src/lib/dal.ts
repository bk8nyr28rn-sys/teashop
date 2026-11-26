import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import type { Profile } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { getAuth } from "./auth";
import { ensureProfile } from "./membership";
import {
  canEnterAdminArea,
  canEnterMemberArea,
  canEnterResponderArea,
  landingPathFor,
} from "./permissions";

/**
 * Data Access Layer: the single place that turns the request's session cookie
 * into a viewer. Everything sensitive must go through here (or re-check in a
 * server action) — the proxy's cookie check is only a fast pre-filter.
 */

export type ViewerContext = { userId: string; profile: Profile };

export const getViewer = cache(async (): Promise<ViewerContext | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const profile = await ensureProfile(getDb(), session.user.id);
  return { userId: session.user.id, profile };
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
    const fallback = viewer.profile.status === "approved" ? "/home" : landingPathFor(viewer.profile.status);
    redirect(`/${locale}${fallback}`);
  }
  return viewer;
}
