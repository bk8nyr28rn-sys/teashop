import type { CircleVisibility, MembershipStatus, Role } from "@/db/schema";

/**
 * Permission rules, kept free of I/O so they can be unit-tested and shared by
 * pages, server actions and (later) API routes. Always enforce on the server.
 */

export type Viewer = {
  role: Role;
  status: MembershipStatus;
  trustLevel: number;
};

/* ----------------------------- Trust levels ----------------------------- */

/**
 * 0 Newcomer – read, comment
 * 1 Member   – create posts, request to join approval circles
 * 2 Regular  – direct messages, create invite codes
 * 3 Trusted  – eligible to be nominated as circle moderator
 */
export const TRUST_LEVELS = [0, 1, 2, 3] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

export type Capability =
  "browse" | "comment" | "post" | "requestCircle" | "directMessage" | "createInvite" | "moderateCandidate";

const REQUIRED_TRUST: Record<Capability, TrustLevel> = {
  browse: 0,
  comment: 0,
  post: 1,
  requestCircle: 1,
  directMessage: 2,
  createInvite: 2,
  moderateCandidate: 3,
};

export function can(viewer: Viewer | null, capability: Capability): boolean {
  if (!viewer || viewer.status !== "approved") return false;
  if (viewer.role === "admin") return true;
  return viewer.trustLevel >= REQUIRED_TRUST[capability];
}

export type TrustSignals = {
  daysSinceApproval: number;
  /** Posts + comments that were not removed by moderators. */
  contributions: number;
  /** Reports against this member that moderators upheld. */
  upheldReports: number;
};

/**
 * Trust level a member has earned. Never demotes below `current` on its own —
 * demotion is an explicit moderator action — but upheld reports block promotion.
 */
export function earnedTrustLevel(current: number, s: TrustSignals): TrustLevel {
  let earned: TrustLevel = 0;
  if (s.upheldReports === 0) {
    if (s.daysSinceApproval >= 3) earned = 1;
    if (s.daysSinceApproval >= 14 && s.contributions >= 5) earned = 2;
    if (s.daysSinceApproval >= 60 && s.contributions >= 30) earned = 3;
  }
  return Math.max(clampTrust(current), earned) as TrustLevel;
}

function clampTrust(n: number): TrustLevel {
  return Math.min(3, Math.max(0, Math.trunc(n))) as TrustLevel;
}

/* ----------------------------- Rate limits ------------------------------ */

/** Max new items per rolling 24h by trust level (index = level). Admins: unlimited. */
export const DAILY_LIMITS = {
  post: [0, 5, 20, 50],
  comment: [10, 50, 200, 500],
} as const;

export function dailyLimit(viewer: Viewer, kind: keyof typeof DAILY_LIMITS): number {
  if (viewer.role === "admin") return Number.POSITIVE_INFINITY;
  return DAILY_LIMITS[kind][clampTrust(viewer.trustLevel)];
}

/* ------------------------------- Areas ---------------------------------- */

export function canEnterMemberArea(viewer: Viewer | null): boolean {
  return viewer?.status === "approved";
}

export function canEnterResponderArea(viewer: Viewer | null): boolean {
  return canEnterMemberArea(viewer) && (viewer!.role === "responder" || viewer!.role === "admin");
}

export function canEnterAdminArea(viewer: Viewer | null): boolean {
  return canEnterMemberArea(viewer) && viewer!.role === "admin";
}

/** Where a signed-in user should land based on their membership state. */
export function landingPathFor(status: MembershipStatus): "/onboarding" | "/pending" | "/home" | "/suspended" {
  switch (status) {
    case "new":
    case "rejected":
      return "/onboarding";
    case "pending":
      return "/pending";
    case "approved":
      return "/home";
    case "suspended":
      return "/suspended";
  }
}

/* ------------------------------- Circles -------------------------------- */

export type CircleJoinOutcome =
  "already-member" | "already-requested" | "join" | "request" | "invite-only" | "trust-too-low" | "banned" | "denied";

export function circleJoinOutcome(
  viewer: Viewer | null,
  circle: { visibility: CircleVisibility; minTrustLevel: number },
  membership: { status: "pending" | "active" | "banned" } | null,
): CircleJoinOutcome {
  if (!canEnterMemberArea(viewer)) return "denied";
  if (membership?.status === "banned") return "banned";
  if (membership?.status === "active") return "already-member";
  if (membership?.status === "pending") return "already-requested";
  const isAdmin = viewer!.role === "admin";
  if (!isAdmin && viewer!.trustLevel < circle.minTrustLevel) return "trust-too-low";
  switch (circle.visibility) {
    case "open":
      return "join";
    case "approval":
      return isAdmin || can(viewer, "requestCircle") ? "request" : "trust-too-low";
    case "invite":
      return "invite-only";
  }
}

export function canModerateCircle(
  viewer: Viewer | null,
  membership: { role: "member" | "moderator"; status: "pending" | "active" | "banned" } | null,
): boolean {
  if (!canEnterMemberArea(viewer)) return false;
  if (viewer!.role === "admin") return true;
  return membership?.role === "moderator" && membership.status === "active";
}
