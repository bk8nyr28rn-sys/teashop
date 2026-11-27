CREATE TYPE "public"."responder_application_status" AS ENUM('pending', 'approved', 'declined');--> statement-breakpoint
CREATE TABLE "qa_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"fee_percent" integer DEFAULT 20 NOT NULL,
	"answer_hours" integer DEFAULT 48 NOT NULL,
	"price_min_cents" integer DEFAULT 500 NOT NULL,
	"price_max_cents" integer DEFAULT 10000 NOT NULL,
	"max_open_per_asker" integer DEFAULT 3 NOT NULL,
	"overdue_warn_at" integer DEFAULT 2 NOT NULL,
	"overdue_pause_at" integer DEFAULT 3 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "qa_settings_singleton" CHECK ("qa_settings"."id" = 1),
	CONSTRAINT "qa_settings_fee" CHECK ("qa_settings"."fee_percent" between 0 and 50),
	CONSTRAINT "qa_settings_hours" CHECK ("qa_settings"."answer_hours" between 12 and 168),
	CONSTRAINT "qa_settings_prices" CHECK ("qa_settings"."price_min_cents" >= 100 and "qa_settings"."price_max_cents" >= "qa_settings"."price_min_cents"),
	CONSTRAINT "qa_settings_overdue" CHECK ("qa_settings"."overdue_warn_at" >= 1 and "qa_settings"."overdue_pause_at" >= "qa_settings"."overdue_warn_at")
);
--> statement-breakpoint
CREATE TABLE "responder_application" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"experience" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guidelines_accepted_at" timestamp with time zone NOT NULL,
	"status" "responder_application_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "answer_hours" integer DEFAULT 48 NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "refunded_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "close_reason" text;--> statement-breakpoint
ALTER TABLE "responder_profile" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "responder_profile" ADD COLUMN "pause_reason" text;--> statement-breakpoint
ALTER TABLE "responder_profile" ADD COLUMN "overdue_warned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qa_settings" ADD CONSTRAINT "qa_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responder_application" ADD CONSTRAINT "responder_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responder_application" ADD CONSTRAINT "responder_application_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "responder_application_one_pending" ON "responder_application" USING btree ("user_id") WHERE "responder_application"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_refund_le_price" CHECK ("question"."refunded_cents" between 0 and "question"."price_cents");