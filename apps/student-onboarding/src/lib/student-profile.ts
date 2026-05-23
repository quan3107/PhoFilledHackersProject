// apps/web/src/lib/student-profile.ts
// Canonical student profile types and helpers for the web app slice.
// Keeps the profile editor, session persistence, and missing-field checks aligned.

import type {
  StudentLocationPreferenceKind,
  StudentProfileState,
} from "@etest/auth";

export const curriculumStrengthOptions = [
  "baseline",
  "rigorous",
  "most_rigorous",
  "unknown",
] as const;

export type CurriculumStrength = (typeof curriculumStrengthOptions)[number];

export const englishExamTypeOptions = [
  "ielts",
  "toefl",
  "duolingo",
  "none",
  "unknown",
] as const;

export type EnglishExamType = (typeof englishExamTypeOptions)[number];

export const preferredUndergraduateSizeOptions = [
  "small",
  "medium",
  "large",
  "unknown",
] as const;

export type PreferredUndergraduateSize =
  (typeof preferredUndergraduateSizeOptions)[number];

export const budgetFlexibilityOptions = [
  "low",
  "medium",
  "high",
  "unknown",
] as const;

export type BudgetFlexibility = (typeof budgetFlexibilityOptions)[number];

export type ReadinessFlag = boolean | null;

export interface StudentAcademicProfile {
  currentGpa100: number | null;
  projectedGpa100: number | null;
  curriculumStrength: CurriculumStrength;
  classRankPercent: number | null;
}

export interface StudentTestingProfile {
  satTotal: number | null;
  actComposite: number | null;
  englishExamType: EnglishExamType;
  englishExamScore: number | null;
  willSubmitTests: ReadinessFlag;
}

export interface StudentPreferenceProfile {
  intendedMajors: string[];
  preferredStates: string[];
  preferredLocationPreferences: StudentLocationPreferenceKind[];
  preferredCampusLocale: string[];
  preferredSchoolControl: Array<"public" | "private_nonprofit">;
  preferredUndergraduateSize: PreferredUndergraduateSize;
}

export interface StudentBudgetProfile {
  annualBudgetUsd: number | null;
  needsFinancialAid: ReadinessFlag;
  needsMeritAid: ReadinessFlag;
  budgetFlexibility: BudgetFlexibility;
}

export interface StudentReadinessProfile {
  wantsEarlyRound: ReadinessFlag;
  hasTeacherRecommendationsReady: ReadinessFlag;
  hasCounselorDocumentsReady: ReadinessFlag;
  hasEssayDraftsStarted: ReadinessFlag;
}

export interface StudentProfile {
  citizenshipCountry: string;
  targetEntryTerm: string;
  academic: StudentAcademicProfile;
  testing: StudentTestingProfile;
  preferences: StudentPreferenceProfile;
  budget: StudentBudgetProfile;
  readiness: StudentReadinessProfile;
}

export interface StudentProfileSnapshot {
  assumptions: string[];
  profile: StudentProfile;
}

export interface StudentProfileDocument {
  current: StudentProfileSnapshot;
  projected: StudentProfileSnapshot;
}

export interface StudentProfileMissingField {
  snapshotKind: "current" | "projected";
  path: string;
  message: string;
}

const blankReadiness = (): StudentReadinessProfile => ({
  wantsEarlyRound: null,
  hasTeacherRecommendationsReady: null,
  hasCounselorDocumentsReady: null,
  hasEssayDraftsStarted: null,
});

export const createEmptyStudentProfile = (): StudentProfile => ({
  citizenshipCountry: "",
  targetEntryTerm: "",
  academic: {
    currentGpa100: null,
    projectedGpa100: null,
    curriculumStrength: "unknown",
    classRankPercent: null,
  },
  testing: {
    satTotal: null,
    actComposite: null,
    englishExamType: "unknown",
    englishExamScore: null,
    willSubmitTests: null,
  },
  preferences: {
    intendedMajors: [],
    preferredStates: [],
    preferredLocationPreferences: [],
    preferredCampusLocale: [],
    preferredSchoolControl: [],
    preferredUndergraduateSize: "unknown",
  },
  budget: {
    annualBudgetUsd: null,
    needsFinancialAid: null,
    needsMeritAid: null,
    budgetFlexibility: "unknown",
  },
  readiness: blankReadiness(),
});

export const createEmptyStudentProfileDocument =
  (): StudentProfileDocument => ({
    current: {
      assumptions: [],
      profile: createEmptyStudentProfile(),
    },
    projected: {
      assumptions: [],
      profile: createEmptyStudentProfile(),
    },
  });

export const splitListValue = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const joinListValue = (value: string[]): string => value.join(", ");

export const parseBooleanChoice = (value: string): boolean | null => {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
};

export const serializeBooleanChoice = (value: ReadinessFlag): string => {
  if (value === true) return "true";
  if (value === false) return "false";
  return "";
};

const safeParse = <T>(
  value: string | null | undefined,
  fallback: T | undefined
): T | undefined => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const mergeAcademicProfile = (
  fallback: StudentAcademicProfile,
  value: Partial<StudentAcademicProfile> | undefined
): StudentAcademicProfile => ({
  currentGpa100:
    typeof value?.currentGpa100 === "number"
      ? value.currentGpa100
      : fallback.currentGpa100,
  projectedGpa100:
    typeof value?.projectedGpa100 === "number"
      ? value.projectedGpa100
      : fallback.projectedGpa100,
  curriculumStrength: curriculumStrengthOptions.includes(
    value?.curriculumStrength as CurriculumStrength
  )
    ? (value?.curriculumStrength as CurriculumStrength)
    : fallback.curriculumStrength,
  classRankPercent:
    typeof value?.classRankPercent === "number"
      ? value.classRankPercent
      : fallback.classRankPercent,
});

const mergeTestingProfile = (
  fallback: StudentTestingProfile,
  value: Partial<StudentTestingProfile> | undefined
): StudentTestingProfile => ({
  satTotal:
    typeof value?.satTotal === "number" ? value.satTotal : fallback.satTotal,
  actComposite:
    typeof value?.actComposite === "number"
      ? value.actComposite
      : fallback.actComposite,
  englishExamType: englishExamTypeOptions.includes(
    value?.englishExamType as EnglishExamType
  )
    ? (value?.englishExamType as EnglishExamType)
    : fallback.englishExamType,
  englishExamScore:
    typeof value?.englishExamScore === "number"
      ? value.englishExamScore
      : fallback.englishExamScore,
  willSubmitTests:
    typeof value?.willSubmitTests === "boolean"
      ? value.willSubmitTests
      : fallback.willSubmitTests,
});

const mergePreferenceProfile = (
  fallback: StudentPreferenceProfile,
  value: Partial<StudentPreferenceProfile> | undefined
): StudentPreferenceProfile => ({
  intendedMajors: Array.isArray(value?.intendedMajors)
    ? value.intendedMajors.filter(Boolean)
    : fallback.intendedMajors,
  preferredStates: Array.isArray(value?.preferredStates)
    ? value.preferredStates.filter(Boolean)
    : fallback.preferredStates,
  preferredLocationPreferences: Array.isArray(
    value?.preferredLocationPreferences
  )
    ? value.preferredLocationPreferences.filter(Boolean)
    : fallback.preferredLocationPreferences,
  preferredCampusLocale: Array.isArray(value?.preferredCampusLocale)
    ? value.preferredCampusLocale.filter(Boolean)
    : fallback.preferredCampusLocale,
  preferredSchoolControl: Array.isArray(value?.preferredSchoolControl)
    ? value.preferredSchoolControl.filter(
        (item): item is "public" | "private_nonprofit" =>
          item === "public" || item === "private_nonprofit"
      )
    : fallback.preferredSchoolControl,
  preferredUndergraduateSize: preferredUndergraduateSizeOptions.includes(
    value?.preferredUndergraduateSize as PreferredUndergraduateSize
  )
    ? (value?.preferredUndergraduateSize as PreferredUndergraduateSize)
    : fallback.preferredUndergraduateSize,
});

const mergeBudgetProfile = (
  fallback: StudentBudgetProfile,
  value: Partial<StudentBudgetProfile> | undefined
): StudentBudgetProfile => ({
  annualBudgetUsd:
    typeof value?.annualBudgetUsd === "number"
      ? value.annualBudgetUsd
      : fallback.annualBudgetUsd,
  needsFinancialAid:
    typeof value?.needsFinancialAid === "boolean"
      ? value.needsFinancialAid
      : fallback.needsFinancialAid,
  needsMeritAid:
    typeof value?.needsMeritAid === "boolean"
      ? value.needsMeritAid
      : fallback.needsMeritAid,
  budgetFlexibility: budgetFlexibilityOptions.includes(
    value?.budgetFlexibility as BudgetFlexibility
  )
    ? (value?.budgetFlexibility as BudgetFlexibility)
    : fallback.budgetFlexibility,
});

const mergeReadinessProfile = (
  fallback: StudentReadinessProfile,
  value: Partial<StudentReadinessProfile> | undefined
): StudentReadinessProfile => ({
  wantsEarlyRound:
    typeof value?.wantsEarlyRound === "boolean"
      ? value.wantsEarlyRound
      : fallback.wantsEarlyRound,
  hasTeacherRecommendationsReady:
    typeof value?.hasTeacherRecommendationsReady === "boolean"
      ? value.hasTeacherRecommendationsReady
      : fallback.hasTeacherRecommendationsReady,
  hasCounselorDocumentsReady:
    typeof value?.hasCounselorDocumentsReady === "boolean"
      ? value.hasCounselorDocumentsReady
      : fallback.hasCounselorDocumentsReady,
  hasEssayDraftsStarted:
    typeof value?.hasEssayDraftsStarted === "boolean"
      ? value.hasEssayDraftsStarted
      : fallback.hasEssayDraftsStarted,
});

const mergeProfile = (
  fallback: StudentProfile,
  value: Partial<StudentProfile> | null | undefined
): StudentProfile => {
  if (!value) return fallback;

  return {
    citizenshipCountry:
      typeof value.citizenshipCountry === "string"
        ? value.citizenshipCountry
        : fallback.citizenshipCountry,
    targetEntryTerm:
      typeof value.targetEntryTerm === "string"
        ? value.targetEntryTerm
        : fallback.targetEntryTerm,
    academic: mergeAcademicProfile(fallback.academic, value.academic),
    testing: mergeTestingProfile(fallback.testing, value.testing),
    preferences: mergePreferenceProfile(
      fallback.preferences,
      value.preferences
    ),
    budget: mergeBudgetProfile(fallback.budget, value.budget),
    readiness: mergeReadinessProfile(fallback.readiness, value.readiness),
  };
};

const parseAssumptions = (value: string | null | undefined): string[] => {
  const parsed = safeParse<unknown>(value, []);

  return Array.isArray(parsed)
    ? parsed
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
};

export const parseStudentProfileDocument = (
  currentProfileJson: string | null | undefined,
  currentAssumptionsJson: string | null | undefined,
  projectedProfileJson: string | null | undefined,
  projectedAssumptionsJson: string | null | undefined
): StudentProfileDocument => ({
  current: {
    assumptions: parseAssumptions(currentAssumptionsJson),
    profile: mergeProfile(
      createEmptyStudentProfile(),
      safeParse<Partial<StudentProfile>>(currentProfileJson, undefined)
    ),
  },
  projected: {
    assumptions: parseAssumptions(projectedAssumptionsJson),
    profile: mergeProfile(
      createEmptyStudentProfile(),
      safeParse<Partial<StudentProfile>>(projectedProfileJson, undefined)
    ),
  },
});

export const serializeStudentProfile = (profile: StudentProfile): string =>
  JSON.stringify(profile);

export const serializeAssumptions = (assumptions: string[]): string =>
  JSON.stringify(assumptions.map((item) => item.trim()).filter(Boolean));

export const getStudentProfileMissingFields = (
  document: StudentProfileDocument
): StudentProfileMissingField[] => {
  const gaps: StudentProfileMissingField[] = [];
  const add = (
    snapshotKind: "current" | "projected",
    path: string,
    message: string,
    missing: boolean
  ) => {
    if (missing) {
      gaps.push({ snapshotKind, path, message });
    }
  };

  const current = document.current.profile;
  add(
    "current",
    "citizenshipCountry",
    "Citizenship country is required.",
    !current.citizenshipCountry.trim()
  );
  add(
    "current",
    "targetEntryTerm",
    "Target entry term is required.",
    !current.targetEntryTerm.trim()
  );
  add(
    "current",
    "academic.currentGpa100",
    "Current GPA is required.",
    current.academic.currentGpa100 === null
  );
  add(
    "current",
    "academic.curriculumStrength",
    "Curriculum strength is required.",
    current.academic.curriculumStrength === "unknown"
  );
  add(
    "current",
    "academic.classRankPercent",
    "Class rank percentile is required.",
    current.academic.classRankPercent === null
  );
  add(
    "current",
    "testing.willSubmitTests",
    "Test submission intent is required.",
    current.testing.willSubmitTests === null
  );
  add(
    "current",
    "testing.scoresOrExam",
    "Add at least one SAT, ACT, or English exam detail.",
    current.testing.willSubmitTests !== false &&
      current.testing.satTotal === null &&
      current.testing.actComposite === null &&
      current.testing.englishExamType === "unknown"
  );
  add(
    "current",
    "preferences.intendedMajors",
    "At least one intended major is required.",
    current.preferences.intendedMajors.length === 0
  );
  const hasPreferredLocation =
    current.preferences.preferredStates.length > 0 ||
    current.preferences.preferredLocationPreferences.length > 0;
  add(
    "current",
    "preferences.preferredLocationPreferences",
    "At least one preferred location is required.",
    !hasPreferredLocation
  );
  add(
    "current",
    "preferences.preferredCampusLocale",
    "At least one preferred campus locale is required.",
    current.preferences.preferredCampusLocale.length === 0
  );
  add(
    "current",
    "preferences.preferredSchoolControl",
    "At least one school control preference is required.",
    current.preferences.preferredSchoolControl.length === 0
  );
  add(
    "current",
    "preferences.preferredUndergraduateSize",
    "Preferred undergraduate size is required.",
    current.preferences.preferredUndergraduateSize === "unknown"
  );
  add(
    "current",
    "budget.annualBudgetUsd",
    "Annual budget is required.",
    current.budget.annualBudgetUsd === null
  );
  add(
    "current",
    "budget.needsFinancialAid",
    "Financial aid need is required.",
    current.budget.needsFinancialAid === null
  );
  add(
    "current",
    "budget.needsMeritAid",
    "Merit aid preference is required.",
    current.budget.needsMeritAid === null
  );
  add(
    "current",
    "budget.budgetFlexibility",
    "Budget flexibility is required.",
    current.budget.budgetFlexibility === "unknown"
  );
  add(
    "current",
    "readiness.wantsEarlyRound",
    "Early-round intent is required.",
    current.readiness.wantsEarlyRound === null
  );
  add(
    "current",
    "readiness.hasTeacherRecommendationsReady",
    "Teacher recommendation readiness is required.",
    current.readiness.hasTeacherRecommendationsReady === null
  );
  add(
    "current",
    "readiness.hasCounselorDocumentsReady",
    "Counselor document readiness is required.",
    current.readiness.hasCounselorDocumentsReady === null
  );
  add(
    "current",
    "readiness.hasEssayDraftsStarted",
    "Essay readiness is required.",
    current.readiness.hasEssayDraftsStarted === null
  );

  const projected = document.projected;
  add(
    "projected",
    "academic.projectedGpa100",
    "Projected GPA is required.",
    projected.profile.academic.projectedGpa100 === null
  );
  add(
    "projected",
    "assumptions",
    "At least one projected-state assumption is required.",
    projected.assumptions.length === 0
  );

  return gaps;
};

export const buildStudentProfileDocumentFromUserFields = (
  fields: Partial<{
    profileCurrentJson: string | null;
    profileCurrentAssumptionsJson: string | null;
    profileProjectedJson: string | null;
    profileProjectedAssumptionsJson: string | null;
  }>
): StudentProfileDocument => {
  const current = parseStudentProfileDocument(
    fields.profileCurrentJson,
    fields.profileCurrentAssumptionsJson,
    fields.profileProjectedJson,
    fields.profileProjectedAssumptionsJson
  );

  return {
    current: current.current,
    projected: current.projected,
  };
};

export const buildStudentProfileDocumentFromState = (
  state: StudentProfileState
): StudentProfileDocument => {
  const profile = state.profile
    ? {
        citizenshipCountry: state.profile.citizenshipCountry,
        targetEntryTerm: state.profile.targetEntryTerm,
        academic: state.profile.academic,
        testing: state.profile.testing,
        preferences: state.profile.preferences,
        budget: state.profile.budget,
        readiness: state.profile.readiness,
      }
    : createEmptyStudentProfile();
  const currentSnapshotProfile = state.snapshots.current.profile
    ? {
        citizenshipCountry: state.snapshots.current.profile.citizenshipCountry,
        targetEntryTerm: state.snapshots.current.profile.targetEntryTerm,
        academic: state.snapshots.current.profile.academic,
        testing: state.snapshots.current.profile.testing,
        preferences: state.snapshots.current.profile.preferences,
        budget: state.snapshots.current.profile.budget,
        readiness: state.snapshots.current.profile.readiness,
      }
    : profile;
  const projectedSnapshotProfile = state.snapshots.projected.profile
    ? {
        citizenshipCountry:
          state.snapshots.projected.profile.citizenshipCountry,
        targetEntryTerm: state.snapshots.projected.profile.targetEntryTerm,
        academic: state.snapshots.projected.profile.academic,
        testing: state.snapshots.projected.profile.testing,
        preferences: state.snapshots.projected.profile.preferences,
        budget: state.snapshots.projected.profile.budget,
        readiness: state.snapshots.projected.profile.readiness,
      }
    : {
        ...profile,
        academic: {
          ...profile.academic,
          projectedGpa100: profile.academic.projectedGpa100,
        },
      };

  return {
    current: {
      profile: currentSnapshotProfile,
      assumptions: state.snapshots.current.assumptions,
    },
    projected: {
      profile: projectedSnapshotProfile,
      assumptions: state.snapshots.projected.assumptions,
    },
  };
};
