// packages/db/src/schema/recommendations.ts
// Recommendation run/result tables for the deterministic scoring engine.
// Keeps persisted scoring history in the db package so downstream slices can read one canonical source.

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  budgetFitLabels,
  confidenceLevels,
  deadlinePressureLabels,
  outlookLabels,
  recommendationRunStatuses,
  recommendationTiers,
  type RecommendationScoringConfigSnapshot,
  type ScoreComponentBreakdown,
} from "./types.js";
import {
  studentProfileSnapshots,
  studentProfiles,
} from "./student-profiles.js";
import { universities } from "./universities.js";

export const recommendationRunStatusEnum = pgEnum(
  "recommendation_run_status",
  recommendationRunStatuses
);

export const recommendationTierEnum = pgEnum(
  "recommendation_tier",
  recommendationTiers
);

export const outlookLabelEnum = pgEnum(
  "recommendation_outlook_label",
  outlookLabels
);

export const budgetFitLabelEnum = pgEnum(
  "recommendation_budget_fit_label",
  budgetFitLabels
);

export const deadlinePressureLabelEnum = pgEnum(
  "recommendation_deadline_pressure_label",
  deadlinePressureLabels
);

export const confidenceLevelEnum = pgEnum(
  "recommendation_confidence_level",
  confidenceLevels
);

export const recommendationRuns = pgTable(
  "recommendation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => studentProfiles.userId, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    currentSnapshotId: uuid("current_snapshot_id")
      .notNull()
      .references(() => studentProfileSnapshots.id),
    projectedSnapshotId: uuid("projected_snapshot_id").references(
      () => studentProfileSnapshots.id
    ),
    runStatus: recommendationRunStatusEnum("run_status")
      .notNull()
      .default("pending"),
    scoringConfigSnapshot: jsonb("scoring_config_snapshot")
      .$type<RecommendationScoringConfigSnapshot>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    missingProfileFields: jsonb("missing_profile_fields")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    candidateSchoolCount: integer("candidate_school_count")
      .notNull()
      .default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => ({
    userIdIdx: index("recommendation_runs_user_id_idx").on(table.userId),
    studentProfileIdIdx: index("recommendation_runs_student_profile_id_idx").on(
      table.studentProfileId
    ),
    createdAtIdx: index("recommendation_runs_created_at_idx").on(
      table.createdAt
    ),
  })
);

export const recommendationResults = pgTable(
  "recommendation_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recommendationRunId: uuid("recommendation_run_id")
      .notNull()
      .references(() => recommendationRuns.id, { onDelete: "cascade" }),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id),
    tier: recommendationTierEnum("tier").notNull(),
    currentOutlook: outlookLabelEnum("current_outlook").notNull(),
    projectedOutlook: outlookLabelEnum("projected_outlook"),
    confidenceLevel: confidenceLevelEnum("confidence_level").notNull(),
    budgetFit: budgetFitLabelEnum("budget_fit").notNull(),
    deadlinePressure: deadlinePressureLabelEnum("deadline_pressure").notNull(),
    currentScore: integer("current_score").notNull(),
    projectedScore: integer("projected_score"),
    currentScoreBreakdown: jsonb("current_score_breakdown")
      .$type<ScoreComponentBreakdown>()
      .notNull(),
    projectedScoreBreakdown: jsonb(
      "projected_score_breakdown"
    ).$type<ScoreComponentBreakdown | null>(),
    projectedAssumptionDelta: jsonb("projected_assumption_delta")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    rankOrder: integer("rank_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    runIdIdx: index("recommendation_results_run_id_idx").on(
      table.recommendationRunId
    ),
    runRankIdx: uniqueIndex("recommendation_results_run_rank_idx").on(
      table.recommendationRunId,
      table.rankOrder
    ),
    runUniversityIdx: uniqueIndex(
      "recommendation_results_run_university_idx"
    ).on(table.recommendationRunId, table.universityId),
  })
);

export const recommendationShortlists = pgTable(
  "recommendation_shortlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recommendationRunId: uuid("recommendation_run_id")
      .notNull()
      .references(() => recommendationRuns.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    systemPrompt: text("system_prompt").notNull(),
    shortlistedRecommendationResultIds: jsonb(
      "shortlisted_recommendation_result_ids"
    )
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    shortlistRationale: jsonb("shortlist_rationale")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    runIdIdx: uniqueIndex("recommendation_shortlists_run_id_idx").on(
      table.recommendationRunId
    ),
  })
);

export const recommendationExplanations = pgTable(
  "recommendation_explanations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recommendationShortlistId: uuid("recommendation_shortlist_id")
      .notNull()
      .references(() => recommendationShortlists.id, { onDelete: "cascade" }),
    recommendationResultId: uuid("recommendation_result_id")
      .notNull()
      .references(() => recommendationResults.id, { onDelete: "cascade" }),
    whyRecommended: jsonb("why_recommended")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    topBlockers: jsonb("top_blockers")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    nextRecommendedActions: jsonb("next_recommended_actions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    budgetSummary: jsonb("budget_summary")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    assumptionChanges: jsonb("assumption_changes")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    explanationConfidence: confidenceLevelEnum(
      "explanation_confidence"
    ).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    shortlistIdIdx: index("recommendation_explanations_shortlist_id_idx").on(
      table.recommendationShortlistId
    ),
    resultIdIdx: uniqueIndex("recommendation_explanations_result_id_idx").on(
      table.recommendationResultId
    ),
  })
);
