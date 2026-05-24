import { z } from "zod";

export const applicationRounds = [
  "early_action",
  "early_decision",
  "regular_decision",
  "rolling_admission",
  "priority",
] as const;

export const testPolicies = [
  "required",
  "test_optional",
  "test_flexible",
  "test_blind",
  "unknown",
] as const;

export const universitySourceKinds = [
  "official_admissions",
  "official_tuition",
  "official_cost_of_attendance",
  "official_scholarship",
  "manual_review",
] as const;

export const catalogRequiredFields = [
  "schoolName",
  "city",
  "state",
  "officialAdmissionsUrl",
  "applicationRounds",
  "deadlinesByRound",
  "englishRequirements",
  "testPolicy",
  "requiredMaterials",
  "tuitionAnnualUsd",
  "estimatedCostOfAttendanceUsd",
  "livingCostEstimateUsd",
  "scholarshipAvailabilityFlag",
  "scholarshipNotes",
  "lastVerifiedAt",
] as const;

export const applicationRoundSchema = z.enum(applicationRounds);
export const testPolicySchema = z.enum(testPolicies);
export const universitySourceKindSchema = z.enum(universitySourceKinds);
export const catalogRequiredFieldSchema = z.enum(catalogRequiredFields);

export const sourceMetadataSchema = z
  .object({
    notes: z.string().optional(),
  })
  .catchall(z.unknown());

const nullableNumberSchema = z.number().finite().nullable();
const nullableIntegerSchema = z.number().int().nullable();
const nullableTextSchema = z.string().nullable();

const scoreRangeSchema = z.object({
  low: nullableIntegerSchema,
  high: nullableIntegerSchema,
});

export const recommendationInputsSchema = z.object({
  admissionRateOverall: nullableNumberSchema,
  satAverageOverall: nullableIntegerSchema,
  actMidpointCumulative: nullableIntegerSchema,
  undergraduateSize: nullableIntegerSchema,
  averageNetPriceUsd: nullableIntegerSchema,
  schoolControl: z.enum([
    "public",
    "private_nonprofit",
    "private_for_profit",
    "unknown",
  ]),
  campusLocale: nullableTextSchema,
  internationalAidPolicy: z.enum([
    "meets_full_demonstrated_need_if_eligible",
    "need_based_aid_available",
    "merit_aid_available",
    "need_and_merit_available",
    "limited_or_unclear",
    "unknown",
  ]),
  hasNeedBasedAid: z.boolean().nullable(),
  hasMeritAid: z.boolean().nullable(),
  programFitTags: z.array(
    z.enum([
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
    ])
  ),
  programAdmissionModel: z.enum([
    "open",
    "direct_admit",
    "separate_school_application",
    "capacity_limited",
    "portfolio_or_audition",
    "unknown",
  ]),
  applicationStrategyTags: z.array(
    z.enum([
      "non_binding_early_action",
      "restrictive_early_action",
      "single_choice_early_action",
      "binding_early_decision",
      "multiple_early_rounds",
      "rolling_or_extended_timeline",
    ])
  ),
  testingRequirements: z.object({
    acceptedExams: z.array(z.enum(["sat", "act"])),
    minimumSatTotal: nullableIntegerSchema,
    minimumActComposite: nullableIntegerSchema,
    latestSatTestDateNote: nullableTextSchema,
    latestActTestDateNote: nullableTextSchema,
    superscorePolicy: z.enum([
      "sat_only",
      "act_only",
      "both",
      "none",
      "unknown",
    ]),
    writingEssayPolicy: z.enum([
      "required",
      "optional",
      "not_considered",
      "unknown",
    ]),
    scoreReportingPolicy: z.enum([
      "self_report_allowed",
      "official_required_upfront",
      "official_required_after_admit",
      "unknown",
    ]),
    middle50SatTotal: scoreRangeSchema,
    middle50ActComposite: scoreRangeSchema,
  }),
});

export const explanationInputsSchema = z.object({
  academicSelectivityBand: z.enum([
    "ultra_selective",
    "highly_selective",
    "selective",
    "moderately_selective",
    "broad_access",
    "unknown",
  ]),
  testingExpectation: z.enum([
    "high_scores_expected",
    "scores_considered",
    "tests_not_required",
    "tests_not_considered",
    "unknown",
  ]),
  englishPolicySummary: z.enum([
    "minimum_scores_required",
    "english_fluency_required_no_exam_minimum_listed",
    "waiver_possible",
    "not_clearly_stated",
    "unknown",
  ]),
  aidModel: z.enum([
    "need_based_only",
    "merit_available",
    "need_and_merit",
    "limited_aid",
    "unknown",
  ]),
  applicationComplexity: z.enum(["low", "medium", "high", "unknown"]),
  deadlineUrgencyWindows: z.object({
    earliestDeadline: nullableTextSchema,
    latestMajorDeadline: nullableTextSchema,
  }),
  internationalStudentConsiderations: z.array(
    z.enum([
      "english_fluency_required",
      "english_test_may_be_required",
      "financial_certification_likely_required",
      "need_aware_or_limited_aid_possible",
      "need_based_aid_available",
      "merit_aid_possible",
    ])
  ),
  potentialFitTags: z.array(
    z.enum([
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
    ])
  ),
  potentialRiskTags: z.array(
    z.enum([
      "extremely_low_admission_rate",
      "high_total_cost",
      "limited_merit_aid",
      "early_deadline_pressure",
      "testing_required",
      "english_requirement_barrier",
      "complex_application_requirements",
      "limited_aid_for_international_students",
    ])
  ),
  actionableApplicationSteps: z.array(
    z.enum([
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
    ])
  ),
});

export const extractionDraftSchema = z.object({
  identity: z.object({
    schoolName: z.string(),
    city: z.string(),
    state: z.string(),
    officialAdmissionsUrl: z.string(),
  }),
  applicationRounds: z.unknown(),
  deadlinesByRound: z.unknown(),
  englishRequirements: z.unknown(),
  testPolicy: z.unknown(),
  requiredMaterials: z.unknown(),
  tuitionAnnualUsd: z.unknown(),
  estimatedCostOfAttendanceUsd: z.unknown(),
  livingCostEstimateUsd: z.unknown(),
  scholarshipAvailabilityFlag: z.unknown(),
  scholarshipNotes: z.unknown(),
  recommendationInputs: recommendationInputsSchema,
  explanationInputs: explanationInputsSchema,
});

const curatedProvenanceEntrySchema = z.object({
  sourceKind: z.string(),
  sourceUrl: z.string(),
  excerpt: z.string().nullable(),
});

export const curatedArtifactSchema = z.object({
  schoolSlug: z.string(),
  lastVerifiedAt: z.string(),
  identity: z.object({
    schoolName: z.string(),
    city: z.string(),
    state: z.string(),
    officialAdmissionsUrl: z.string(),
  }),
  applicationRounds: z.array(applicationRoundSchema),
  deadlinesByRound: z.record(applicationRoundSchema, z.string().nullable()),
  englishRequirements: z.object({
    minimumIelts: z.number().nullable(),
    minimumToeflInternetBased: z.number().nullable(),
    waiverNotes: z.string().nullable(),
  }),
  testPolicy: testPolicySchema,
  requiredMaterials: z.array(z.string()),
  tuitionAnnualUsd: z.number(),
  estimatedCostOfAttendanceUsd: z.number(),
  livingCostEstimateUsd: z.number(),
  scholarshipAvailabilityFlag: z.boolean(),
  scholarshipNotes: z.string(),
  recommendationInputs: recommendationInputsSchema,
  explanationInputs: explanationInputsSchema,
  fieldProvenance: z.record(z.string(), z.array(curatedProvenanceEntrySchema)),
  quality: z.object({
    status: z.enum(["publishable", "needs_review"]),
    missingFields: z.array(z.string()),
    warnings: z.array(z.string()),
  }),
});

export type ApplicationRound = z.infer<typeof applicationRoundSchema>;
export type TestPolicy = z.infer<typeof testPolicySchema>;
export type UniversitySourceKind = z.infer<typeof universitySourceKindSchema>;
export type CatalogRequiredField = z.infer<typeof catalogRequiredFieldSchema>;
export type ExtractionDraft = z.infer<typeof extractionDraftSchema>;
export type CuratedArtifact = z.infer<typeof curatedArtifactSchema>;
