import { z } from "zod";

export const readinessFlagSchema = z.boolean().nullable();
export const readinesFlagSchema = readinessFlagSchema;

export const curriculumStrengths = [
  "baseline",
  "rigorous",
  "most_rigorous",
  "unknown",
] as const;

export const englishExamTypes = [
  "ielts",
  "toefl",
  "duolingo",
  "none",
  "unknown",
] as const;

export const preferredLocationPreferences = [
  "in_state",
  "out_of_state",
  "regional",
  "international",
] as const;

export const studentLocationPreferenceKinds = [
  "us_east_coast",
  "us_west_coast",
  "us_midwest",
  "us_south",
  "canada",
  "uk",
  "no_preference",
] as const;

export const preferredSchoolControls = ["public", "private_nonprofit"] as const;
export const preferredUndergraduateSizes = [
  "small",
  "medium",
  "large",
  "unknown",
] as const;
export const budgetFlexibilities = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export const curriculumStrengthSchema = z.enum(curriculumStrengths);
export const englishExamTypeSchema = z.enum(englishExamTypes);
export const preferredLocationPreferenceSchema = z.enum(
  preferredLocationPreferences
);
export const studentLocationPreferenceKindSchema = z.enum(
  studentLocationPreferenceKinds
);
export const preferredSchoolControlSchema = z.enum(preferredSchoolControls);
export const preferredUndergraduateSizeSchema = z.enum(
  preferredUndergraduateSizes
);
export const budgetFlexibilitySchema = z.enum(budgetFlexibilities);

export const studentAcademicProfileSchema = z.object({
  currentGpa100: z.number().min(0).max(100).nullable(),
  projectedGpa100: z.number().min(0).max(100).nullable(),
  curriculumStrength: curriculumStrengthSchema,
  classRankPercent: z.number().min(0).max(100).nullable(),
});

export const studentTestingProfileSchema = z.object({
  satTotal: z.number().int().min(400).max(1600).nullable(),
  actComposite: z.number().int().min(1).max(36).nullable(),
  englishExamType: englishExamTypeSchema,
  englishExamScore: z.number().min(0).max(200).nullable(),
  willSubmitTests: readinessFlagSchema,
});

export const studentPreferenceProfileSchema = z.object({
  intendedMajors: z.array(z.string().trim().min(1).max(80)).max(20),
  preferredStates: z.array(z.string().trim().min(1).max(40)).max(20),
  preferredLocationPreferences: z
    .array(preferredLocationPreferenceSchema)
    .max(8),
  preferredCampusLocale: z.array(z.string().trim().min(1).max(40)).max(10),
  preferredSchoolControl: z.array(preferredSchoolControlSchema).max(2),
  preferredUndergraduateSize: preferredUndergraduateSizeSchema,
});

export const studentBudgetProfileSchema = z.object({
  annualBudgetUsd: z.number().int().min(0).max(500_000).nullable(),
  needsFinancialAid: readinessFlagSchema,
  needsMeritAid: readinessFlagSchema,
  budgetFlexibility: budgetFlexibilitySchema,
});

export const studentReadinessProfileSchema = z.object({
  wantsEarlyRound: readinessFlagSchema,
  hasTeacherRecommendationsReady: readinessFlagSchema,
  hasCounselorDocumentsReady: readinessFlagSchema,
  hasEssayDraftsStarted: readinessFlagSchema,
});

export const studentProfileInputSchema = z.object({
  citizenshipCountry: z.string().trim().max(80),
  targetEntryTerm: z.string().trim().max(40),
  academic: studentAcademicProfileSchema,
  testing: studentTestingProfileSchema,
  preferences: studentPreferenceProfileSchema,
  budget: studentBudgetProfileSchema,
  readiness: studentReadinessProfileSchema,
});

export const profileAssumptionsSchema = z
  .array(z.string().trim().min(1).max(240))
  .max(50);

export const studentProfileSnapshotSchema = z.object({
  assumptions: profileAssumptionsSchema,
  profile: studentProfileInputSchema,
});

export const studentProfileDocumentSchema = z.object({
  current: studentProfileSnapshotSchema,
  projected: studentProfileSnapshotSchema,
});

export const studentProfileSnapshotKindSchema = z.enum([
  "current",
  "projected",
]);
export const studentProfileMissingFieldSchema = z.object({
  snapshotKind: studentProfileSnapshotKindSchema,
  path: z.string().trim().min(1),
  message: z.string().trim().min(1),
});

export const recommendationReadinessStatusSchema = z.enum([
  "ready",
  "ready_with_caveats",
  "not_ready",
]);

export type ReadinessFlag = z.infer<typeof readinessFlagSchema>;
export type CurriculumStrength = z.infer<typeof curriculumStrengthSchema>;
export type EnglishExamType = z.infer<typeof englishExamTypeSchema>;
export type PreferredLocationPreference = z.infer<
  typeof preferredLocationPreferenceSchema
>;
export type StudentLocationPreferenceKind = z.infer<
  typeof studentLocationPreferenceKindSchema
>;
export type PreferredSchoolControl = z.infer<
  typeof preferredSchoolControlSchema
>;
export type PreferredUndergraduateSize = z.infer<
  typeof preferredUndergraduateSizeSchema
>;
export type BudgetFlexibility = z.infer<typeof budgetFlexibilitySchema>;
export type StudentAcademicProfile = z.infer<
  typeof studentAcademicProfileSchema
>;
export type StudentTestingProfile = z.infer<typeof studentTestingProfileSchema>;
export type StudentPreferenceProfile = z.infer<
  typeof studentPreferenceProfileSchema
>;
export type StudentBudgetProfile = z.infer<typeof studentBudgetProfileSchema>;
export type StudentReadinessProfile = z.infer<
  typeof studentReadinessProfileSchema
>;
export type StudentProfileInput = z.infer<typeof studentProfileInputSchema>;
export type StudentProfileSnapshot = z.infer<
  typeof studentProfileSnapshotSchema
>;
export type StudentProfileDocument = z.infer<
  typeof studentProfileDocumentSchema
>;
export type StudentProfileSnapshotKind = z.infer<
  typeof studentProfileSnapshotKindSchema
>;
export type StudentProfileMissingField = z.infer<
  typeof studentProfileMissingFieldSchema
>;
export type RecommendationReadinessStatus = z.infer<
  typeof recommendationReadinessStatusSchema
>;
