"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import type { ReportTarget } from "@/db/schema";
import { hasLocale } from "@/i18n/config";
import { getViewer } from "@/lib/dal";
import {
  banFromCircle,
  unbanFromCircle,
  createComment,
  createPost,
  createReport,
  decideJoinRequest,
  deleteOwn,
  joinCircle,
  leaveCircle,
  moderatorRemove,
  resolveReport,
  setModerator,
  type CommunityError,
} from "@/lib/community";

/** Every action re-resolves the viewer; the domain layer re-checks permissions. */
async function actor(locale: string) {
  if (!hasLocale(locale)) throw new Error("Unsupported locale");
  const viewer = await getViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  return viewer;
}

const isTarget = (t: string): t is ReportTarget => t === "post" || t === "comment";

export type FormState = { error?: CommunityError; done?: boolean; values?: Record<string, string> } | undefined;

/* ------------------------------ Forms ------------------------------ */

export async function createPostAction(
  locale: string,
  circleId: string,
  slug: string,
  _p: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await actor(locale);
  const title = String(fd.get("title") ?? "");
  const body = String(fd.get("body") ?? "");
  const res = await createPost(getDb(), a, { circleId, title, body });
  if (!res.ok) return { error: res.error, values: { title, body } };
  redirect(`/${locale}/c/${slug}/p/${res.id}`);
}

export async function createCommentAction(
  locale: string,
  postId: string,
  _p: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await actor(locale);
  const body = String(fd.get("body") ?? "");
  const res = await createComment(getDb(), a, { postId, body });
  if (!res.ok) return { error: res.error, values: { body } };
  refresh();
  return { done: true };
}

export async function reportAction(
  locale: string,
  targetType: string,
  targetId: string,
  _p: FormState,
  fd: FormData,
): Promise<FormState> {
  const a = await actor(locale);
  if (!isTarget(targetType)) return { error: "invalid-input" };
  const res = await createReport(getDb(), a, {
    targetType,
    targetId,
    reason: String(fd.get("reason") ?? ""),
    details: String(fd.get("details") ?? ""),
  });
  return res.ok ? { done: true } : { error: res.error };
}

/* ----------------------------- Buttons ----------------------------- */

export async function joinAction(locale: string, circleId: string) {
  await joinCircle(getDb(), await actor(locale), circleId);
  refresh();
}

export async function leaveAction(locale: string, circleId: string) {
  await leaveCircle(getDb(), await actor(locale), circleId);
  refresh();
}

/** Server Action arguments are client-controlled: build redirect paths here, never accept one. */
export async function deleteOwnAction(locale: string, target: string, id: string, backToCircleSlug?: string) {
  if (!isTarget(target)) return;
  const res = await deleteOwn(getDb(), await actor(locale), target, id);
  if (res.ok && backToCircleSlug) redirect(`/${locale}/c/${encodeURIComponent(backToCircleSlug)}`);
  refresh();
}

export async function moderatorRemoveAction(locale: string, target: string, id: string) {
  if (!isTarget(target)) return;
  await moderatorRemove(getDb(), await actor(locale), target, id);
  refresh();
}

export async function decideJoinAction(locale: string, circleId: string, userId: string, approve: boolean) {
  await decideJoinRequest(getDb(), await actor(locale), { circleId, userId, approve });
  refresh();
}

export async function resolveReportAction(locale: string, reportId: string, decision: "upheld" | "dismissed") {
  if (decision !== "upheld" && decision !== "dismissed") return;
  await resolveReport(getDb(), await actor(locale), { reportId, decision });
  refresh();
}

export async function setModeratorAction(locale: string, circleId: string, userId: string, moderator: boolean) {
  await setModerator(getDb(), await actor(locale), { circleId, userId, moderator });
  refresh();
}

export async function banAction(locale: string, circleId: string, userId: string) {
  await banFromCircle(getDb(), await actor(locale), { circleId, userId });
  refresh();
}

export async function unbanAction(locale: string, circleId: string, userId: string) {
  await unbanFromCircle(getDb(), await actor(locale), { circleId, userId });
  refresh();
}
