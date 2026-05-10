// packages/catalog/src/recommendation-engine-config.ts
// Configurable scoring policy for the deterministic recommendation engine.
// Keeps thresholds and weights explicit so callers can override them safely.

import type { RecommendationScoringConfigSnapshot } from "@etest/db";

export type RecommendationEngineScoringConfig =
  RecommendationScoringConfigSnapshot;

export interface RecommendationEngineScoringConfigOverrides {
  admissionFit?: Partial<RecommendationEngineScoringConfig["admissionFit"]>;
  readinessFit?: Partial<RecommendationEngineScoringConfig["readinessFit"]>;
  preferenceFit?: Partial<RecommendationEngineScoringConfig["preferenceFit"]>;
  improvementUpside?: Partial<
    RecommendationEngineScoringConfig["improvementUpside"]
  >;
  studentIndex?: Partial<
    Omit<RecommendationEngineScoringConfig["studentIndex"], "curriculumBonuses">
  > & {
    curriculumBonuses?: Partial<
      RecommendationEngineScoringConfig["studentIndex"]["curriculumBonuses"]
    >;
  };
  schoolIndex?: Partial<RecommendationEngineScoringConfig["schoolIndex"]>;
  budgetFit?: Partial<
    Omit<RecommendationEngineScoringConfig["budgetFit"], "componentScores">
  > & {
    componentScores?: Partial<
      RecommendationEngineScoringConfig["budgetFit"]["componentScores"]
    >;
  };
  tierThresholds?: Partial<RecommendationEngineScoringConfig["tierThresholds"]>;
  outlookThresholds?: Partial<
    RecommendationEngineScoringConfig["outlookThresholds"]
  >;
  sizeBuckets?: Partial<RecommendationEngineScoringConfig["sizeBuckets"]>;
}

export const defaultRecommendationEngineScoringConfig: RecommendationEngineScoringConfig =
  {
    admissionFit: {
      defaultScore: 12,
      scoreByMinGap: [
        { minGap: 18, score: 20 },
        { minGap: 8, score: 17 },
        { minGap: -4, score: 14 },
        { minGap: -14, score: 10 },
        { minGap: -24, score: 6 },
        { minGap: -999, score: 2 },
      ],
      testingRequiredNoSubmissionPenalty: 6,
    },
    readinessFit: {
      perReadyItem: 5,
      noEarlyRoundBonus: 5,
      earlyRoundReadyBonus: 5,
      earlyRoundReadyThreshold: 2,
    },
    preferenceFit: {
      majorMatchScore: 8,
      majorFallbackScore: 2,
      stateMatchScore: 4,
      localeMatchScore: 3,
      schoolControlMatchScore: 2,
      sizeMatchScore: 3,
    },
    improvementUpside: {
      gpaDeltaDivisor: 1.5,
      assumptionBonusCap: 4,
    },
    studentIndex: {
      gpaMultiplier: 0.6,
      satPointsMax: 18,
      actPointsMax: 18,
      curriculumBonuses: {
        baseline: 5,
        rigorous: 10,
        most_rigorous: 14,
        unknown: 0,
      },
      classRankBands: [
        { maxPercentile: 5, bonus: 14 },
        { maxPercentile: 10, bonus: 11 },
        { maxPercentile: 20, bonus: 8 },
        { maxPercentile: 35, bonus: 4 },
      ],
    },
    schoolIndex: {
      admissionRateNullScore: 50,
      admissionRateMinScore: 10,
      admissionRateMaxScore: 95,
      satScoreMin: 0,
      satScoreMax: 100,
      actScoreMin: 0,
      actScoreMax: 100,
    },
    budgetFit: {
      flexibilityBufferHigh: 12000,
      flexibilityBufferMedium: 6000,
      stretchCoaGapBuffer: 5000,
      componentScores: {
        comfortable: 20,
        stretch: 11,
        high_risk: 4,
        unknown: 0,
      },
    },
    tierThresholds: {
      safetyMin: 80,
      targetMin: 60,
    },
    outlookThresholds: {
      very_strong: 85,
      strong: 70,
      possible: 55,
      stretch: 40,
    },
    sizeBuckets: {
      smallMaxExclusive: 5000,
      mediumMaxInclusive: 15000,
    },
  };

export function resolveRecommendationEngineScoringConfig(
  overrides?: RecommendationEngineScoringConfigOverrides
): RecommendationEngineScoringConfig {
  if (!overrides) {
    return defaultRecommendationEngineScoringConfig;
  }

  return {
    admissionFit: {
      ...defaultRecommendationEngineScoringConfig.admissionFit,
      ...overrides.admissionFit,
    },
    readinessFit: {
      ...defaultRecommendationEngineScoringConfig.readinessFit,
      ...overrides.readinessFit,
    },
    preferenceFit: {
      ...defaultRecommendationEngineScoringConfig.preferenceFit,
      ...overrides.preferenceFit,
    },
    improvementUpside: {
      ...defaultRecommendationEngineScoringConfig.improvementUpside,
      ...overrides.improvementUpside,
    },
    studentIndex: {
      ...defaultRecommendationEngineScoringConfig.studentIndex,
      ...overrides.studentIndex,
      curriculumBonuses: {
        ...defaultRecommendationEngineScoringConfig.studentIndex
          .curriculumBonuses,
        ...overrides.studentIndex?.curriculumBonuses,
      },
    },
    schoolIndex: {
      ...defaultRecommendationEngineScoringConfig.schoolIndex,
      ...overrides.schoolIndex,
    },
    budgetFit: {
      ...defaultRecommendationEngineScoringConfig.budgetFit,
      ...overrides.budgetFit,
      componentScores: {
        ...defaultRecommendationEngineScoringConfig.budgetFit.componentScores,
        ...overrides.budgetFit?.componentScores,
      },
    },
    tierThresholds: {
      ...defaultRecommendationEngineScoringConfig.tierThresholds,
      ...overrides.tierThresholds,
    },
    outlookThresholds: {
      ...defaultRecommendationEngineScoringConfig.outlookThresholds,
      ...overrides.outlookThresholds,
    },
    sizeBuckets: {
      ...defaultRecommendationEngineScoringConfig.sizeBuckets,
      ...overrides.sizeBuckets,
    },
  };
}
