import { z } from "zod";

export const intakeFieldPaths = [
  "citizenshipCountry",
  "targetEntryTerm",
  "academic.currentGpa100",
  "academic.projectedGpa100",
  "academic.curriculumStrength",
  "academic.classRankPercent",
  "testing.willSubmitTests",
  "testing.satTotal",
  "testing.actComposite",
  "testing.englishExamType",
  "testing.englishExamScore",
  "preferences.intendedMajors",
  "preferences.preferredStates",
  "preferences.preferredLocationPreferences",
  "preferences.preferredCampusLocale",
  "preferences.preferredSchoolControl",
  "preferences.preferredUndergraduateSize",
  "budget.annualBudgetUsd",
  "budget.needsFinancialAid",
  "budget.needsMeritAid",
  "budget.budgetFlexibility",
  "readiness.wantsEarlyRound",
  "readiness.hasTeacherRecommendationsReady",
  "readiness.hasCounselorDocumentsReady",
  "readiness.hasEssayDraftsStarted",
  "projected.assumptions",
] as const;

export const intakeFieldPathSchema = z.enum(intakeFieldPaths);

export type IntakeFieldPath = z.infer<typeof intakeFieldPathSchema>;
