// packages/db/src/schema/types.ts
// Shared catalog and recommendation schema types for Drizzle tables and downstream packages.
// Keeps the database and domain packages aligned on one canonical field model.

import type {
  ApplicationRound as ContractApplicationRound,
  BudgetFit,
  CatalogRequiredField as ContractCatalogRequiredField,
  ConfidenceLevel as ContractConfidenceLevel,
  DeadlinePressure,
  RecommendationOutlook,
  RecommendationTier as ContractRecommendationTier,
  UniversitySourceKind as ContractUniversitySourceKind,
} from "@etest/api-contracts";

export {
  applicationRounds,
  budgetFits as budgetFitLabels,
  catalogRequiredFields,
  confidenceLevels,
  deadlinePressures as deadlinePressureLabels,
  recommendationOutlooks as outlookLabels,
  recommendationTiers,
  universitySourceKinds,
} from "@etest/api-contracts";

export type CatalogRequiredField = ContractCatalogRequiredField;

export const universityValidationStatuses = [
  "draft",
  "publishable",
  "rejected",
] as const;

export type UniversityValidationStatus =
  (typeof universityValidationStatuses)[number];

export type UniversitySourceKind = ContractUniversitySourceKind;

export const catalogImportStatuses = [
  "pending",
  "fetching",
  "extracting",
  "normalizing",
  "validating",
  "persisting",
  "succeeded",
  "failed",
] as const;

export type CatalogImportStatus = (typeof catalogImportStatuses)[number];

export const universityValidationReasonCodes = [
  "missing_required_field",
  "missing_source_provenance",
] as const;

export type UniversityValidationReasonCode =
  (typeof universityValidationReasonCodes)[number];

export type ApplicationRound = ContractApplicationRound;

export type DeadlinesByRound = Partial<Record<ApplicationRound, string>>;

export interface EnglishRequirements {
  minimumIelts: number | null;
  minimumToeflInternetBased: number | null;
  waiverNotes: string | null;
}

export const schoolControls = [
  "public",
  "private_nonprofit",
  "private_for_profit",
  "unknown",
] as const;

export type SchoolControl = (typeof schoolControls)[number];

export const internationalAidPolicies = [
  "meets_full_demonstrated_need_if_eligible",
  "need_based_aid_available",
  "merit_aid_available",
  "need_and_merit_available",
  "limited_or_unclear",
  "unknown",
] as const;

export type InternationalAidPolicy = (typeof internationalAidPolicies)[number];

export const standardizedTestExamKinds = ["sat", "act"] as const;

export type StandardizedTestExamKind =
  (typeof standardizedTestExamKinds)[number];

export const superscorePolicies = [
  "sat_only",
  "act_only",
  "both",
  "none",
  "unknown",
] as const;

export type SuperscorePolicy = (typeof superscorePolicies)[number];

export const writingEssayPolicies = [
  "required",
  "optional",
  "not_considered",
  "unknown",
] as const;

export type WritingEssayPolicy = (typeof writingEssayPolicies)[number];

export const scoreReportingPolicies = [
  "self_report_allowed",
  "official_required_upfront",
  "official_required_after_admit",
  "unknown",
] as const;

export type ScoreReportingPolicy = (typeof scoreReportingPolicies)[number];

export interface ScoreRange {
  low: number | null;
  high: number | null;
}

export interface TestingRequirements {
  acceptedExams: StandardizedTestExamKind[];
  minimumSatTotal: number | null;
  minimumActComposite: number | null;
  latestSatTestDateNote: string | null;
  latestActTestDateNote: string | null;
  superscorePolicy: SuperscorePolicy;
  writingEssayPolicy: WritingEssayPolicy;
  scoreReportingPolicy: ScoreReportingPolicy;
  middle50SatTotal: ScoreRange;
  middle50ActComposite: ScoreRange;
}

export const programFitTags = [
  "computer_science",
  "engineering",
  "business",
  "economics",
  "life_sciences",
  "health_pre_med",
  "humanities",
  "social_sciences",
  "arts_design",
  "public_policy",
  "research_intensive",
] as const;

export type ProgramFitTag = (typeof programFitTags)[number];

export const programAdmissionModels = [
  "open",
  "direct_admit",
  "separate_school_application",
  "capacity_limited",
  "portfolio_or_audition",
  "unknown",
] as const;

export type ProgramAdmissionModel = (typeof programAdmissionModels)[number];

export const applicationStrategyTags = [
  "non_binding_early_action",
  "restrictive_early_action",
  "single_choice_early_action",
  "binding_early_decision",
  "multiple_early_rounds",
  "rolling_or_extended_timeline",
] as const;

export type ApplicationStrategyTag = (typeof applicationStrategyTags)[number];

export interface UniversityRecommendationInputs {
  admissionRateOverall: number | null;
  satAverageOverall: number | null;
  actMidpointCumulative: number | null;
  undergraduateSize: number | null;
  averageNetPriceUsd: number | null;
  schoolControl: SchoolControl;
  campusLocale: string | null;
  internationalAidPolicy: InternationalAidPolicy;
  hasNeedBasedAid: boolean | null;
  hasMeritAid: boolean | null;
  programFitTags: ProgramFitTag[];
  programAdmissionModel: ProgramAdmissionModel;
  applicationStrategyTags: ApplicationStrategyTag[];
  testingRequirements: TestingRequirements;
}

export const academicSelectivityBands = [
  "ultra_selective",
  "highly_selective",
  "selective",
  "moderately_selective",
  "broad_access",
  "unknown",
] as const;

export type AcademicSelectivityBand = (typeof academicSelectivityBands)[number];

export const testingExpectations = [
  "high_scores_expected",
  "scores_considered",
  "tests_not_required",
  "tests_not_considered",
  "unknown",
] as const;

export type TestingExpectation = (typeof testingExpectations)[number];

export const englishPolicySummaries = [
  "minimum_scores_required",
  "english_fluency_required_no_exam_minimum_listed",
  "waiver_possible",
  "not_clearly_stated",
  "unknown",
] as const;

export type EnglishPolicySummary = (typeof englishPolicySummaries)[number];

export const aidModels = [
  "need_based_only",
  "merit_available",
  "need_and_merit",
  "limited_aid",
  "unknown",
] as const;

export type AidModel = (typeof aidModels)[number];

export const applicationComplexities = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type ApplicationComplexity = (typeof applicationComplexities)[number];

export interface DeadlineUrgencyWindows {
  earliestDeadline: string | null;
  latestMajorDeadline: string | null;
}

export const recommendationRunStatuses = [
  "pending",
  "succeeded",
  "failed",
] as const;

export type RecommendationRunStatus =
  (typeof recommendationRunStatuses)[number];

export type RecommendationTier = ContractRecommendationTier;
export type OutlookLabel = RecommendationOutlook;
export type BudgetFitLabel = BudgetFit;
export type DeadlinePressureLabel = DeadlinePressure;
export type ConfidenceLevel = ContractConfidenceLevel;

export interface ScoreComponentBreakdown {
  admissionFit: number;
  readinessFit: number;
  budgetFit: number;
  preferenceFit: number;
  improvementUpside: number;
}

export interface RecommendationScoringConfigSnapshot {
  admissionFit: {
    defaultScore: number;
    scoreByMinGap: Array<{
      minGap: number;
      score: number;
    }>;
    testingRequiredNoSubmissionPenalty: number;
  };
  readinessFit: {
    perReadyItem: number;
    noEarlyRoundBonus: number;
    earlyRoundReadyBonus: number;
    earlyRoundReadyThreshold: number;
  };
  preferenceFit: {
    majorMatchScore: number;
    majorFallbackScore: number;
    stateMatchScore: number;
    localeMatchScore: number;
    schoolControlMatchScore: number;
    sizeMatchScore: number;
  };
  improvementUpside: {
    gpaDeltaDivisor: number;
    assumptionBonusCap: number;
  };
  studentIndex: {
    gpaMultiplier: number;
    satPointsMax: number;
    actPointsMax: number;
    curriculumBonuses: {
      baseline: number;
      rigorous: number;
      most_rigorous: number;
      unknown: number;
    };
    classRankBands: Array<{
      maxPercentile: number;
      bonus: number;
    }>;
  };
  schoolIndex: {
    admissionRateNullScore: number;
    admissionRateMinScore: number;
    admissionRateMaxScore: number;
    satScoreMin: number;
    satScoreMax: number;
    actScoreMin: number;
    actScoreMax: number;
  };
  budgetFit: {
    flexibilityBufferHigh: number;
    flexibilityBufferMedium: number;
    stretchCoaGapBuffer: number;
    componentScores: {
      comfortable: number;
      stretch: number;
      high_risk: number;
      unknown: number;
    };
  };
  tierThresholds: {
    safetyMin: number;
    targetMin: number;
  };
  outlookThresholds: {
    very_strong: number;
    strong: number;
    possible: number;
    stretch: number;
  };
  sizeBuckets: {
    smallMaxExclusive: number;
    mediumMaxInclusive: number;
  };
}

export interface RecommendationRunRecord {
  id: string;
  userId: string;
  studentProfileId: string;
  currentSnapshotId: string;
  projectedSnapshotId: string | null;
  runStatus: RecommendationRunStatus;
  scoringConfigSnapshot: RecommendationScoringConfigSnapshot;
  missingProfileFields: string[];
  candidateSchoolCount: number;
  createdAt: string;
  finishedAt: string | null;
}

export interface RecommendationResultRecord {
  id: string;
  recommendationRunId: string;
  universityId: string;
  tier: RecommendationTier;
  currentOutlook: OutlookLabel;
  projectedOutlook: OutlookLabel | null;
  confidenceLevel: ConfidenceLevel;
  budgetFit: BudgetFitLabel;
  deadlinePressure: DeadlinePressureLabel;
  currentScore: number;
  projectedScore: number | null;
  currentScoreBreakdown: ScoreComponentBreakdown;
  projectedScoreBreakdown: ScoreComponentBreakdown | null;
  projectedAssumptionDelta: string[];
  rankOrder: number;
  createdAt: string;
}

export interface RecommendationShortlistRecord {
  id: string;
  recommendationRunId: string;
  model: string;
  promptVersion: string;
  systemPrompt: string;
  shortlistedRecommendationResultIds: string[];
  shortlistRationale: string[];
  createdAt: string;
}

export interface RecommendationExplanationRecord {
  id: string;
  recommendationShortlistId: string;
  recommendationResultId: string;
  whyRecommended: string[];
  topBlockers: string[];
  nextRecommendedActions: string[];
  budgetSummary: string[];
  assumptionChanges: string[];
  explanationConfidence: ConfidenceLevel;
  createdAt: string;
}

export const internationalStudentConsiderationTags = [
  "english_fluency_required",
  "english_test_may_be_required",
  "financial_certification_likely_required",
  "need_aware_or_limited_aid_possible",
  "need_based_aid_available",
  "merit_aid_possible",
] as const;

export type InternationalStudentConsiderationTag =
  (typeof internationalStudentConsiderationTags)[number];

export const schoolFitTags = [
  "strong_for_high_achieving_stem_students",
  "strong_for_business_or_econ_students",
  "strong_for_liberal_arts_or_humanities_students",
  "research_or_innovation_oriented",
  "large_public_environment",
  "smaller_private_environment",
  "urban_access",
  "value_for_budget_conscious_students",
  "strong_need_based_aid_signal",
  "strong_merit_aid_signal",
  "test_flexible_pathway",
  "rolling_or_extended_timeline",
] as const;

export type SchoolFitTag = (typeof schoolFitTags)[number];

export const schoolRiskTags = [
  "extremely_low_admission_rate",
  "high_total_cost",
  "limited_merit_aid",
  "early_deadline_pressure",
  "testing_required",
  "english_requirement_barrier",
  "complex_application_requirements",
  "limited_aid_for_international_students",
] as const;

export type SchoolRiskTag = (typeof schoolRiskTags)[number];

export const applicationActionTags = [
  "prepare_early_round_strategy",
  "prepare_regular_decision_timeline",
  "complete_standardized_testing_if_required",
  "prepare_english_testing_or_waiver_plan",
  "prepare_teacher_recommendations_early",
  "prepare_counselor_documents_early",
  "budget_for_need_based_aid_process",
  "research_merit_aid_deadlines",
  "prioritize_financial_aid_forms",
  "build_supplemental_essay_plan",
] as const;

export type ApplicationActionTag = (typeof applicationActionTags)[number];

export interface UniversityExplanationInputs {
  academicSelectivityBand: AcademicSelectivityBand;
  testingExpectation: TestingExpectation;
  englishPolicySummary: EnglishPolicySummary;
  aidModel: AidModel;
  applicationComplexity: ApplicationComplexity;
  deadlineUrgencyWindows: DeadlineUrgencyWindows;
  internationalStudentConsiderations: InternationalStudentConsiderationTag[];
  potentialFitTags: SchoolFitTag[];
  potentialRiskTags: SchoolRiskTag[];
  actionableApplicationSteps: ApplicationActionTag[];
}

export const defaultUniversityRecommendationInputs: UniversityRecommendationInputs =
  {
    admissionRateOverall: null,
    satAverageOverall: null,
    actMidpointCumulative: null,
    undergraduateSize: null,
    averageNetPriceUsd: null,
    schoolControl: "unknown",
    campusLocale: null,
    internationalAidPolicy: "unknown",
    hasNeedBasedAid: null,
    hasMeritAid: null,
    programFitTags: [],
    programAdmissionModel: "unknown",
    applicationStrategyTags: [],
    testingRequirements: {
      acceptedExams: [],
      minimumSatTotal: null,
      minimumActComposite: null,
      latestSatTestDateNote: null,
      latestActTestDateNote: null,
      superscorePolicy: "unknown",
      writingEssayPolicy: "unknown",
      scoreReportingPolicy: "unknown",
      middle50SatTotal: {
        low: null,
        high: null,
      },
      middle50ActComposite: {
        low: null,
        high: null,
      },
    },
  };

export const defaultUniversityExplanationInputs: UniversityExplanationInputs = {
  academicSelectivityBand: "unknown",
  testingExpectation: "unknown",
  englishPolicySummary: "unknown",
  aidModel: "unknown",
  applicationComplexity: "unknown",
  deadlineUrgencyWindows: {
    earliestDeadline: null,
    latestMajorDeadline: null,
  },
  internationalStudentConsiderations: [],
  potentialFitTags: [],
  potentialRiskTags: [],
  actionableApplicationSteps: [],
};

export interface UniversityValidationReason {
  code: UniversityValidationReasonCode;
  field: CatalogRequiredField;
  message: string;
}

export interface UniversitySourceMetadata {
  capturedValue?: string;
  notes?: string;
}

export interface CatalogImportRunMetadata {
  triggeredBy: "seed" | "manual" | "scheduled";
  attemptCount: number;
}

export interface CatalogImportItemPayload {
  html?: string;
  extractedText?: string;
  normalizedValue?: unknown;
}
