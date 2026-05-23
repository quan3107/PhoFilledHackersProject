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

export type ApplicationRound = z.infer<typeof applicationRoundSchema>;
export type TestPolicy = z.infer<typeof testPolicySchema>;
export type UniversitySourceKind = z.infer<typeof universitySourceKindSchema>;
export type CatalogRequiredField = z.infer<typeof catalogRequiredFieldSchema>;
