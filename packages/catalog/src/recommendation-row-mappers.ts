import type {
  BudgetFitLabel,
  ConfidenceLevel,
  DeadlinePressureLabel,
  OutlookLabel,
  recommendationResults,
  recommendationRuns,
  RecommendationResultRecord,
  RecommendationRunRecord,
  RecommendationRunStatus,
  RecommendationScoringConfigSnapshot,
  RecommendationTier,
} from "@etest/db";

type RecommendationRunRow = typeof recommendationRuns.$inferSelect;
type RecommendationResultRow = typeof recommendationResults.$inferSelect;

export function toRecommendationRunRecord(
  row: RecommendationRunRow
): RecommendationRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    studentProfileId: row.studentProfileId,
    currentSnapshotId: row.currentSnapshotId,
    projectedSnapshotId: row.projectedSnapshotId,
    runStatus: row.runStatus as RecommendationRunStatus,
    scoringConfigSnapshot:
      row.scoringConfigSnapshot as RecommendationScoringConfigSnapshot,
    missingProfileFields: row.missingProfileFields,
    candidateSchoolCount: row.candidateSchoolCount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

export function toRecommendationResultRecord(
  row: RecommendationResultRow
): RecommendationResultRecord {
  return {
    id: row.id,
    recommendationRunId: row.recommendationRunId,
    universityId: row.universityId,
    tier: row.tier as RecommendationTier,
    currentOutlook: row.currentOutlook as OutlookLabel,
    projectedOutlook: row.projectedOutlook as OutlookLabel | null,
    confidenceLevel: row.confidenceLevel as ConfidenceLevel,
    budgetFit: row.budgetFit as BudgetFitLabel,
    deadlinePressure: row.deadlinePressure as DeadlinePressureLabel,
    currentScore: row.currentScore,
    projectedScore: row.projectedScore,
    currentScoreBreakdown: row.currentScoreBreakdown,
    projectedScoreBreakdown: row.projectedScoreBreakdown ?? null,
    projectedAssumptionDelta: row.projectedAssumptionDelta,
    candidateSchoolSnapshot: row.candidateSchoolSnapshot,
    rankOrder: row.rankOrder,
    createdAt: row.createdAt.toISOString(),
  };
}
