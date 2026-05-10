// packages/db/src/schema/profile-types.ts
// Canonical student-profile and auth-adjacent types for recommendation inputs.
// Keeps profile shapes isolated from the larger catalog type bucket.

import type { SchoolControl } from "./types.js";

export const studentCurriculumStrengths = [
  "baseline",
  "rigorous",
  "most_rigorous",
  "unknown",
] as const;

export type StudentCurriculumStrength =
  (typeof studentCurriculumStrengths)[number];

export const englishExamTypes = [
  "ielts",
  "toefl",
  "duolingo",
  "none",
  "unknown",
] as const;

export type EnglishExamType = (typeof englishExamTypes)[number];

export const preferredUndergraduateSizes = [
  "small",
  "medium",
  "large",
  "unknown",
] as const;

export type PreferredUndergraduateSize =
  (typeof preferredUndergraduateSizes)[number];

export const studentLocationPreferenceKinds = [
  "us_east_coast",
  "us_west_coast",
  "us_midwest",
  "us_south",
  "canada",
  "uk",
  "no_preference",
] as const;

export type StudentLocationPreferenceKind =
  (typeof studentLocationPreferenceKinds)[number];

export const studentLocationPreferenceLabels: Record<
  StudentLocationPreferenceKind,
  string
> = {
  us_east_coast: "US - East Coast",
  us_west_coast: "US - West Coast",
  us_midwest: "US - Midwest",
  us_south: "US - South",
  canada: "Canada",
  uk: "UK",
  no_preference: "No preference",
};

export const studentLocationPreferenceStateGroups: Partial<
  Record<StudentLocationPreferenceKind, readonly string[]>
> = {
  us_east_coast: [
    "CT",
    "DC",
    "DE",
    "FL",
    "GA",
    "MA",
    "MD",
    "ME",
    "NC",
    "NH",
    "NJ",
    "NY",
    "PA",
    "RI",
    "SC",
    "VA",
    "VT",
    "WV",
  ],
  us_west_coast: [
    "AK",
    "AZ",
    "CA",
    "CO",
    "HI",
    "ID",
    "MT",
    "NV",
    "NM",
    "OR",
    "UT",
    "WA",
    "WY",
  ],
  us_midwest: [
    "IA",
    "IL",
    "IN",
    "KS",
    "MI",
    "MN",
    "MO",
    "ND",
    "NE",
    "OH",
    "SD",
    "WI",
  ],
  us_south: ["AL", "AR", "KY", "LA", "MS", "OK", "TN", "TX"],
};

export const budgetFlexibilities = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type BudgetFlexibility = (typeof budgetFlexibilities)[number];

export const studentProfileSnapshotKinds = ["current", "projected"] as const;

export type StudentProfileSnapshotKind =
  (typeof studentProfileSnapshotKinds)[number];

export type StudentPreferredSchoolControl = Extract<
  SchoolControl,
  "public" | "private_nonprofit"
>;

export const studentIntakeMessageRoles = ["assistant", "student"] as const;

export type StudentIntakeMessageRole =
  (typeof studentIntakeMessageRoles)[number];

export const studentIntakeFieldResolutionKinds = [
  "filled",
  "needs_clarification",
  "unknown",
  "declined",
] as const;

export type StudentIntakeFieldResolutionKind =
  (typeof studentIntakeFieldResolutionKinds)[number];

export const studentIntakeExplicitFieldStates = [
  "unknown",
  "declined",
] as const;

export type StudentIntakeExplicitFieldState =
  (typeof studentIntakeExplicitFieldStates)[number];

export interface StudentAcademicProfile {
  currentGpa100: number | null;
  projectedGpa100: number | null;
  curriculumStrength: StudentCurriculumStrength;
  classRankPercent: number | null;
}

export interface StudentTestingProfile {
  satTotal: number | null;
  actComposite: number | null;
  englishExamType: EnglishExamType;
  englishExamScore: number | null;
  willSubmitTests: boolean | null;
}

export interface StudentPreferenceProfile {
  intendedMajors: string[];
  preferredStates: string[];
  preferredLocationPreferences: StudentLocationPreferenceKind[];
  preferredCampusLocale: string[];
  preferredSchoolControl: StudentPreferredSchoolControl[];
  preferredUndergraduateSize: PreferredUndergraduateSize;
}

export interface StudentBudgetProfile {
  annualBudgetUsd: number | null;
  needsFinancialAid: boolean | null;
  needsMeritAid: boolean | null;
  budgetFlexibility: BudgetFlexibility;
}

export interface StudentReadinessProfile {
  wantsEarlyRound: boolean | null;
  hasTeacherRecommendationsReady: boolean | null;
  hasCounselorDocumentsReady: boolean | null;
  hasEssayDraftsStarted: boolean | null;
}

export interface StudentProfileRecord {
  id: string;
  userId: string;
  citizenshipCountry: string;
  targetEntryTerm: string;
  academic: StudentAcademicProfile;
  testing: StudentTestingProfile;
  preferences: StudentPreferenceProfile;
  budget: StudentBudgetProfile;
  readiness: StudentReadinessProfile;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileSnapshotRecord {
  id: string;
  studentProfileId: string;
  snapshotKind: StudentProfileSnapshotKind;
  assumptions: string[];
  profile: StudentProfileRecord;
  createdAt: string;
}

export interface StudentProfileMissingField {
  snapshotKind: StudentProfileSnapshotKind;
  path: string;
  message: string;
}

export interface StudentIntakeMessageRecord {
  id: string;
  role: StudentIntakeMessageRole;
  text: string;
  createdAt: string;
}

export interface StudentIntakeFieldStatusRecord {
  resolution: StudentIntakeFieldResolutionKind;
  note?: string | null;
  sourceMessageId?: string | null;
}

export type StudentIntakeFieldStatusMap = Record<
  string,
  StudentIntakeFieldStatusRecord
>;

export interface StudentIntakeStateRecord {
  userId: string;
  currentStepIndex: number;
  conversationDone: boolean;
  previousResponseId: string | null;
  fieldStatuses: StudentIntakeFieldStatusMap;
  outstandingFields: string[];
  progressCompletedCount: number;
  progressTotalCount: number;
  messages: StudentIntakeMessageRecord[];
  createdAt: string;
  updatedAt: string;
}

export const defaultStudentAcademicProfile: StudentAcademicProfile = {
  currentGpa100: null,
  projectedGpa100: null,
  curriculumStrength: "unknown",
  classRankPercent: null,
};

export const defaultStudentTestingProfile: StudentTestingProfile = {
  satTotal: null,
  actComposite: null,
  englishExamType: "unknown",
  englishExamScore: null,
  willSubmitTests: null,
};

export const defaultStudentPreferenceProfile: StudentPreferenceProfile = {
  intendedMajors: [],
  preferredStates: [],
  preferredLocationPreferences: [],
  preferredCampusLocale: [],
  preferredSchoolControl: [],
  preferredUndergraduateSize: "unknown",
};

export const defaultStudentBudgetProfile: StudentBudgetProfile = {
  annualBudgetUsd: null,
  needsFinancialAid: null,
  needsMeritAid: null,
  budgetFlexibility: "unknown",
};

export const defaultStudentReadinessProfile: StudentReadinessProfile = {
  wantsEarlyRound: null,
  hasTeacherRecommendationsReady: null,
  hasCounselorDocumentsReady: null,
  hasEssayDraftsStarted: null,
};
