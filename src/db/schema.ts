import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Better Auth core tables (names and columns follow Better Auth's     */
/* default schema). Only identity lives here — never community data.  */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ------------------------------------------------------------------ */
/* Community tables                                                    */
/* ------------------------------------------------------------------ */

/** Platform-wide role. Circle moderators are per-circle (see circleMember). */
export const roleEnum = pgEnum("role", ["member", "responder", "admin"]);

/**
 * new       – signed in, has not chosen invite / application yet
 * pending   – application submitted, waiting for review
 * approved  – full member of the community
 * rejected  – application declined (may re-apply later)
 * suspended – banned by an admin
 */
export const membershipStatusEnum = pgEnum("membership_status", [
  "new",
  "pending",
  "approved",
  "rejected",
  "suspended",
]);

/**
 * Public-facing persona. Deliberately has NO orientation / gender identity
 * column: belonging is expressed through circle membership only.
 */
export const profile = pgTable(
  "profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    handle: text("handle").unique(),
    displayName: text("display_name"),
    pronouns: text("pronouns"),
    role: roleEnum("role").notNull().default("member"),
    status: membershipStatusEnum("status").notNull().default("new"),
    trustLevel: integer("trust_level").notNull().default(0),
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    /** Preferred UI language ("en", "zh"…), for emails and for new devices. Null until known. */
    locale: text("locale"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("trust_level_range", sql`${t.trustLevel} between 0 and 3`)],
);

/** Localised text stored inline, e.g. { en: "Lounge", zh: "大厅" }. */
export type LocalizedText = { en: string; zh?: string };

/**
 * open     – any approved member can join
 * approval – members request to join, circle moderators review
 * invite   – only reachable through a moderator's invitation
 */
export const circleVisibilityEnum = pgEnum("circle_visibility", ["open", "approval", "invite"]);

export const circle = pgTable("circle", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: jsonb("name").$type<LocalizedText>().notNull(),
  description: jsonb("description").$type<LocalizedText>().notNull(),
  visibility: circleVisibilityEnum("visibility").notNull().default("approval"),
  /** Minimum trust level before a member may join or request to join. */
  minTrustLevel: integer("min_trust_level").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const circleRoleEnum = pgEnum("circle_role", ["member", "moderator"]);
export const circleMemberStatusEnum = pgEnum("circle_member_status", ["pending", "active", "banned"]);

export const circleMember = pgTable(
  "circle_member",
  {
    circleId: text("circle_id")
      .notNull()
      .references(() => circle.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: circleRoleEnum("role").notNull().default("member"),
    status: circleMemberStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.circleId, t.userId] }), index("circle_member_user_idx").on(t.userId)],
);

/** Community invite codes. Redeeming one approves the new member directly. */
export const invite = pgTable(
  "invite",
  {
    code: text("code").primaryKey(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("invite_inviter_idx").on(t.inviterId), check("invite_uses_le_max", sql`${t.uses} <= ${t.maxUses}`)],
);

export const applicationStatusEnum = pgEnum("application_status", ["pending", "approved", "rejected", "withdrawn"]);

/** Free-text answers to the join questions. Wiped once a decision is made. */
export type ApplicationAnswers = { questionId: string; answer: string }[];

export const application = pgTable(
  "application",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Null after review — answers are deleted, only the outcome is kept. */
    answers: jsonb("answers").$type<ApplicationAnswers>(),
    /** Storage key of the optional evidence screenshot (upload not wired yet). */
    evidenceKey: text("evidence_key"),
    /** Hard deadline: evidence is purged at this time even if never reviewed. */
    evidenceExpiresAt: timestamp("evidence_expires_at", { withTimezone: true }),
    status: applicationStatusEnum("status").notNull().default("pending"),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("application_status_idx").on(t.status, t.createdAt),
    // At most one open application per user.
    uniqueIndex("application_one_pending_per_user")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/* ------------------------------------------------------------------ */
/* Posts, comments, reports                                            */
/* ------------------------------------------------------------------ */

/** author: wiped by the author (text erased). moderator: hidden, text kept for appeals. */
export const removalEnum = pgEnum("removal", ["author", "moderator"]);

export const post = pgTable(
  "post",
  {
    id: text("id").primaryKey(),
    circleId: text("circle_id")
      .notNull()
      .references(() => circle.id, { onDelete: "cascade" }),
    /** Null once the author deletes their account (the text is wiped first). */
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by").references(() => user.id, { onDelete: "set null" }),
    removal: removalEnum("removal"),
  },
  (t) => [index("post_circle_idx").on(t.circleId, t.createdAt), index("post_author_idx").on(t.authorId, t.createdAt)],
);

export const comment = pgTable(
  "comment",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    /** Null once the author deletes their account (the text is wiped first). */
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by").references(() => user.id, { onDelete: "set null" }),
    removal: removalEnum("removal"),
  },
  (t) => [index("comment_post_idx").on(t.postId, t.createdAt), index("comment_author_idx").on(t.authorId, t.createdAt)],
);

export const reportTargetEnum = pgEnum("report_target", ["post", "comment"]);
export const reportReasonEnum = pgEnum("report_reason", [
  "harassment",
  "hate",
  "outing", // revealing someone's identity, doxxing, sharing screenshots
  "sexual",
  "spam",
  "self_harm",
  "other",
]);
export const reportStatusEnum = pgEnum("report_status", ["open", "upheld", "dismissed"]);

export const report = pgTable(
  "report",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id").references(() => user.id, { onDelete: "set null" }),
    targetType: reportTargetEnum("target_type").notNull(),
    targetId: text("target_id").notNull(),
    /** Denormalised so moderators can query their circle and trust can count per author. */
    circleId: text("circle_id")
      .notNull()
      .references(() => circle.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    details: text("details"),
    status: reportStatusEnum("status").notNull().default("open"),
    handledBy: text("handled_by").references(() => user.id, { onDelete: "set null" }),
    handledAt: timestamp("handled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("report_once_per_reporter").on(t.reporterId, t.targetType, t.targetId),
    index("report_circle_status_idx").on(t.circleId, t.status, t.createdAt),
    index("report_author_status_idx").on(t.authorId, t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Staff two-factor authentication                                     */
/* ------------------------------------------------------------------ */

/**
 * TOTP enrolment for staff (admins, responders). Better Auth's two-factor
 * plugin does not cover email-OTP sign-in, so step-up is enforced in the DAL.
 */
export const staffMfa = pgTable("staff_mfa", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** TOTP secret, encrypted with BETTER_AUTH_SECRET. */
  secretEnc: text("secret_enc").notNull(),
  /** Null while setup is pending confirmation. */
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  /** SHA-256 hashes of unused one-time backup codes. */
  backupCodeHashes: jsonb("backup_code_hashes").$type<string[]>().notNull().default([]),
  /** Highest TOTP time-step accepted so far — blocks code replay. */
  lastCounter: integer("last_counter").notNull().default(0),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sessions that passed the staff second factor. Dies with the session. */
export const mfaSession = pgTable("mfa_session", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => session.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Auth rate-limit counters shared by every server instance (serverless-safe).
 * Keys are HMAC hashes of "ip|path" — raw IP addresses are never written.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    keyHash: text("key_hash").primaryKey(),
    count: integer("count").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limit_window_idx").on(t.windowStart)],
);

/* ------------------------------------------------------------------ */
/* Paid Q&A                                                            */
/* ------------------------------------------------------------------ */

/** A responder's public card and payout setup. */
export const responderProfile = pgTable("responder_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  topics: jsonb("topics").$type<string[]>().notNull().default([]),
  languages: jsonb("languages").$type<string[]>().notNull().default([]),
  priceCents: integer("price_cents").notNull().default(1500),
  currency: text("currency").notNull().default("usd"),
  /** Responder-controlled availability switch. */
  accepting: boolean("accepting").notNull().default(false),
  /** Stripe Connect (Express) account; null until onboarding starts. */
  payoutAccountId: text("payout_account_id").unique(),
  /** True once the payment provider says the account can receive transfers. */
  payoutsReady: boolean("payouts_ready").notNull().default(false),
  /** Set when the team (or the missed-deadline rule) pauses this responder. */
  pausedAt: timestamp("paused_at", { withTimezone: true }),
  pauseReason: text("pause_reason").$type<"admin" | "overdue">(),
  /** Warned about missed deadlines; an automatic pause only ever follows a warning. */
  overdueWarnedAt: timestamp("overdue_warned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const responderApplicationStatusEnum = pgEnum("responder_application_status", [
  "pending",
  "approved",
  "declined",
]);

/** Members applying to become responders. The experience text is wiped once decided. */
export const responderApplication = pgTable(
  "responder_application",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    experience: text("experience"),
    topics: jsonb("topics").$type<string[]>().notNull().default([]),
    guidelinesAcceptedAt: timestamp("guidelines_accepted_at", { withTimezone: true }).notNull(),
    status: responderApplicationStatusEnum("status").notNull().default("pending"),
    reviewerId: text("reviewer_id").references(() => user.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("responder_application_one_pending")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

/**
 * Admin-editable Q&A settings (single row, id = 1). Changes only affect new
 * questions: price, fee and answer window are snapshotted onto each question.
 */
export const qaSettings = pgTable(
  "qa_settings",
  {
    id: integer("id").primaryKey().default(1),
    feePercent: integer("fee_percent").notNull().default(20),
    answerHours: integer("answer_hours").notNull().default(48),
    priceMinCents: integer("price_min_cents").notNull().default(500),
    priceMaxCents: integer("price_max_cents").notNull().default(10000),
    maxOpenPerAsker: integer("max_open_per_asker").notNull().default(3),
    /** Missed deadlines (30 days) that trigger a warning, then an automatic pause. */
    overdueWarnAt: integer("overdue_warn_at").notNull().default(2),
    overduePauseAt: integer("overdue_pause_at").notNull().default(3),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    check("qa_settings_singleton", sql`${t.id} = 1`),
    check("qa_settings_fee", sql`${t.feePercent} between 0 and 50`),
    check("qa_settings_hours", sql`${t.answerHours} between 12 and 168`),
    check("qa_settings_prices", sql`${t.priceMinCents} >= 100 and ${t.priceMaxCents} >= ${t.priceMinCents}`),
    check("qa_settings_overdue", sql`${t.overdueWarnAt} >= 1 and ${t.overduePauseAt} >= ${t.overdueWarnAt}`),
  ],
);

/**
 * awaiting_payment – created, checkout not completed yet
 * open             – card authorised (not charged); responder has until deadline
 * answered         – answer delivered and payment captured
 * expired          – deadline passed, authorisation released (never charged)
 * cancelled        – asker cancelled before an answer (never charged)
 * refunded         – captured, then refunded after a dispute
 */
export const questionStatusEnum = pgEnum("question_status", [
  "awaiting_payment",
  "open",
  "answered",
  "expired",
  "cancelled",
  "refunded",
]);

export const question = pgTable(
  "question",
  {
    id: text("id").primaryKey(),
    /** Null after the asker deletes their account (texts are wiped first). */
    askerId: text("asker_id").references(() => user.id, { onDelete: "set null" }),
    responderId: text("responder_id").references(() => user.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    status: questionStatusEnum("status").notNull().default("awaiting_payment"),
    priceCents: integer("price_cents").notNull(),
    feeCents: integer("fee_cents").notNull(),
    /** Answer window snapshotted from settings when the question was asked. */
    answerHours: integer("answer_hours").notNull().default(48),
    /** Total refunded so far (partial or full). */
    refundedCents: integer("refunded_cents").notNull().default(0),
    currency: text("currency").notNull(),
    /** Crisis language detected; asker saw crisis resources before paying. */
    crisisFlag: boolean("crisis_flag").notNull().default(false),
    checkoutRef: text("checkout_ref").unique(),
    paymentRef: text("payment_ref").unique(),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    answer: text("answer"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    rating: integer("rating"),
    feedback: text("feedback"),
    disputeReason: text("dispute_reason"),
    disputedAt: timestamp("disputed_at", { withTimezone: true }),
    disputeResolvedAt: timestamp("dispute_resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    /** Why an open question closed without an answer. Only "deadline" counts against the responder. */
    closeReason: text("close_reason").$type<"deadline" | "released" | "payment_failed" | "cancelled">(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("question_responder_idx").on(t.responderId, t.status, t.deadlineAt),
    index("question_asker_idx").on(t.askerId, t.createdAt),
    index("question_status_deadline_idx").on(t.status, t.deadlineAt),
    check("question_rating_range", sql`${t.rating} is null or ${t.rating} between 1 and 5`),
    check("question_fee_le_price", sql`${t.feeCents} between 0 and ${t.priceCents}`),
    check("question_refund_le_price", sql`${t.refundedCents} between 0 and ${t.priceCents}`),
  ],
);

/** Who did what, for moderation accountability (incl. every evidence view). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_target_idx").on(t.targetType, t.targetId)],
);

export type Profile = typeof profile.$inferSelect;
export type Circle = typeof circle.$inferSelect;
export type CircleMember = typeof circleMember.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type MembershipStatus = (typeof membershipStatusEnum.enumValues)[number];
export type CircleVisibility = (typeof circleVisibilityEnum.enumValues)[number];
export type Post = typeof post.$inferSelect;
export type Comment = typeof comment.$inferSelect;
export type ReportReason = (typeof reportReasonEnum.enumValues)[number];
export type ReportTarget = (typeof reportTargetEnum.enumValues)[number];
export type ResponderProfile = typeof responderProfile.$inferSelect;
export type Question = typeof question.$inferSelect;
export type QuestionStatus = (typeof questionStatusEnum.enumValues)[number];
export type QaSettings = typeof qaSettings.$inferSelect;
