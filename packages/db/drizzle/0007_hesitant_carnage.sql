CREATE TABLE "recommendation_explanation_shortlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recommendation_explanation_id" uuid NOT NULL,
	"recommendation_result_id" uuid NOT NULL,
	"rank_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recommendation_explanation_shortlist_items" ADD CONSTRAINT "recommendation_explanation_shortlist_items_recommendation_explanation_id_recommendation_explanations_id_fk" FOREIGN KEY ("recommendation_explanation_id") REFERENCES "public"."recommendation_explanations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_explanation_shortlist_items" ADD CONSTRAINT "recommendation_explanation_shortlist_items_recommendation_result_id_recommendation_results_id_fk" FOREIGN KEY ("recommendation_result_id") REFERENCES "public"."recommendation_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_explanation_shortlist_items_rank_idx" ON "recommendation_explanation_shortlist_items" USING btree ("recommendation_explanation_id","rank_order");--> statement-breakpoint
CREATE UNIQUE INDEX "recommendation_explanation_shortlist_items_result_idx" ON "recommendation_explanation_shortlist_items" USING btree ("recommendation_explanation_id","recommendation_result_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_profiles_id_user_id_idx" ON "student_profiles" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_profile_owner_fk" FOREIGN KEY ("student_profile_id","user_id") REFERENCES "public"."student_profiles"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "recommendation_explanation_shortlist_items" (
	"recommendation_explanation_id",
	"recommendation_result_id",
	"rank_order"
)
SELECT
	"recommendation_explanations"."id",
	"shortlist_items"."recommendation_result_id"::uuid,
	"shortlist_items"."rank_order"::integer
FROM "recommendation_shortlists"
CROSS JOIN LATERAL jsonb_array_elements_text(
	"recommendation_shortlists"."shortlisted_recommendation_result_ids"
) WITH ORDINALITY AS "shortlist_items"("recommendation_result_id", "rank_order")
INNER JOIN "recommendation_explanations"
	ON "recommendation_explanations"."recommendation_shortlist_id" = "recommendation_shortlists"."id"
	AND "recommendation_explanations"."recommendation_result_id" = "shortlist_items"."recommendation_result_id"::uuid;--> statement-breakpoint
ALTER TABLE "recommendation_shortlists" DROP COLUMN "shortlisted_recommendation_result_ids";
