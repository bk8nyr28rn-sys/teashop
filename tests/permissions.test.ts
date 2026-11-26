import { describe, expect, it } from "vitest";
import {
  can,
  canEnterAdminArea,
  canEnterResponderArea,
  canModerateCircle,
  circleJoinOutcome,
  earnedTrustLevel,
  landingPathFor,
  type Viewer,
} from "@/lib/permissions";

const member = (over: Partial<Viewer> = {}): Viewer => ({ role: "member", status: "approved", trustLevel: 0, ...over });

describe("can()", () => {
  it("denies everything to non-approved users", () => {
    for (const status of ["new", "pending", "rejected", "suspended"] as const) {
      expect(can(member({ status, trustLevel: 3 }), "browse")).toBe(false);
    }
    expect(can(null, "browse")).toBe(false);
  });

  it("gates capabilities by trust level", () => {
    expect(can(member({ trustLevel: 0 }), "comment")).toBe(true);
    expect(can(member({ trustLevel: 0 }), "post")).toBe(false);
    expect(can(member({ trustLevel: 1 }), "post")).toBe(true);
    expect(can(member({ trustLevel: 1 }), "directMessage")).toBe(false);
    expect(can(member({ trustLevel: 2 }), "createInvite")).toBe(true);
  });

  it("lets approved admins do everything but not suspended admins", () => {
    expect(can(member({ role: "admin" }), "createInvite")).toBe(true);
    expect(can(member({ role: "admin", status: "suspended" }), "browse")).toBe(false);
  });
});

describe("areas", () => {
  it("responder desk is for responders and admins only", () => {
    expect(canEnterResponderArea(member())).toBe(false);
    expect(canEnterResponderArea(member({ role: "responder" }))).toBe(true);
    expect(canEnterResponderArea(member({ role: "responder", status: "suspended" }))).toBe(false);
    expect(canEnterResponderArea(member({ role: "admin" }))).toBe(true);
  });

  it("admin area is for admins only", () => {
    expect(canEnterAdminArea(member({ role: "responder" }))).toBe(false);
    expect(canEnterAdminArea(member({ role: "admin" }))).toBe(true);
    expect(canEnterAdminArea(null)).toBe(false);
  });

  it("routes each status to its landing page", () => {
    expect(landingPathFor("new")).toBe("/onboarding");
    expect(landingPathFor("rejected")).toBe("/onboarding");
    expect(landingPathFor("pending")).toBe("/pending");
    expect(landingPathFor("approved")).toBe("/home");
    expect(landingPathFor("suspended")).toBe("/suspended");
  });
});

describe("earnedTrustLevel()", () => {
  it("promotes with time and contributions", () => {
    expect(earnedTrustLevel(0, { daysSinceApproval: 1, contributions: 0, upheldReports: 0 })).toBe(0);
    expect(earnedTrustLevel(0, { daysSinceApproval: 3, contributions: 0, upheldReports: 0 })).toBe(1);
    expect(earnedTrustLevel(0, { daysSinceApproval: 14, contributions: 4, upheldReports: 0 })).toBe(1);
    expect(earnedTrustLevel(0, { daysSinceApproval: 14, contributions: 5, upheldReports: 0 })).toBe(2);
    expect(earnedTrustLevel(0, { daysSinceApproval: 90, contributions: 30, upheldReports: 0 })).toBe(3);
  });

  it("upheld reports block promotion but never auto-demote", () => {
    expect(earnedTrustLevel(0, { daysSinceApproval: 90, contributions: 99, upheldReports: 1 })).toBe(0);
    expect(earnedTrustLevel(2, { daysSinceApproval: 90, contributions: 99, upheldReports: 1 })).toBe(2);
  });

  it("clamps bad stored values", () => {
    expect(earnedTrustLevel(9, { daysSinceApproval: 0, contributions: 0, upheldReports: 0 })).toBe(3);
    expect(earnedTrustLevel(-1, { daysSinceApproval: 0, contributions: 0, upheldReports: 0 })).toBe(0);
  });
});

describe("circleJoinOutcome()", () => {
  const open = { visibility: "open" as const, minTrustLevel: 0 };
  const approval = { visibility: "approval" as const, minTrustLevel: 1 };
  const inviteOnly = { visibility: "invite" as const, minTrustLevel: 0 };

  it("handles existing memberships first", () => {
    expect(circleJoinOutcome(member(), open, { status: "active" })).toBe("already-member");
    expect(circleJoinOutcome(member(), open, { status: "pending" })).toBe("already-requested");
    expect(circleJoinOutcome(member(), open, { status: "banned" })).toBe("banned");
  });

  it("applies visibility and trust", () => {
    expect(circleJoinOutcome(member(), open, null)).toBe("join");
    expect(circleJoinOutcome(member({ trustLevel: 0 }), approval, null)).toBe("trust-too-low");
    expect(circleJoinOutcome(member({ trustLevel: 1 }), approval, null)).toBe("request");
    expect(circleJoinOutcome(member({ trustLevel: 3 }), inviteOnly, null)).toBe("invite-only");
    expect(circleJoinOutcome(member({ role: "admin" }), approval, null)).toBe("request");
    expect(circleJoinOutcome(member({ status: "pending" }), open, null)).toBe("denied");
  });
});

describe("canModerateCircle()", () => {
  it("requires an active moderator membership or admin", () => {
    expect(canModerateCircle(member(), { role: "moderator", status: "active" })).toBe(true);
    expect(canModerateCircle(member(), { role: "moderator", status: "banned" })).toBe(false);
    expect(canModerateCircle(member(), { role: "member", status: "active" })).toBe(false);
    expect(canModerateCircle(member({ role: "admin" }), null)).toBe(true);
    expect(canModerateCircle(member({ status: "suspended" }), { role: "moderator", status: "active" })).toBe(false);
  });
});
