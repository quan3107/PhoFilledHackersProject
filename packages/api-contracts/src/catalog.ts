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

export const recommendationInputsSchema = z.object({}).catchall(z.unknown());
export const explanationInputsSchema = z.object({}).catchall(z.unknown());

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
