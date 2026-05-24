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
  type RecommendationExplanationRecord,
  type RecommendationResultRecord,
  type RecommendationRunRecord,
  type RecommendationShortlistRecord,
  type StudentProfileSnapshotRecord,
} from "@etest/db";
import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { RecommendationCandidateSchool } from "./types.js";
import {
  toRecommendationResultRecord,
  toRecommendationRunRecord,
} from "./recommendation-row-mappers.js";

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

  const schools = run.results.map((result) => result.candidateSchoolSnapshot);

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
          recommendationResult: true,
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
      entry.recommendationResult.candidateSchoolSnapshot,
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
          entry.recommendationResult.candidateSchoolSnapshot,
      })),
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
      recommendationResult: RecommendationResultRow;
    }
  >;
}
