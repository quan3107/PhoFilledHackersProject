// packages/catalog/src/recommendation-engine.ts
// Deterministic recommendation engine for persisted run/result generation.
// Keeps published-school reads, scoring, and persistence on one canonical server path.

import type * as dbSchema from "@etest/db";
import {
  recommendationResults,
  recommendationRuns,
  studentLocationPreferenceStateGroups,
  type BudgetFitLabel,
  type ConfidenceLevel,
  type DeadlinePressureLabel,
  type OutlookLabel,
  type RecommendationResultRecord,
  type RecommendationRunRecord,
  type RecommendationTier,
  type RecommendationRunStatus,
  type ScoreComponentBreakdown,
  type StudentProfileMissingField,
  type StudentProfileRecord,
} from "@etest/db";
import { eq } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgDatabase } from "drizzle-orm/pg-core";

import type { RecommendationCandidateSchool } from "./types.js";
import {
  resolveRecommendationEngineScoringConfig,
  type RecommendationEngineScoringConfig,
  type RecommendationEngineScoringConfigOverrides,
} from "./recommendation-engine-config.js";
import { listRecommendationCandidateSchools } from "./recommendation-catalog-read-path.js";

export type RecommendationEngineDb = PgDatabase<
  PgQueryResultHKT,
  typeof dbSchema
>;

export interface RecommendationEngineProfileState {
  profile: {
    id: string;
    userId: string;
  } | null;
  snapshots: {
    current: {
      id: string | null;
      assumptions: string[];
      profile: StudentProfileRecord | null;
    };
    projected: {
      id: string | null;
      assumptions: string[];
      profile: StudentProfileRecord | null;
    };
  };
  missingFields: StudentProfileMissingField[];
}

export interface RecommendationEngineResult {
  run: RecommendationRunRecord;
  results: RecommendationResultRecord[];
}

export class RecommendationEngineInputError extends Error {
  readonly missingFields: StudentProfileMissingField[];

  constructor(message: string, missingFields: StudentProfileMissingField[]) {
    super(message);
    this.name = "RecommendationEngineInputError";
    this.missingFields = missingFields;
  }
}

export async function runRecommendationEngineForUser(input: {
  db: RecommendationEngineDb;
  userId: string;
  profileState: RecommendationEngineProfileState;
  scoringConfig?: RecommendationEngineScoringConfigOverrides;
}): Promise<RecommendationEngineResult> {
  const { db, userId, profileState } = input;
  const scoringConfig = resolveRecommendationEngineScoringConfig(
    input.scoringConfig
  );
  const currentSnapshot = profileState.snapshots.current;
  const projectedSnapshot = profileState.snapshots.projected;

  if (
    !profileState.profile ||
    !currentSnapshot.id ||
    !currentSnapshot.profile
  ) {
    throw new RecommendationEngineInputError(
      "A saved current profile snapshot is required before a recommendation run can start.",
      profileState.missingFields
    );
  }

  const missingProfileFields = profileState.missingFields.map(
    (field) => `${field.snapshotKind}.${field.path}`
  );
  const profile = profileState.profile;
  const currentSnapshotId = currentSnapshot.id;
  const currentProfile = currentSnapshot.profile;

  if (profileState.missingFields.length > 0) {
    return db.transaction(async (tx) => {
      const [pendingRun] = await tx
        .insert(recommendationRuns)
        .values({
          userId,
          studentProfileId: profile.id,
          currentSnapshotId,
          projectedSnapshotId: projectedSnapshot.id ?? undefined,
          runStatus: "pending",
          scoringConfigSnapshot: scoringConfig,
          missingProfileFields,
          candidateSchoolCount: 0,
        })
        .returning();

      const [failedRun] = await tx
        .update(recommendationRuns)
        .set({
          runStatus: "failed",
          candidateSchoolCount: 0,
          finishedAt: new Date(),
        })
        .where(eq(recommendationRuns.id, pendingRun.id))
        .returning();

      return {
        run: toRecommendationRunRecord(failedRun),
        results: [],
      };
    });
  }

  const candidateSchools = await listRecommendationCandidateSchools(db);
  const projectedEnabled =
    Boolean(projectedSnapshot.id) &&
    Boolean(projectedSnapshot.profile) &&
    projectedSnapshot.profile?.academic.projectedGpa100 !== null &&
    projectedSnapshot.assumptions.length > 0;

  const scoredSchools = candidateSchools
    .map((school) =>
      scoreCandidateSchool({
        school,
        currentProfile,
        projectedProfile: projectedEnabled ? projectedSnapshot.profile : null,
        currentAssumptions: currentSnapshot.assumptions,
        projectedAssumptions: projectedSnapshot.assumptions,
        scoringConfig,
      })
    )
    .sort((left, right) => {
      if (right.currentScore !== left.currentScore) {
        return right.currentScore - left.currentScore;
      }

      if ((right.projectedScore ?? -1) !== (left.projectedScore ?? -1)) {
        return (right.projectedScore ?? -1) - (left.projectedScore ?? -1);
      }

      return left.school.schoolName.localeCompare(right.school.schoolName);
    });

  return db.transaction(async (tx) => {
    const [pendingRun] = await tx
      .insert(recommendationRuns)
      .values({
        userId,
        studentProfileId: profile.id,
        currentSnapshotId,
        projectedSnapshotId: projectedSnapshot.id ?? undefined,
        runStatus: "pending",
        scoringConfigSnapshot: scoringConfig,
        missingProfileFields,
        candidateSchoolCount: 0,
      })
      .returning();

    const insertedResults = scoredSchools.length
      ? await tx
          .insert(recommendationResults)
          .values(
            scoredSchools.map((result, index) => ({
              recommendationRunId: pendingRun.id,
              universityId: result.school.universityId,
              tier: result.tier,
              currentOutlook: result.currentOutlook,
              projectedOutlook: result.projectedOutlook,
              confidenceLevel: result.confidenceLevel,
              budgetFit: result.budgetFit,
              deadlinePressure: result.deadlinePressure,
              currentScore: result.currentScore,
              projectedScore: result.projectedScore,
              currentScoreBreakdown: result.currentScoreBreakdown,
              projectedScoreBreakdown: result.projectedScoreBreakdown,
              projectedAssumptionDelta: result.projectedAssumptionDelta,
              rankOrder: index + 1,
            }))
          )
          .returning()
      : [];

    const [succeededRun] = await tx
      .update(recommendationRuns)
      .set({
        runStatus: "succeeded",
        candidateSchoolCount: scoredSchools.length,
        finishedAt: new Date(),
      })
      .where(eq(recommendationRuns.id, pendingRun.id))
      .returning();

    return {
      run: toRecommendationRunRecord(succeededRun),
      results: insertedResults
        .sort((left, right) => left.rankOrder - right.rankOrder)
        .map(toRecommendationResultRecord),
    };
  });
}

function scoreCandidateSchool(input: {
  school: RecommendationCandidateSchool;
  currentProfile: StudentProfileRecord;
  projectedProfile: StudentProfileRecord | null;
  currentAssumptions: string[];
  projectedAssumptions: string[];
  scoringConfig: RecommendationEngineScoringConfig;
}) {
  const currentScoreBreakdown = scoreBreakdown({
    school: input.school,
    profile: input.currentProfile,
    scoringConfig: input.scoringConfig,
    improvementUpside: scoreImprovementUpside({
      currentProfile: input.currentProfile,
      projectedProfile: input.projectedProfile,
      projectedAssumptions: input.projectedAssumptions,
      scoringConfig: input.scoringConfig,
    }),
  });

  const currentScore = totalBreakdown(currentScoreBreakdown);
  const projectedScoreBreakdown = input.projectedProfile
    ? scoreBreakdown({
        school: input.school,
        profile: input.projectedProfile,
        scoringConfig: input.scoringConfig,
        improvementUpside: 0,
      })
    : null;
  const projectedScore = projectedScoreBreakdown
    ? totalBreakdown(projectedScoreBreakdown)
    : null;

  return {
    school: input.school,
    tier: scoreToTier(currentScore, input.scoringConfig),
    currentOutlook: scoreToOutlook(currentScore, input.scoringConfig),
    projectedOutlook:
      projectedScore === null
        ? null
        : scoreToOutlook(projectedScore, input.scoringConfig),
    confidenceLevel: scoreConfidenceLevel(input.school),
    budgetFit: scoreBudgetLabel(
      input.school,
      input.currentProfile,
      input.scoringConfig
    ),
    deadlinePressure: scoreDeadlinePressure(input.currentProfile),
    currentScore,
    projectedScore,
    currentScoreBreakdown,
    projectedScoreBreakdown,
    projectedAssumptionDelta: differenceAssumptions(
      input.currentAssumptions,
      input.projectedAssumptions
    ),
  };
}

function scoreBreakdown(input: {
  school: RecommendationCandidateSchool;
  profile: StudentProfileRecord;
  scoringConfig: RecommendationEngineScoringConfig;
  improvementUpside: number;
}): ScoreComponentBreakdown {
  return {
    admissionFit: scoreAdmissionFit(
      input.school,
      input.profile,
      input.scoringConfig
    ),
    readinessFit: scoreReadinessFit(input.profile, input.scoringConfig),
    budgetFit: scoreBudgetComponent(
      input.school,
      input.profile,
      input.scoringConfig
    ),
    preferenceFit: scorePreferenceFit(
      input.school,
      input.profile,
      input.scoringConfig
    ),
    improvementUpside: clampScore(input.improvementUpside),
  };
}

function scoreAdmissionFit(
  school: RecommendationCandidateSchool,
  profile: StudentProfileRecord,
  scoringConfig: RecommendationEngineScoringConfig
) {
  const studentIndex = scoreStudentIndex(profile, scoringConfig);
  const schoolIndex = scoreSchoolIndex(school, scoringConfig);
  let score = scoringConfig.admissionFit.defaultScore;
  const gap = studentIndex - schoolIndex;

  for (const band of scoringConfig.admissionFit.scoreByMinGap) {
    if (gap >= band.minGap) {
      score = band.score;
      break;
    }
  }

  const testingRequired =
    school.recommendationInputs.testingRequirements.minimumSatTotal !== null ||
    school.recommendationInputs.testingRequirements.minimumActComposite !==
      null;

  if (testingRequired && profile.testing.willSubmitTests === false) {
    score -= scoringConfig.admissionFit.testingRequiredNoSubmissionPenalty;
  }

  return clampScore(score);
}

function scoreReadinessFit(
  profile: StudentProfileRecord,
  scoringConfig: RecommendationEngineScoringConfig
) {
  const readinessValues = [
    profile.readiness.hasTeacherRecommendationsReady,
    profile.readiness.hasCounselorDocumentsReady,
    profile.readiness.hasEssayDraftsStarted,
  ];
  const readyCount = readinessValues.filter(Boolean).length;
  let score = readyCount * scoringConfig.readinessFit.perReadyItem;

  if (profile.readiness.wantsEarlyRound === false) {
    score += scoringConfig.readinessFit.noEarlyRoundBonus;
  } else if (
    profile.readiness.wantsEarlyRound === true &&
    readyCount >= scoringConfig.readinessFit.earlyRoundReadyThreshold
  ) {
    score += scoringConfig.readinessFit.earlyRoundReadyBonus;
  }

  return clampScore(score);
}

function scoreBudgetComponent(
  school: RecommendationCandidateSchool,
  profile: StudentProfileRecord,
  scoringConfig: RecommendationEngineScoringConfig
) {
  return budgetLabelToComponent(
    scoreBudgetLabel(school, profile, scoringConfig),
    scoringConfig
  );
}

function scorePreferenceFit(
  school: RecommendationCandidateSchool,
  profile: StudentProfileRecord,
  scoringConfig: RecommendationEngineScoringConfig
) {
  let score = 0;
  const schoolTags = new Set(
    school.recommendationInputs.programFitTags.map(normalizeToken)
  );
  const intendedMajors = profile.preferences.intendedMajors.map(normalizeToken);

  if (intendedMajors.some((major) => schoolTags.has(major))) {
    score += scoringConfig.preferenceFit.majorMatchScore;
  } else if (schoolTags.size > 0) {
    score += scoringConfig.preferenceFit.majorFallbackScore;
  }

  if (profile.preferences.preferredStates.includes(school.state)) {
    score += scoringConfig.preferenceFit.stateMatchScore;
  } else if (
    profile.preferences.preferredLocationPreferences.some((kind) =>
      studentLocationPreferenceStateGroups[kind]?.includes(school.state)
    )
  ) {
    score += scoringConfig.preferenceFit.stateMatchScore;
  }

  const campusLocale = normalizeToken(school.recommendationInputs.campusLocale);
  if (
    campusLocale &&
    profile.preferences.preferredCampusLocale
      .map(normalizeToken)
      .includes(campusLocale)
  ) {
    score += scoringConfig.preferenceFit.localeMatchScore;
  }

  if (
    school.recommendationInputs.schoolControl !== "private_for_profit" &&
    school.recommendationInputs.schoolControl !== "unknown" &&
    profile.preferences.preferredSchoolControl.includes(
      school.recommendationInputs.schoolControl
    )
  ) {
    score += scoringConfig.preferenceFit.schoolControlMatchScore;
  }

  if (
    school.recommendationInputs.undergraduateSize !== null &&
    schoolSizeBucket(
      school.recommendationInputs.undergraduateSize,
      scoringConfig
    ) === profile.preferences.preferredUndergraduateSize
  ) {
    score += scoringConfig.preferenceFit.sizeMatchScore;
  }

  return clampScore(score);
}

function scoreImprovementUpside(input: {
  currentProfile: StudentProfileRecord;
  projectedProfile: StudentProfileRecord | null;
  projectedAssumptions: string[];
  scoringConfig: RecommendationEngineScoringConfig;
}) {
  if (
    !input.projectedProfile ||
    input.projectedProfile.academic.projectedGpa100 === null ||
    input.currentProfile.academic.currentGpa100 === null
  ) {
    return 0;
  }

  const gpaDelta =
    input.projectedProfile.academic.projectedGpa100 -
    input.currentProfile.academic.currentGpa100;
  const assumptionBonus = Math.min(
    input.scoringConfig.improvementUpside.assumptionBonusCap,
    input.projectedAssumptions.length
  );

  return clampScore(
    Math.max(
      0,
      Math.round(
        gpaDelta / input.scoringConfig.improvementUpside.gpaDeltaDivisor
      )
    ) + assumptionBonus
  );
}

function scoreStudentIndex(
  profile: StudentProfileRecord,
  scoringConfig: RecommendationEngineScoringConfig
) {
  const gpaScore =
    (profile.academic.currentGpa100 ?? 0) *
    scoringConfig.studentIndex.gpaMultiplier;
  const curriculumBonus =
    profile.academic.curriculumStrength === "most_rigorous"
      ? scoringConfig.studentIndex.curriculumBonuses.most_rigorous
      : profile.academic.curriculumStrength === "rigorous"
        ? scoringConfig.studentIndex.curriculumBonuses.rigorous
        : profile.academic.curriculumStrength === "baseline"
          ? scoringConfig.studentIndex.curriculumBonuses.baseline
          : scoringConfig.studentIndex.curriculumBonuses.unknown;
  const classRankBonus =
    profile.academic.classRankPercent === null
      ? 0
      : (scoringConfig.studentIndex.classRankBands.find(
          (band) =>
            (profile.academic.classRankPercent ?? Number.POSITIVE_INFINITY) <=
            band.maxPercentile
        )?.bonus ?? 0);
  const satScore =
    profile.testing.satTotal === null
      ? 0
      : ((profile.testing.satTotal - 800) / 800) *
        scoringConfig.studentIndex.satPointsMax;
  const actScore =
    profile.testing.actComposite === null
      ? 0
      : ((profile.testing.actComposite - 15) / 21) *
        scoringConfig.studentIndex.actPointsMax;

  return clampToRange(
    Math.round(
      gpaScore + curriculumBonus + classRankBonus + Math.max(satScore, actScore)
    ),
    0,
    100
  );
}

function scoreSchoolIndex(
  school: RecommendationCandidateSchool,
  scoringConfig: RecommendationEngineScoringConfig
) {
  const admissionRateScore =
    school.recommendationInputs.admissionRateOverall === null
      ? scoringConfig.schoolIndex.admissionRateNullScore
      : clampToRange(
          Math.round(
            (1 - school.recommendationInputs.admissionRateOverall) * 100
          ),
          scoringConfig.schoolIndex.admissionRateMinScore,
          scoringConfig.schoolIndex.admissionRateMaxScore
        );
  const satScore =
    school.recommendationInputs.satAverageOverall === null
      ? 0
      : clampToRange(
          Math.round(
            ((school.recommendationInputs.satAverageOverall - 800) / 800) * 100
          ),
          scoringConfig.schoolIndex.satScoreMin,
          scoringConfig.schoolIndex.satScoreMax
        );
  const actScore =
    school.recommendationInputs.actMidpointCumulative === null
      ? 0
      : clampToRange(
          Math.round(
            ((school.recommendationInputs.actMidpointCumulative - 15) / 21) *
              100
          ),
          scoringConfig.schoolIndex.actScoreMin,
          scoringConfig.schoolIndex.actScoreMax
        );

  if (
    school.recommendationInputs.satAverageOverall === null &&
    school.recommendationInputs.actMidpointCumulative === null
  ) {
    return admissionRateScore;
  }

  return Math.round((admissionRateScore + Math.max(satScore, actScore)) / 2);
}

function scoreBudgetLabel(
  school: RecommendationCandidateSchool,
  profile: StudentProfileRecord,
  scoringConfig: RecommendationEngineScoringConfig
): BudgetFitLabel {
  const budget = profile.budget.annualBudgetUsd;

  if (budget === null) {
    return "unknown";
  }

  const totalCost = school.estimatedCostOfAttendanceUsd;
  const netPrice = school.recommendationInputs.averageNetPriceUsd ?? totalCost;

  if (budget >= totalCost) {
    return "comfortable";
  }

  const aidAvailable =
    school.recommendationInputs.hasNeedBasedAid === true ||
    school.recommendationInputs.hasMeritAid === true ||
    school.scholarshipAvailabilityFlag;
  const flexibilityBuffer =
    profile.budget.budgetFlexibility === "high"
      ? scoringConfig.budgetFit.flexibilityBufferHigh
      : profile.budget.budgetFlexibility === "medium"
        ? scoringConfig.budgetFit.flexibilityBufferMedium
        : 0;
  const effectiveBudget = budget + flexibilityBuffer;

  if (effectiveBudget >= netPrice && aidAvailable) {
    return "stretch";
  }

  if (
    effectiveBudget + scoringConfig.budgetFit.stretchCoaGapBuffer >=
      totalCost &&
    aidAvailable
  ) {
    return "stretch";
  }

  return "high_risk";
}

function budgetLabelToComponent(
  label: BudgetFitLabel,
  scoringConfig: RecommendationEngineScoringConfig
) {
  switch (label) {
    case "comfortable":
      return scoringConfig.budgetFit.componentScores.comfortable;
    case "stretch":
      return scoringConfig.budgetFit.componentScores.stretch;
    case "high_risk":
      return scoringConfig.budgetFit.componentScores.high_risk;
    default:
      return scoringConfig.budgetFit.componentScores.unknown;
  }
}

function scoreDeadlinePressure(
  profile: StudentProfileRecord
): DeadlinePressureLabel {
  const readyCount = [
    profile.readiness.hasTeacherRecommendationsReady,
    profile.readiness.hasCounselorDocumentsReady,
    profile.readiness.hasEssayDraftsStarted,
  ].filter(Boolean).length;

  if (profile.readiness.wantsEarlyRound && readyCount <= 1) {
    return "high";
  }

  if (profile.readiness.wantsEarlyRound || readyCount === 2) {
    return "medium";
  }

  return "low";
}

function scoreConfidenceLevel(
  school: RecommendationCandidateSchool
): ConfidenceLevel {
  let missingClusters = 0;

  if (
    school.recommendationInputs.admissionRateOverall === null &&
    school.recommendationInputs.satAverageOverall === null &&
    school.recommendationInputs.actMidpointCumulative === null
  ) {
    missingClusters += 1;
  }

  if (
    school.recommendationInputs.averageNetPriceUsd === null &&
    school.recommendationInputs.hasNeedBasedAid === null &&
    school.recommendationInputs.hasMeritAid === null
  ) {
    missingClusters += 1;
  }

  if (
    school.recommendationInputs.programFitTags.length === 0 ||
    school.recommendationInputs.campusLocale === null ||
    school.recommendationInputs.schoolControl === "unknown" ||
    school.recommendationInputs.undergraduateSize === null
  ) {
    missingClusters += 1;
  }

  if (missingClusters === 0) {
    return "high";
  }

  if (missingClusters === 1) {
    return "medium";
  }

  return "low";
}

function totalBreakdown(breakdown: ScoreComponentBreakdown) {
  return clampToRange(
    breakdown.admissionFit +
      breakdown.readinessFit +
      breakdown.budgetFit +
      breakdown.preferenceFit +
      breakdown.improvementUpside,
    0,
    100
  );
}

function scoreToTier(
  score: number,
  scoringConfig: RecommendationEngineScoringConfig
): RecommendationTier {
  if (score >= scoringConfig.tierThresholds.safetyMin) {
    return "safety";
  }

  if (score >= scoringConfig.tierThresholds.targetMin) {
    return "target";
  }

  return "reach";
}

function scoreToOutlook(
  score: number,
  scoringConfig: RecommendationEngineScoringConfig
): OutlookLabel {
  if (score >= scoringConfig.outlookThresholds.very_strong) {
    return "very_strong";
  }

  if (score >= scoringConfig.outlookThresholds.strong) {
    return "strong";
  }

  if (score >= scoringConfig.outlookThresholds.possible) {
    return "possible";
  }

  if (score >= scoringConfig.outlookThresholds.stretch) {
    return "stretch";
  }

  return "unlikely";
}

function schoolSizeBucket(
  size: number,
  scoringConfig: RecommendationEngineScoringConfig
) {
  if (size < scoringConfig.sizeBuckets.smallMaxExclusive) {
    return "small";
  }

  if (size <= scoringConfig.sizeBuckets.mediumMaxInclusive) {
    return "medium";
  }

  return "large";
}

function differenceAssumptions(current: string[], projected: string[]) {
  const currentSet = new Set(current.map(normalizeToken));

  return projected.filter(
    (assumption) => !currentSet.has(normalizeToken(assumption))
  );
}

function normalizeToken(value: string | null) {
  if (!value) {
    return "";
  }

  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function clampScore(score: number) {
  return clampToRange(Math.round(score), 0, 20);
}

function clampToRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRecommendationRunRecord(
  row: typeof recommendationRuns.$inferSelect
): RecommendationRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    studentProfileId: row.studentProfileId,
    currentSnapshotId: row.currentSnapshotId,
    projectedSnapshotId: row.projectedSnapshotId,
    runStatus: row.runStatus as RecommendationRunStatus,
    scoringConfigSnapshot: row.scoringConfigSnapshot,
    missingProfileFields: row.missingProfileFields,
    candidateSchoolCount: row.candidateSchoolCount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function toRecommendationResultRecord(
  row: typeof recommendationResults.$inferSelect
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
    projectedScoreBreakdown: row.projectedScoreBreakdown,
    projectedAssumptionDelta: row.projectedAssumptionDelta,
    rankOrder: row.rankOrder,
    createdAt: row.createdAt.toISOString(),
  };
}
