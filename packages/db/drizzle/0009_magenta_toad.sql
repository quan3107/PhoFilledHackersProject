ALTER TABLE "recommendation_results" ADD COLUMN "candidate_school_snapshot" jsonb;
--> statement-breakpoint
UPDATE "recommendation_results"
SET "candidate_school_snapshot" = jsonb_build_object(
  'universityId', "universities"."id",
  'schoolName', "universities"."school_name",
  'city', "universities"."city",
  'state', "universities"."state",
  'lastVerifiedAt', to_jsonb("universities"."last_verified_at"),
  'tuitionAnnualUsd', "universities"."tuition_annual_usd",
  'estimatedCostOfAttendanceUsd', "universities"."estimated_cost_of_attendance_usd",
  'livingCostEstimateUsd', "universities"."living_cost_estimate_usd",
  'scholarshipAvailabilityFlag', "universities"."scholarship_availability_flag",
  'scholarshipNotes', "universities"."scholarship_notes",
  'recommendationInputs', "universities"."recommendation_inputs",
  'explanationInputs', "universities"."explanation_inputs"
)
FROM "universities"
WHERE "recommendation_results"."university_id" = "universities"."id";
--> statement-breakpoint
ALTER TABLE "recommendation_results" ALTER COLUMN "candidate_school_snapshot" SET NOT NULL;
