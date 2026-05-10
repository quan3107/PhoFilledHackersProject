// packages/catalog/src/recommendation-catalog-read-path.ts
// Published-only catalog read helper for recommendation candidate selection.
// Keeps recommendation queries pinned to canonical university rows instead of raw import state.

import type * as dbSchema from "@etest/db";
import { universities } from "@etest/db";
import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core";

import type { RecommendationCandidateSchool } from "./types.js";

export type RecommendationCatalogReadDb = PgDatabase<
  PgQueryResultHKT,
  typeof dbSchema
>;

export async function listRecommendationCandidateSchools(
  db: RecommendationCatalogReadDb
): Promise<RecommendationCandidateSchool[]> {
  const schools = await db.query.universities.findMany({
    where: eq(universities.validationStatus, "publishable"),
    orderBy: (table, { asc }) => [asc(table.schoolName)],
    columns: {
      id: true,
      schoolName: true,
      city: true,
      state: true,
      lastVerifiedAt: true,
      tuitionAnnualUsd: true,
      estimatedCostOfAttendanceUsd: true,
      livingCostEstimateUsd: true,
      scholarshipAvailabilityFlag: true,
      scholarshipNotes: true,
      recommendationInputs: true,
      explanationInputs: true,
    },
  });

  return schools.map((school) => ({
    universityId: school.id,
    schoolName: school.schoolName,
    city: school.city,
    state: school.state,
    lastVerifiedAt: school.lastVerifiedAt.toISOString(),
    tuitionAnnualUsd: school.tuitionAnnualUsd,
    estimatedCostOfAttendanceUsd: school.estimatedCostOfAttendanceUsd,
    livingCostEstimateUsd: school.livingCostEstimateUsd,
    scholarshipAvailabilityFlag: school.scholarshipAvailabilityFlag,
    scholarshipNotes: school.scholarshipNotes,
    recommendationInputs: school.recommendationInputs,
    explanationInputs: school.explanationInputs,
  }));
}
