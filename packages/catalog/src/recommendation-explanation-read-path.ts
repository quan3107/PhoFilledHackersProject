// packages/catalog/src/recommendation-explanation-read-path.ts
// Read helpers for recommendation shortlist and explanation runs.
// Keeps the explanation layer grounded in stored run, result, and catalog rows.

import type * as dbSchema from "@etest/db";
import {
  recommendationExplanationShortlistItems,
  recommendationExplanations,
  recommendationResults,
  recommendationRuns,
  recommendationShortlists,
  studentProfileSnapshots,
  universities,
  type RecommendationExplanationRecord,
  type RecommendationResultRecord,
  type RecommendationRunRecord,
  type RecommendationShortlistRecord,
  type RecommendationScoringConfigSnapshot,
  type StudentProfileSnapshotRecord,
} from "@etest/db";
import { and, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { RecommendationCandidateSchool } from "./types.js";

export type RecommendationExplanationReadDb = PgDatabase<
  PgQueryResultHKT,
  typeof dbSchema
>;

type RecommendationRunRow = typeof recommendationRuns.$inferSelect;
type RecommendationResultRow = typeof recommendationResults.$inferSelect;
type RecommendationShortlistRow = typeof recommendationShortlists.$inferSelect;
type RecommendationExplanationRow =
  typeof recommendationExplanations.$inferSelect;
type RecommendationExplanationShortlistItemRow =
  typeof recommendationExplanationShortlistItems.$inferSelect;
type UniversityRow = typeof universities.$inferSelect;
type StudentProfileSnapshotRow = typeof studentProfileSnapshots.$inferSelect;

export interface RecommendationExplanationRunContext {
  recommendationRun: RecommendationRunRecord;
  currentSnapshot: StudentProfileSnapshotRecord;
  projectedSnapshot: StudentProfileSnapshotRecord | null;
  scoredResults: RecommendationResultRecord[];
  schools: RecommendationCandidateSchool[];
}

export interface PersistedRecommendationExplanationBundle {
  recommendationRun: RecommendationRunRecord;
  shortlist: RecommendationShortlistRecord | null;
  explanations: Array<
    RecommendationExplanationRecord & {
      recommendationResult: RecommendationResultRecord;
      school: RecommendationCandidateSchool;
    }
  >;
}

export class RecommendationExplanationLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationExplanationLookupError";
  }
}

export async function loadRecommendationExplanationRunContext(
  db: RecommendationExplanationReadDb,
  recommendationRunId: string
): Promise<RecommendationExplanationRunContext> {
  const run = (await db.query.recommendationRuns.findFirst({
    where: eq(recommendationRuns.id, recommendationRunId),
    with: {
      currentSnapshot: true,
      projectedSnapshot: true,
      results: {
        orderBy: (table, { asc }) => [asc(table.rankOrder)],
      },
    },
  })) as RecommendationRunQueryRow | undefined;

  if (!run) {
    throw new RecommendationExplanationLookupError(
      `Recommendation run ${recommendationRunId} was not found.`
    );
  }

  if (run.runStatus !== "succeeded") {
    throw new RecommendationExplanationLookupError(
      `Recommendation run ${recommendationRunId} is not eligible for explanation generation.`
    );
  }

  const schools = await loadPublishedCandidateSchoolsForResults(
    db,
    run.results
  );

  return {
    recommendationRun: toRecommendationRunRecord(run),
    currentSnapshot: toStudentProfileSnapshotRecord(run.currentSnapshot),
    projectedSnapshot: run.projectedSnapshot
      ? toStudentProfileSnapshotRecord(run.projectedSnapshot)
      : null,
    scoredResults: run.results.map(toRecommendationResultRecord),
    schools,
  };
}

export async function getPersistedRecommendationExplanationBundle(
  db: RecommendationExplanationReadDb,
  recommendationRunId: string
): Promise<PersistedRecommendationExplanationBundle | null> {
  const shortlist = (await db.query.recommendationShortlists.findFirst({
    where: eq(
      recommendationShortlists.recommendationRunId,
      recommendationRunId
    ),
    with: {
      recommendationRun: true,
      explanations: {
        with: {
          recommendationResult: {
            with: {
              university: true,
            },
          },
          shortlistItems: true,
        },
      },
    },
  })) as RecommendationShortlistQueryRow | undefined;

  if (!shortlist) {
    return null;
  }

  const resultById = new Map(
    shortlist.explanations.map((entry) => [
      entry.recommendationResult.id,
      toRecommendationResultRecord(entry.recommendationResult),
    ])
  );
  const schoolById = new Map(
    shortlist.explanations.map((entry) => [
      entry.recommendationResult.id,
      toRecommendationCandidateSchool(entry.recommendationResult.university),
    ])
  );
  const shortlistOrderByResultId = new Map(
    shortlist.explanations.flatMap((entry) =>
      entry.shortlistItems.map((item) => [
        item.recommendationResultId,
        item.rankOrder,
      ])
    )
  );

  return {
    recommendationRun: toRecommendationRunRecord(shortlist.recommendationRun),
    shortlist: toRecommendationShortlistRecord(shortlist),
    explanations: shortlist.explanations
      .slice()
      .sort((left, right) => {
        const leftIndex =
          shortlistOrderByResultId.get(left.recommendationResult.id) ??
          Number.MAX_SAFE_INTEGER;
        const rightIndex =
          shortlistOrderByResultId.get(right.recommendationResult.id) ??
          Number.MAX_SAFE_INTEGER;

        return leftIndex - rightIndex;
      })
      .map((entry) => ({
        ...toRecommendationExplanationRecord(entry),
        recommendationResult:
          resultById.get(entry.recommendationResult.id) ??
          toRecommendationResultRecord(entry.recommendationResult),
        school:
          schoolById.get(entry.recommendationResult.id) ??
          toRecommendationCandidateSchool(
            entry.recommendationResult.university
          ),
      })),
  };
}

async function loadPublishedCandidateSchoolsForResults(
  db: RecommendationExplanationReadDb,
  results: RecommendationResultRow[]
): Promise<RecommendationCandidateSchool[]> {
  if (results.length === 0) {
    return [];
  }

  const universityIds = results.map((result) => result.universityId);
  const schools = (await db.query.universities.findMany({
    where: and(
      eq(universities.validationStatus, "publishable"),
      inArray(universities.id, universityIds)
    ),
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
      validationStatus: true,
    },
  })) as UniversityRowWithStatus[];

  if (schools.length !== universityIds.length) {
    throw new RecommendationExplanationLookupError(
      "One or more explanation candidate schools could not be loaded from the published catalog."
    );
  }

  const schoolById = new Map(
    schools.map((school) => [
      school.id,
      toRecommendationCandidateSchool(school),
    ])
  );

  return universityIds.map((universityId) => {
    const school = schoolById.get(universityId);

    if (!school) {
      throw new RecommendationExplanationLookupError(
        `Published candidate school ${universityId} could not be resolved.`
      );
    }

    return school;
  });
}

function toRecommendationRunRecord(
  row: RecommendationRunRow
): RecommendationRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    studentProfileId: row.studentProfileId,
    currentSnapshotId: row.currentSnapshotId,
    projectedSnapshotId: row.projectedSnapshotId,
    runStatus: row.runStatus,
    scoringConfigSnapshot:
      row.scoringConfigSnapshot as RecommendationScoringConfigSnapshot,
    missingProfileFields: row.missingProfileFields,
    candidateSchoolCount: row.candidateSchoolCount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function toRecommendationResultRecord(
  row: RecommendationResultRow
): RecommendationResultRecord {
  return {
    id: row.id,
    recommendationRunId: row.recommendationRunId,
    universityId: row.universityId,
    tier: row.tier,
    currentOutlook: row.currentOutlook,
    projectedOutlook: row.projectedOutlook,
    confidenceLevel: row.confidenceLevel,
    budgetFit: row.budgetFit,
    deadlinePressure: row.deadlinePressure,
    currentScore: row.currentScore,
    projectedScore: row.projectedScore,
    currentScoreBreakdown: row.currentScoreBreakdown,
    projectedScoreBreakdown: row.projectedScoreBreakdown ?? null,
    projectedAssumptionDelta: row.projectedAssumptionDelta,
    rankOrder: row.rankOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecommendationShortlistRecord(
  row: RecommendationShortlistQueryRow
): RecommendationShortlistRecord {
  return {
    id: row.id,
    recommendationRunId: row.recommendationRunId,
    model: row.model,
    promptVersion: row.promptVersion,
    systemPrompt: row.systemPrompt,
    shortlistedRecommendationResultIds: row.explanations
      .flatMap((entry) => entry.shortlistItems)
      .sort((left, right) => left.rankOrder - right.rankOrder)
      .map((item) => item.recommendationResultId),
    shortlistRationale: row.shortlistRationale,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecommendationExplanationRecord(
  row: RecommendationExplanationRow
): RecommendationExplanationRecord {
  return {
    id: row.id,
    recommendationShortlistId: row.recommendationShortlistId,
    recommendationResultId: row.recommendationResultId,
    whyRecommended: row.whyRecommended,
    topBlockers: row.topBlockers,
    nextRecommendedActions: row.nextRecommendedActions,
    budgetSummary: row.budgetSummary,
    assumptionChanges: row.assumptionChanges,
    explanationConfidence: row.explanationConfidence,
    createdAt: row.createdAt.toISOString(),
  };
}

function toStudentProfileSnapshotRecord(
  row: StudentProfileSnapshotRow
): StudentProfileSnapshotRecord {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    snapshotKind: row.snapshotKind,
    assumptions: row.assumptions,
    profile: row.profile,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecommendationCandidateSchool(
  row: UniversityRow
): RecommendationCandidateSchool {
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
    recommendationInputs: row.recommendationInputs,
    explanationInputs: row.explanationInputs,
  };
}

interface RecommendationRunQueryRow extends RecommendationRunRow {
  currentSnapshot: StudentProfileSnapshotRow;
  projectedSnapshot: StudentProfileSnapshotRow | null;
  results: RecommendationResultRow[];
}

interface RecommendationShortlistQueryRow extends RecommendationShortlistRow {
  recommendationRun: RecommendationRunRow;
  explanations: Array<
    RecommendationExplanationRow & {
      shortlistItems: RecommendationExplanationShortlistItemRow[];
      recommendationResult: RecommendationResultRow & {
        university: UniversityRow;
      };
    }
  >;
}

interface UniversityRowWithStatus extends UniversityRow {
  validationStatus: "draft" | "publishable" | "rejected";
}
