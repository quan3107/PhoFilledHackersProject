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
  const config = !overrides
    ? defaultRecommendationEngineScoringConfig
    : {
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
            ...defaultRecommendationEngineScoringConfig.budgetFit
              .componentScores,
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

  validateRecommendationEngineScoringConfig(config);
  return config;
}

export class RecommendationEngineScoringConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationEngineScoringConfigError";
  }
}

export function validateRecommendationEngineScoringConfig(
  config: RecommendationEngineScoringConfig
) {
  const numbers: Array<[string, number]> = [
    ["admissionFit.defaultScore", config.admissionFit.defaultScore],
    [
      "admissionFit.testingRequiredNoSubmissionPenalty",
      config.admissionFit.testingRequiredNoSubmissionPenalty,
    ],
    ["readinessFit.perReadyItem", config.readinessFit.perReadyItem],
    ["readinessFit.noEarlyRoundBonus", config.readinessFit.noEarlyRoundBonus],
    [
      "readinessFit.earlyRoundReadyBonus",
      config.readinessFit.earlyRoundReadyBonus,
    ],
    [
      "readinessFit.earlyRoundReadyThreshold",
      config.readinessFit.earlyRoundReadyThreshold,
    ],
    ["preferenceFit.majorMatchScore", config.preferenceFit.majorMatchScore],
    [
      "preferenceFit.majorFallbackScore",
      config.preferenceFit.majorFallbackScore,
    ],
    ["preferenceFit.stateMatchScore", config.preferenceFit.stateMatchScore],
    ["preferenceFit.localeMatchScore", config.preferenceFit.localeMatchScore],
    [
      "preferenceFit.schoolControlMatchScore",
      config.preferenceFit.schoolControlMatchScore,
    ],
    ["preferenceFit.sizeMatchScore", config.preferenceFit.sizeMatchScore],
    [
      "improvementUpside.gpaDeltaDivisor",
      config.improvementUpside.gpaDeltaDivisor,
    ],
    [
      "improvementUpside.assumptionBonusCap",
      config.improvementUpside.assumptionBonusCap,
    ],
    ["studentIndex.gpaMultiplier", config.studentIndex.gpaMultiplier],
    ["studentIndex.satPointsMax", config.studentIndex.satPointsMax],
    ["studentIndex.actPointsMax", config.studentIndex.actPointsMax],
    [
      "schoolIndex.admissionRateNullScore",
      config.schoolIndex.admissionRateNullScore,
    ],
    [
      "schoolIndex.admissionRateMinScore",
      config.schoolIndex.admissionRateMinScore,
    ],
    [
      "schoolIndex.admissionRateMaxScore",
      config.schoolIndex.admissionRateMaxScore,
    ],
    ["schoolIndex.satScoreMin", config.schoolIndex.satScoreMin],
    ["schoolIndex.satScoreMax", config.schoolIndex.satScoreMax],
    ["schoolIndex.actScoreMin", config.schoolIndex.actScoreMin],
    ["schoolIndex.actScoreMax", config.schoolIndex.actScoreMax],
    ["tierThresholds.safetyMin", config.tierThresholds.safetyMin],
    ["tierThresholds.targetMin", config.tierThresholds.targetMin],
    ["outlookThresholds.very_strong", config.outlookThresholds.very_strong],
    ["outlookThresholds.strong", config.outlookThresholds.strong],
    ["outlookThresholds.possible", config.outlookThresholds.possible],
    ["outlookThresholds.stretch", config.outlookThresholds.stretch],
    ["sizeBuckets.smallMaxExclusive", config.sizeBuckets.smallMaxExclusive],
    ["sizeBuckets.mediumMaxInclusive", config.sizeBuckets.mediumMaxInclusive],
  ];

  for (const [field, value] of numbers) {
    assertFiniteNumber(field, value);
  }
  for (const [key, value] of Object.entries(
    config.studentIndex.curriculumBonuses
  )) {
    assertFiniteNumber(`studentIndex.curriculumBonuses.${key}`, value);
  }
  for (const [key, value] of Object.entries(config.budgetFit.componentScores)) {
    assertScore(`budgetFit.componentScores.${key}`, value);
  }
  for (const [index, band] of config.admissionFit.scoreByMinGap.entries()) {
    assertFiniteNumber(
      `admissionFit.scoreByMinGap.${index}.minGap`,
      band.minGap
    );
    assertScore(`admissionFit.scoreByMinGap.${index}.score`, band.score);
  }
  for (const [index, band] of config.studentIndex.classRankBands.entries()) {
    assertFiniteNumber(
      `studentIndex.classRankBands.${index}.maxPercentile`,
      band.maxPercentile
    );
    assertFiniteNumber(
      `studentIndex.classRankBands.${index}.bonus`,
      band.bonus
    );
  }

  if (config.improvementUpside.gpaDeltaDivisor === 0) {
    throw new RecommendationEngineScoringConfigError(
      "improvementUpside.gpaDeltaDivisor must be nonzero."
    );
  }
  assertDescending(
    "admissionFit.scoreByMinGap",
    config.admissionFit.scoreByMinGap.map((band) => band.minGap)
  );
  assertAscending(
    "studentIndex.classRankBands",
    config.studentIndex.classRankBands.map((band) => band.maxPercentile)
  );
  if (config.tierThresholds.safetyMin <= config.tierThresholds.targetMin) {
    throw new RecommendationEngineScoringConfigError(
      "tierThresholds must be ordered safetyMin > targetMin."
    );
  }
  assertDescending("outlookThresholds", [
    config.outlookThresholds.very_strong,
    config.outlookThresholds.strong,
    config.outlookThresholds.possible,
    config.outlookThresholds.stretch,
  ]);
  if (
    config.sizeBuckets.smallMaxExclusive <= 0 ||
    config.sizeBuckets.mediumMaxInclusive < config.sizeBuckets.smallMaxExclusive
  ) {
    throw new RecommendationEngineScoringConfigError(
      "sizeBuckets must be ordered and non-overlapping."
    );
  }
}

function assertFiniteNumber(field: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new RecommendationEngineScoringConfigError(
      `${field} must be a finite number.`
    );
  }
}

function assertScore(field: string, value: number) {
  assertFiniteNumber(field, value);
  if (value < 0 || value > 20) {
    throw new RecommendationEngineScoringConfigError(
      `${field} must be between 0 and 20.`
    );
  }
}

function assertDescending(field: string, values: number[]) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] >= values[index - 1]) {
      throw new RecommendationEngineScoringConfigError(
        `${field} must be sorted descending.`
      );
    }
  }
}

function assertAscending(field: string, values: number[]) {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] <= values[index - 1]) {
      throw new RecommendationEngineScoringConfigError(
        `${field} must be sorted ascending.`
      );
    }
  }
}
