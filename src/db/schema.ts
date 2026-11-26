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
  (t) => [
    index("invite_inviter_idx").on(t.inviterId),
    check("invite_uses_le_max", sql`${t.uses} <= ${t.maxUses}`),
  ],
);

export const applicationStatusEnum = pgEnum("application_status", [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);

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
