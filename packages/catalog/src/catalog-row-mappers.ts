import {
  explanationInputsSchema,
  recommendationInputsSchema,
} from "@etest/api-contracts";
import type {
  universities,
  UniversityExplanationInputs,
  UniversityRecommendationInputs,
} from "@etest/db";

import type { RecommendationCandidateSchool } from "./types.js";

type UniversityCandidateRow = Pick<
  typeof universities.$inferSelect,
  | "id"
  | "schoolName"
  | "city"
  | "state"
  | "lastVerifiedAt"
  | "tuitionAnnualUsd"
  | "estimatedCostOfAttendanceUsd"
  | "livingCostEstimateUsd"
  | "scholarshipAvailabilityFlag"
  | "scholarshipNotes"
  | "recommendationInputs"
  | "explanationInputs"
>;

export class RecommendationCatalogRowValidationError extends Error {
  readonly universityId: string;
  readonly field: "recommendationInputs" | "explanationInputs";

  constructor(input: {
    universityId: string;
    field: "recommendationInputs" | "explanationInputs";
    message: string;
  }) {
    super(
      `University ${input.universityId} has invalid ${input.field}: ${input.message}`
    );
    this.name = "RecommendationCatalogRowValidationError";
    this.universityId = input.universityId;
    this.field = input.field;
  }
}

export function toRecommendationCandidateSchool(
  row: UniversityCandidateRow
): RecommendationCandidateSchool {
  const recommendationInputs = recommendationInputsSchema.safeParse(
    row.recommendationInputs
  );
  if (!recommendationInputs.success) {
    throw new RecommendationCatalogRowValidationError({
      universityId: row.id,
      field: "recommendationInputs",
      message: recommendationInputs.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join("; "),
    });
  }

  const explanationInputs = explanationInputsSchema.safeParse(
    row.explanationInputs
  );
  if (!explanationInputs.success) {
    throw new RecommendationCatalogRowValidationError({
      universityId: row.id,
      field: "explanationInputs",
      message: explanationInputs.error.issues
        .map((issue) => issue.path.join(".") || issue.message)
        .join("; "),
    });
  }

  return {
    universityId: row.id,
    schoolName: row.schoolName,
    city: row.city,
    state: row.state,
    lastVerifiedAt: row.lastVerifiedAt.toISOString(),
    tuitionAnnualUsd: row.tuitionAnnualUsd,
    estimatedCostOfAttendanceUsd: row.estimatedCostOfAttendanceUsd,
    livingCostEstimateUsd: row.livingCostEstimateUsd,
    scholarshipAvailabilityFlag: row.scholarshipAvailabilityFlag,
    scholarshipNotes: row.scholarshipNotes,
    recommendationInputs:
      recommendationInputs.data as UniversityRecommendationInputs,
    explanationInputs: explanationInputs.data as UniversityExplanationInputs,
  };
}
