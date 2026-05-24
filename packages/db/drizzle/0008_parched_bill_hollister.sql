CREATE TYPE "public"."recommendation_chat_message_role" AS ENUM('student', 'assistant');--> statement-breakpoint
CREATE TABLE "recommendation_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_chat_session_id" uuid NOT NULL,
	"role" "recommendation_chat_message_role" NOT NULL,
	"text" text NOT NULL,
	"rank_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"recommendation_run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendation_chat_messages" ADD CONSTRAINT "recommendation_chat_messages_recommendation_chat_session_id_recommendation_chat_sessions_id_fk" FOREIGN KEY ("recommendation_chat_session_id") REFERENCES "public"."recommendation_chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_chat_sessions" ADD CONSTRAINT "recommendation_chat_sessions_user_id_student_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."student_profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_chat_sessions" ADD CONSTRAINT "recommendation_chat_sessions_recommendation_run_id_recommendation_runs_id_fk" FOREIGN KEY ("recommendation_run_id") REFERENCES "public"."recommendation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_runs_id_user_id_idx" ON "recommendation_runs" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "recommendation_chat_sessions" ADD CONSTRAINT "recommendation_chat_sessions_run_owner_fk" FOREIGN KEY ("recommendation_run_id","user_id") REFERENCES "public"."recommendation_runs"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recommendation_chat_messages_session_id_idx" ON "recommendation_chat_messages" USING btree ("recommendation_chat_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_chat_messages_session_rank_idx" ON "recommendation_chat_messages" USING btree ("recommendation_chat_session_id","rank_order");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_chat_sessions_run_id_idx" ON "recommendation_chat_sessions" USING btree ("recommendation_run_id");--> statement-breakpoint
CREATE INDEX "recommendation_chat_sessions_user_id_idx" ON "recommendation_chat_sessions" USING btree ("user_id");
