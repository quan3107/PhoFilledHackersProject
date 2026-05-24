import { z } from "zod";

import { intakeFieldPathSchema } from "./intake.js";

const nullableTextSchema = z.string().trim().max(240).nullable();

export const studentProfilePatchSchema = z.object({
  citizenshipCountry: nullableTextSchema,
  targetEntryTerm: nullableTextSchema,
  academic: z.object({
    currentGpa100: z.number().min(0).max(100).nullable(),
    projectedGpa100: z.number().min(0).max(100).nullable(),
    curriculumStrength: nullableTextSchema,
    classRankPercent: z.number().min(0).max(100).nullable(),
  }),
  testing: z.object({
    satTotal: z.number().min(0).max(1600).nullable(),
    actComposite: z.number().min(0).max(36).nullable(),
    englishExamType: nullableTextSchema,
    englishExamScore: z.number().min(0).max(200).nullable(),
    willSubmitTests: z.boolean().nullable(),
  }),
  preferences: z.object({
    intendedMajors: z
      .array(z.string().trim().min(1).max(80))
      .max(20)
      .nullable(),
    preferredStates: z
      .array(z.string().trim().min(1).max(40))
      .max(20)
      .nullable(),
    preferredLocationPreferences: z
      .array(z.string().trim().min(1).max(80))
      .max(20)
      .nullable(),
    preferredCampusLocale: z
      .array(z.string().trim().min(1).max(40))
      .max(10)
      .nullable(),
    preferredSchoolControl: z
      .array(z.string().trim().min(1).max(40))
      .max(4)
      .nullable(),
    preferredUndergraduateSize: nullableTextSchema,
  }),
  budget: z.object({
    annualBudgetUsd: z.number().min(0).max(500_000).nullable(),
    needsFinancialAid: z.boolean().nullable(),
    needsMeritAid: z.boolean().nullable(),
    budgetFlexibility: nullableTextSchema,
  }),
  readiness: z.object({
    wantsEarlyRound: z.boolean().nullable(),
    hasTeacherRecommendationsReady: z.boolean().nullable(),
    hasCounselorDocumentsReady: z.boolean().nullable(),
    hasEssayDraftsStarted: z.boolean().nullable(),
  }),
});

export const intakeResolutionSchema = z.object({
  path: intakeFieldPathSchema,
  status: z.enum(["filled", "needs_clarification", "unknown", "declined"]),
  note: z.string().trim().max(500).nullable(),
});

export const llmIntakeResolutionSchema = intakeResolutionSchema.transform(
  (resolution) => ({
    path: resolution.path,
    resolution: resolution.status,
    note: resolution.note,
  })
);

export const intakeModelOutputSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(4_000),
  currentProfilePatch: studentProfilePatchSchema,
  projectedProfilePatch: studentProfilePatchSchema,
  projectedAssumptions: z.array(z.string().trim().min(1).max(240)).max(50),
  resolutions: z.array(intakeResolutionSchema).max(20),
});

export const recommendationChatModelOutputSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(4_000),
  suggestedReplies: z.array(z.string().trim().min(1).max(120)).max(3),
});

export type LlmIntakeResolution = z.infer<typeof llmIntakeResolutionSchema>;
export type IntakeModelOutput = z.infer<typeof intakeModelOutputSchema>;
export type RecommendationChatModelOutput = z.infer<
  typeof recommendationChatModelOutputSchema
>;
