CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."circle_member_status" AS ENUM('pending', 'active', 'banned');--> statement-breakpoint
CREATE TYPE "public"."circle_role" AS ENUM('member', 'moderator');--> statement-breakpoint
CREATE TYPE "public"."circle_visibility" AS ENUM('open', 'approval', 'invite');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('new', 'pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('member', 'responder', 'admin');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"answers" jsonb,
	"evidence_key" text,
	"evidence_expires_at" timestamp with time zone,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circle" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"visibility" "circle_visibility" DEFAULT 'approval' NOT NULL,
	"min_trust_level" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "circle_member" (
	"circle_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "circle_role" DEFAULT 'member' NOT NULL,
	"status" "circle_member_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "circle_member_circle_id_user_id_pk" PRIMARY KEY("circle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"code" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"max_uses" integer DEFAULT 1 NOT NULL,
	"uses" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_uses_le_max" CHECK ("invite"."uses" <= "invite"."max_uses")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"handle" text,
	"display_name" text,
	"pronouns" text,
	"role" "role" DEFAULT 'member' NOT NULL,
	"status" "membership_status" DEFAULT 'new' NOT NULL,
	"trust_level" integer DEFAULT 0 NOT NULL,
	"age_confirmed_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"invited_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_handle_unique" UNIQUE("handle"),
	CONSTRAINT "trust_level_range" CHECK ("profile"."trust_level" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_member" ADD CONSTRAINT "circle_member_circle_id_circle_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_member" ADD CONSTRAINT "circle_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "application_status_idx" ON "application" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "application_one_pending_per_user" ON "application" USING btree ("user_id") WHERE "application"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "audit_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "circle_member_user_idx" ON "circle_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invite_inviter_idx" ON "invite" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");