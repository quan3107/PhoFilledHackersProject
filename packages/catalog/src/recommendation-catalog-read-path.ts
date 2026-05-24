// packages/catalog/src/recommendation-catalog-read-path.ts
// Published-only catalog read helper for recommendation candidate selection.
// Keeps recommendation queries pinned to canonical university rows instead of raw import state.

import type * as dbSchema from "@etest/db";
import { universities } from "@etest/db";
import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core";

import type { RecommendationCandidateSchool } from "./types.js";
import { toRecommendationCandidateSchool } from "./catalog-row-mappers.js";

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

  return schools
    .map(toRecommendationCandidateSchool)
    .filter(
      (school) => isRecommendationReady(school) && isExplanationReady(school)
    );
}

export function isRecommendationReady(school: RecommendationCandidateSchool) {
  const inputs = school.recommendationInputs;

  return (
    inputs.admissionRateOverall !== null &&
    (inputs.satAverageOverall !== null ||
      inputs.actMidpointCumulative !== null ||
      inputs.testingRequirements.acceptedExams.length > 0) &&
    inputs.averageNetPriceUsd !== null &&
    inputs.schoolControl !== "unknown" &&
    inputs.campusLocale !== null &&
    inputs.programFitTags.length > 0 &&
    inputs.undergraduateSize !== null
  );
}

export function isExplanationReady(school: RecommendationCandidateSchool) {
  const inputs = school.explanationInputs;

  return (
    inputs.academicSelectivityBand !== "unknown" &&
    inputs.testingExpectation !== "unknown" &&
    inputs.aidModel !== "unknown" &&
    inputs.applicationComplexity !== "unknown" &&
    inputs.potentialFitTags.length > 0 &&
    inputs.actionableApplicationSteps.length > 0
  );
}
