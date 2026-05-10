// packages/db/src/schema/universities.ts
// Catalog-facing university tables and enums for normalized school data.
// Keeps provenance and validation state explicit for later review and publish flows.

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

import {
  type DeadlinesByRound,
  type EnglishRequirements,
  type UniversityExplanationInputs,
  type UniversityRecommendationInputs,
  type UniversitySourceMetadata,
  type UniversityValidationReason,
  universitySourceKinds,
  universityValidationStatuses,
} from "./types.js";

export const universityValidationStatusEnum = pgEnum(
  "university_validation_status",
  universityValidationStatuses
);

export const universitySourceKindEnum = pgEnum(
  "university_source_kind",
  universitySourceKinds
);

export const universities = pgTable(
  "universities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolName: text("school_name").notNull(),
    city: text("city").notNull(),
    state: text("state").notNull(),
    officialAdmissionsUrl: text("official_admissions_url").notNull(),
    applicationRounds: jsonb("application_rounds")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    deadlinesByRound: jsonb("deadlines_by_round")
      .$type<DeadlinesByRound>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    englishRequirements: jsonb("english_requirements")
      .$type<EnglishRequirements>()
      .notNull(),
    testPolicy: text("test_policy").notNull(),
    requiredMaterials: jsonb("required_materials")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    tuitionAnnualUsd: integer("tuition_annual_usd").notNull(),
    estimatedCostOfAttendanceUsd: integer(
      "estimated_cost_of_attendance_usd"
    ).notNull(),
    livingCostEstimateUsd: integer("living_cost_estimate_usd").notNull(),
    scholarshipAvailabilityFlag: boolean(
      "scholarship_availability_flag"
    ).notNull(),
    scholarshipNotes: text("scholarship_notes").notNull(),
    recommendationInputs: jsonb("recommendation_inputs")
      .$type<UniversityRecommendationInputs>()
      .notNull(),
    explanationInputs: jsonb("explanation_inputs")
      .$type<UniversityExplanationInputs>()
      .notNull(),
    lastVerifiedAt: timestamp("last_verified_at", {
      withTimezone: true,
    }).notNull(),
    validationStatus: universityValidationStatusEnum("validation_status")
      .notNull()
      .default("draft"),
    validationReasons: jsonb("validation_reasons")
      .$type<UniversityValidationReason[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    validationStatusIdx: index("universities_validation_status_idx").on(
      table.validationStatus
    ),
    admissionsUrlIdx: uniqueIndex("universities_admissions_url_idx").on(
      table.officialAdmissionsUrl
    ),
  })
);

export const universitySources = pgTable(
  "university_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    universityId: uuid("university_id")
      .notNull()
      .references(() => universities.id, { onDelete: "cascade" }),
    sourceKind: universitySourceKindEnum("source_kind").notNull(),
    fieldKey: text("field_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    excerpt: text("excerpt"),
    lastVerifiedAt: timestamp("last_verified_at", {
      withTimezone: true,
    }).notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    metadata: jsonb("metadata")
      .$type<UniversitySourceMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    universityFieldSourceIdx: uniqueIndex(
      "university_sources_university_field_url_idx"
    ).on(table.universityId, table.fieldKey, table.sourceUrl),
    universityIdIdx: index("university_sources_university_id_idx").on(
      table.universityId
    ),
  })
);
