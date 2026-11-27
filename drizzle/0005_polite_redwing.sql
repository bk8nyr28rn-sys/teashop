CREATE TYPE "public"."question_status" AS ENUM('awaiting_payment', 'open', 'answered', 'expired', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TABLE "question" (
	"id" text PRIMARY KEY NOT NULL,
	"asker_id" text,
	"responder_id" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" "question_status" DEFAULT 'awaiting_payment' NOT NULL,
	"price_cents" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"crisis_flag" boolean DEFAULT false NOT NULL,
	"checkout_ref" text,
	"payment_ref" text,
	"authorized_at" timestamp with time zone,
	"deadline_at" timestamp with time zone,
	"answer" text,
	"answered_at" timestamp with time zone,
	"rating" integer,
	"feedback" text,
	"dispute_reason" text,
	"disputed_at" timestamp with time zone,
	"dispute_resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_checkout_ref_unique" UNIQUE("checkout_ref"),
	CONSTRAINT "question_payment_ref_unique" UNIQUE("payment_ref"),
	CONSTRAINT "question_rating_range" CHECK ("question"."rating" is null or "question"."rating" between 1 and 5),
	CONSTRAINT "question_fee_le_price" CHECK ("question"."fee_cents" between 0 and "question"."price_cents")
);
--> statement-breakpoint
CREATE TABLE "responder_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_cents" integer DEFAULT 1500 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"accepting" boolean DEFAULT false NOT NULL,
	"payout_account_id" text,
	"payouts_ready" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "responder_profile_payout_account_id_unique" UNIQUE("payout_account_id")
);
--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_asker_id_user_id_fk" FOREIGN KEY ("asker_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_responder_id_user_id_fk" FOREIGN KEY ("responder_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responder_profile" ADD CONSTRAINT "responder_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "question_responder_idx" ON "question" USING btree ("responder_id","status","deadline_at");--> statement-breakpoint
CREATE INDEX "question_asker_idx" ON "question" USING btree ("asker_id","created_at");--> statement-breakpoint
CREATE INDEX "question_status_deadline_idx" ON "question" USING btree ("status","deadline_at");