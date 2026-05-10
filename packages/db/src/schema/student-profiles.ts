// packages/db/src/schema/student-profiles.ts
// Auth and student-profile tables for the persisted recommendation input path.
// Keeps profile ownership and reproducible snapshots in one canonical schema slice.

import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  budgetFlexibilities,
  englishExamTypes,
  preferredUndergraduateSizes,
  studentCurriculumStrengths,
  studentProfileSnapshotKinds,
  type StudentAcademicProfile,
  type StudentBudgetProfile,
  type StudentIntakeFieldStatusMap,
  type StudentIntakeMessageRecord,
  type StudentPreferenceProfile,
  type StudentProfileRecord,
  type StudentReadinessProfile,
  type StudentTestingProfile,
} from "./profile-types.js";

export const studentCurriculumStrengthEnum = pgEnum(
  "student_curriculum_strength",
  studentCurriculumStrengths
);

export const englishExamTypeEnum = pgEnum(
  "student_english_exam_type",
  englishExamTypes
);

export const preferredUndergraduateSizeEnum = pgEnum(
  "student_preferred_undergraduate_size",
  preferredUndergraduateSizes
);

export const budgetFlexibilityEnum = pgEnum(
  "student_budget_flexibility",
  budgetFlexibilities
);

export const studentProfileSnapshotKindEnum = pgEnum(
  "student_profile_snapshot_kind",
  studentProfileSnapshotKinds
);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(table.token),
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
  })
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    providerAccountIdx: uniqueIndex("accounts_provider_account_idx").on(
      table.providerId,
      table.accountId
    ),
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
  })
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    identifierValueIdx: uniqueIndex("verifications_identifier_value_idx").on(
      table.identifier,
      table.value
    ),
  })
);

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    citizenshipCountry: text("citizenship_country").notNull(),
    targetEntryTerm: text("target_entry_term").notNull(),
    academic: jsonb("academic")
      .$type<StudentAcademicProfile>()
      .notNull()
      .default(
        sql`'{"currentGpa100":null,"projectedGpa100":null,"curriculumStrength":"unknown","classRankPercent":null}'::jsonb`
      ),
    testing: jsonb("testing")
      .$type<StudentTestingProfile>()
      .notNull()
      .default(
        sql`'{"satTotal":null,"actComposite":null,"englishExamType":"unknown","englishExamScore":null,"willSubmitTests":null}'::jsonb`
      ),
    preferences: jsonb("preferences")
      .$type<StudentPreferenceProfile>()
      .notNull()
      .default(
        sql`'{"intendedMajors":[],"preferredStates":[],"preferredLocationPreferences":[],"preferredCampusLocale":[],"preferredSchoolControl":[],"preferredUndergraduateSize":"unknown"}'::jsonb`
      ),
    budget: jsonb("budget")
      .$type<StudentBudgetProfile>()
      .notNull()
      .default(
        sql`'{"annualBudgetUsd":null,"needsFinancialAid":null,"needsMeritAid":null,"budgetFlexibility":"unknown"}'::jsonb`
      ),
    readiness: jsonb("readiness")
      .$type<StudentReadinessProfile>()
      .notNull()
      .default(
        sql`'{"wantsEarlyRound":null,"hasTeacherRecommendationsReady":null,"hasCounselorDocumentsReady":null,"hasEssayDraftsStarted":null}'::jsonb`
      ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("student_profiles_user_id_idx").on(table.userId),
  })
);

export const studentProfileSnapshots = pgTable(
  "student_profile_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => studentProfiles.id, { onDelete: "cascade" }),
    snapshotKind: studentProfileSnapshotKindEnum("snapshot_kind").notNull(),
    assumptions: jsonb("assumptions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    profile: jsonb("profile").$type<StudentProfileRecord>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    profileIdIdx: index("student_profile_snapshots_profile_id_idx").on(
      table.studentProfileId
    ),
    profileKindIdx: uniqueIndex(
      "student_profile_snapshots_profile_kind_idx"
    ).on(table.studentProfileId, table.snapshotKind),
  })
);

export const studentIntakeSessions = pgTable(
  "student_intake_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentStepIndex: integer("current_step_index").notNull().default(0),
    conversationDone: boolean("conversation_done").notNull().default(false),
    previousResponseId: text("previous_response_id"),
    fieldStatuses: jsonb("field_statuses")
      .$type<StudentIntakeFieldStatusMap>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    outstandingFields: jsonb("outstanding_fields")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    progressCompletedCount: integer("progress_completed_count")
      .notNull()
      .default(0),
    progressTotalCount: integer("progress_total_count").notNull().default(0),
    messages: jsonb("messages")
      .$type<StudentIntakeMessageRecord[]>()
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
    userIdIdx: uniqueIndex("student_intake_sessions_user_id_idx").on(
      table.userId
    ),
    updatedAtIdx: index("student_intake_sessions_updated_at_idx").on(
      table.updatedAt
    ),
  })
);
