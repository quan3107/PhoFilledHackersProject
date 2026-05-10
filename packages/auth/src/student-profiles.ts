// packages/auth/src/student-profiles.ts
// Canonical profile persistence helpers for the authenticated student path.
// Keeps profile writes and snapshot writes consistent with one DB-backed workflow.

import {
  defaultStudentAcademicProfile,
  defaultStudentBudgetProfile,
  defaultStudentPreferenceProfile,
  defaultStudentReadinessProfile,
  defaultStudentTestingProfile,
  studentIntakeExplicitFieldStates,
  studentIntakeFieldResolutionKinds,
  studentIntakeSessions,
  studentProfileSnapshots,
  studentProfiles,
  studentLocationPreferenceKinds,
  type StudentAcademicProfile,
  type StudentBudgetProfile,
  type StudentIntakeExplicitFieldState as DbStudentIntakeExplicitFieldState,
  type StudentIntakeFieldResolutionKind as DbStudentIntakeFieldResolutionKind,
  type StudentIntakeFieldStatusMap as DbStudentIntakeFieldStatusMap,
  type StudentIntakeFieldStatusRecord as DbStudentIntakeFieldStatusRecord,
  type StudentIntakeMessageRecord,
  type StudentIntakeStateRecord as DbStudentIntakeStateRecord,
  type StudentPreferenceProfile,
  type StudentProfileRecord,
  type StudentProfileSnapshotKind,
  type StudentReadinessProfile,
  type StudentTestingProfile,
} from "@etest/db";
import { and, eq } from "drizzle-orm";

import { getAuthDb } from "./auth.js";

export type StudentIntakeFieldResolutionKind =
  DbStudentIntakeFieldResolutionKind;

export type StudentIntakeExplicitFieldState = DbStudentIntakeExplicitFieldState;

export type StudentIntakeFieldStatusRecord = DbStudentIntakeFieldStatusRecord;

export type StudentIntakeFieldStatusMap = DbStudentIntakeFieldStatusMap;

export type StudentIntakeStateRecord = DbStudentIntakeStateRecord;

export interface StudentProfileInput {
  citizenshipCountry: string;
  targetEntryTerm: string;
  academic: StudentAcademicProfile;
  testing: StudentTestingProfile;
  preferences: StudentPreferenceProfile;
  budget: StudentBudgetProfile;
  readiness: StudentReadinessProfile;
}

export interface StudentProfileSnapshotInput {
  assumptions: string[];
  profile: StudentProfileInput;
}

export interface StudentProfileDocument {
  current: StudentProfileSnapshotInput;
  projected: StudentProfileSnapshotInput;
}

export interface StudentProfileMissingField {
  snapshotKind: StudentProfileSnapshotKind;
  path: string;
  message: string;
}

export interface StudentIntakeMessageInput {
  id: string;
  role: "assistant" | "student";
  text: string;
  createdAt: string;
}

export interface StudentIntakeStateInput {
  currentStepIndex: number;
  conversationDone: boolean;
  messages: StudentIntakeMessageInput[];
  previousResponseId?: string | null;
  fieldStatuses?: StudentIntakeFieldStatusMap;
  outstandingFields?: string[];
  progressCompletedCount?: number;
  progressTotalCount?: number;
}

export interface StudentProfileState {
  profile: StudentProfileRecord | null;
  snapshots: Record<
    StudentProfileSnapshotKind,
    {
      id: string | null;
      assumptions: string[];
      profile: StudentProfileRecord | null;
    }
  >;
  missingFields: StudentProfileMissingField[];
}

export interface StudentProfileResolvedField extends StudentProfileMissingField {
  resolution: StudentIntakeExplicitFieldState;
}

export interface StudentProfileReadinessEvaluation {
  missingFields: StudentProfileMissingField[];
  resolvedWithCaveatFields: StudentProfileResolvedField[];
  canRun: boolean;
}

function toStudentIntakeStateRecord(
  row: typeof studentIntakeSessions.$inferSelect
): StudentIntakeStateRecord {
  return {
    userId: row.userId,
    currentStepIndex: row.currentStepIndex,
    conversationDone: row.conversationDone,
    previousResponseId: row.previousResponseId ?? null,
    fieldStatuses: normalizeStudentIntakeFieldStatuses(row.fieldStatuses),
    outstandingFields: normalizeStringArray(row.outstandingFields),
    progressCompletedCount: normalizeCount(row.progressCompletedCount),
    progressTotalCount: normalizeCount(row.progressTotalCount),
    messages: row.messages,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function isStudentIntakeFieldResolutionKind(
  value: unknown
): value is StudentIntakeFieldResolutionKind {
  return (
    typeof value === "string" &&
    studentIntakeFieldResolutionKinds.includes(
      value as StudentIntakeFieldResolutionKind
    )
  );
}

function isStudentIntakeExplicitFieldState(
  value: unknown
): value is StudentIntakeExplicitFieldState {
  return (
    typeof value === "string" &&
    studentIntakeExplicitFieldStates.includes(
      value as StudentIntakeExplicitFieldState
    )
  );
}

function normalizeStudentIntakeFieldStatuses(
  value: unknown
): StudentIntakeFieldStatusMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const statuses: StudentIntakeFieldStatusMap = {};

  for (const [path, rawStatus] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (
      !path.trim() ||
      !rawStatus ||
      typeof rawStatus !== "object" ||
      Array.isArray(rawStatus)
    ) {
      continue;
    }

    const record = rawStatus as Record<string, unknown>;
    if (!isStudentIntakeFieldResolutionKind(record.resolution)) {
      continue;
    }

    statuses[path.trim()] = {
      resolution: record.resolution,
      note: typeof record.note === "string" ? record.note.trim() || null : null,
      sourceMessageId:
        typeof record.sourceMessageId === "string"
          ? record.sourceMessageId.trim() || null
          : null,
    };
  }

  return statuses;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

function normalizeStudentPreferenceProfile(
  value: Partial<StudentPreferenceProfile> | null | undefined
): StudentPreferenceProfile {
  const intendedMajors = Array.isArray(value?.intendedMajors)
    ? value.intendedMajors
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        )
        .map((entry) => entry.trim())
    : [...defaultStudentPreferenceProfile.intendedMajors];
  const preferredStates = Array.isArray(value?.preferredStates)
    ? value.preferredStates
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        )
        .map((entry) => entry.trim().toUpperCase())
    : [...defaultStudentPreferenceProfile.preferredStates];
  const preferredLocationPreferences = Array.isArray(
    value?.preferredLocationPreferences
  )
    ? value.preferredLocationPreferences.filter(
        (
          entry
        ): entry is StudentPreferenceProfile["preferredLocationPreferences"][number] =>
          typeof entry === "string" &&
          studentLocationPreferenceKinds.includes(
            entry as (typeof studentLocationPreferenceKinds)[number]
          )
      )
    : [...defaultStudentPreferenceProfile.preferredLocationPreferences];
  const preferredCampusLocale = Array.isArray(value?.preferredCampusLocale)
    ? value.preferredCampusLocale
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        )
        .map((entry) => entry.trim())
    : [...defaultStudentPreferenceProfile.preferredCampusLocale];
  const preferredSchoolControl = Array.isArray(value?.preferredSchoolControl)
    ? value.preferredSchoolControl.filter(
        (
          entry
        ): entry is StudentPreferenceProfile["preferredSchoolControl"][number] =>
          entry === "public" || entry === "private_nonprofit"
      )
    : [...defaultStudentPreferenceProfile.preferredSchoolControl];

  return {
    intendedMajors,
    preferredStates,
    preferredLocationPreferences,
    preferredCampusLocale,
    preferredSchoolControl,
    preferredUndergraduateSize:
      value?.preferredUndergraduateSize &&
      ["small", "medium", "large", "unknown"].includes(
        value.preferredUndergraduateSize
      )
        ? value.preferredUndergraduateSize
        : defaultStudentPreferenceProfile.preferredUndergraduateSize,
  };
}

function sanitizeStudentIntakeMessages(
  messages: StudentIntakeMessageInput[]
): StudentIntakeMessageRecord[] {
  return messages
    .filter(
      (message) =>
        (message.role === "assistant" || message.role === "student") &&
        message.id.trim().length > 0 &&
        message.text.trim().length > 0
    )
    .map((message) => ({
      id: message.id.trim(),
      role: message.role,
      text: message.text.trim(),
      createdAt: message.createdAt,
    }));
}

function toIsoString(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function isKnownRequiredText(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    normalized !== "unknown" &&
    normalized !== "declined"
  );
}

function toStudentProfileRecord(
  row: typeof studentProfiles.$inferSelect
): StudentProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    citizenshipCountry: row.citizenshipCountry,
    targetEntryTerm: row.targetEntryTerm,
    academic: row.academic,
    testing: row.testing,
    preferences: normalizeStudentPreferenceProfile(row.preferences),
    budget: row.budget,
    readiness: row.readiness,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

export function getDefaultStudentProfileInput(): StudentProfileInput {
  return {
    citizenshipCountry: "",
    targetEntryTerm: "",
    academic: { ...defaultStudentAcademicProfile },
    testing: { ...defaultStudentTestingProfile },
    preferences: { ...defaultStudentPreferenceProfile },
    budget: { ...defaultStudentBudgetProfile },
    readiness: { ...defaultStudentReadinessProfile },
  };
}

export function buildStudentProfileDocumentFromState(
  state: Pick<StudentProfileState, "profile" | "snapshots">
): StudentProfileDocument {
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
    : getDefaultStudentProfileInput();
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
      assumptions: state.snapshots.current.assumptions,
      profile: currentSnapshotProfile,
    },
    projected: {
      assumptions: state.snapshots.projected.assumptions,
      profile: projectedSnapshotProfile,
    },
  };
}

export function evaluateMissingStudentProfileFields(
  profile: StudentProfileInput
): StudentProfileMissingField[] {
  return evaluateRecommendationMissingFields({
    currentProfile: profile,
    projectedProfile: profile,
    currentAssumptions: [],
    projectedAssumptions: [],
  }).filter((field) => field.snapshotKind === "current");
}

export function evaluateRecommendationMissingFields(input: {
  currentProfile: StudentProfileInput;
  projectedProfile: StudentProfileInput;
  currentAssumptions: string[];
  projectedAssumptions: string[];
}): StudentProfileMissingField[] {
  const missingFields: StudentProfileMissingField[] = [];

  const add = (
    snapshotKind: StudentProfileSnapshotKind,
    path: string,
    message: string,
    missing: boolean
  ) => {
    if (!missing) {
      return;
    }

    missingFields.push({
      snapshotKind,
      path,
      message,
    });
  };

  const current = input.currentProfile;
  add(
    "current",
    "citizenshipCountry",
    "Citizenship country is required.",
    !isKnownRequiredText(current.citizenshipCountry)
  );
  add(
    "current",
    "targetEntryTerm",
    "Target entry term is required.",
    !isKnownRequiredText(current.targetEntryTerm)
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

  add(
    "projected",
    "academic.projectedGpa100",
    "Projected GPA is required.",
    input.projectedProfile.academic.projectedGpa100 === null
  );
  add(
    "projected",
    "assumptions",
    "At least one projected-state assumption is required.",
    input.projectedAssumptions.length === 0
  );

  return missingFields;
}

function lookupStudentIntakeFieldStatus(
  fieldStatuses: StudentIntakeFieldStatusMap | undefined,
  field: StudentProfileMissingField
) {
  if (!fieldStatuses) {
    return null;
  }

  return (
    fieldStatuses[`${field.snapshotKind}.${field.path}`] ??
    fieldStatuses[field.path] ??
    null
  );
}

function splitRecommendationReadinessFields(
  missingFields: StudentProfileMissingField[],
  fieldStatuses: StudentIntakeFieldStatusMap | undefined
) {
  const resolvedWithCaveatFields: StudentProfileResolvedField[] = [];
  const unresolvedFields: StudentProfileMissingField[] = [];

  for (const field of missingFields) {
    const fieldStatus = lookupStudentIntakeFieldStatus(fieldStatuses, field);

    if (
      fieldStatus &&
      isStudentIntakeExplicitFieldState(fieldStatus.resolution)
    ) {
      resolvedWithCaveatFields.push({
        ...field,
        resolution: fieldStatus.resolution,
      });
      continue;
    }

    unresolvedFields.push(field);
  }

  return {
    missingFields: unresolvedFields,
    resolvedWithCaveatFields,
  };
}

export function toRecommendationMissingFieldPaths(
  missingFields: StudentProfileMissingField[]
) {
  return missingFields.map((field) => `${field.snapshotKind}.${field.path}`);
}

export function evaluateRecommendationRunReadinessFromDocument(
  document: StudentProfileDocument,
  options?: {
    fieldStatuses?: StudentIntakeFieldStatusMap;
  }
) {
  const readinessFields = evaluateRecommendationMissingFields({
    currentProfile: document.current.profile,
    projectedProfile: document.projected.profile,
    currentAssumptions: document.current.assumptions,
    projectedAssumptions: document.projected.assumptions,
  });
  const { missingFields, resolvedWithCaveatFields } =
    splitRecommendationReadinessFields(readinessFields, options?.fieldStatuses);

  return {
    missingFields,
    resolvedWithCaveatFields,
    canRun: missingFields.length === 0,
  };
}

export function evaluateRecommendationRunReadinessFromState(
  state: Pick<StudentProfileState, "profile" | "snapshots">,
  options?: {
    fieldStatuses?: StudentIntakeFieldStatusMap;
  }
) {
  const documentReadiness = evaluateRecommendationRunReadinessFromDocument(
    buildStudentProfileDocumentFromState(state),
    options
  );
  const missingFields = [...documentReadiness.missingFields];
  const resolvedWithCaveatFields = [
    ...documentReadiness.resolvedWithCaveatFields,
  ];

  if (!state.profile) {
    missingFields.push({
      snapshotKind: "current",
      path: "profile",
      message: "Save a student profile before running recommendations.",
    });
  }

  if (!state.snapshots.current.id) {
    missingFields.push({
      snapshotKind: "current",
      path: "snapshotId",
      message: "Save the current snapshot before running recommendations.",
    });
  }

  if (!state.snapshots.projected.id) {
    missingFields.push({
      snapshotKind: "projected",
      path: "snapshotId",
      message: "Save the projected snapshot before running recommendations.",
    });
  }

  return {
    missingFields,
    resolvedWithCaveatFields,
    canRun: missingFields.length === 0,
  };
}

export async function getStudentProfileStateForUser(
  userId: string
): Promise<StudentProfileState> {
  const authDb = await getAuthDb();
  const profile = await authDb.query.studentProfiles.findFirst({
    where: eq(studentProfiles.userId, userId),
    with: {
      snapshots: true,
    },
  });

  if (!profile) {
    const state = {
      profile: null,
      snapshots: {
        current: {
          id: null,
          assumptions: [],
          profile: null,
        },
        projected: {
          id: null,
          assumptions: [],
          profile: null,
        },
      },
    };

    return {
      ...state,
      missingFields:
        evaluateRecommendationRunReadinessFromState(state).missingFields,
    };
  }

  const normalizedProfile = toStudentProfileRecord(profile);
  const currentSnapshot =
    profile.snapshots.find((snapshot) => snapshot.snapshotKind === "current") ??
    null;
  const projectedSnapshot =
    profile.snapshots.find(
      (snapshot) => snapshot.snapshotKind === "projected"
    ) ?? null;

  const state = {
    profile: normalizedProfile,
    snapshots: {
      current: {
        id: currentSnapshot?.id ?? null,
        assumptions: currentSnapshot?.assumptions ?? [],
        profile: currentSnapshot?.profile
          ? {
              ...currentSnapshot.profile,
              preferences: normalizeStudentPreferenceProfile(
                currentSnapshot.profile.preferences
              ),
            }
          : normalizedProfile,
      },
      projected: {
        id: projectedSnapshot?.id ?? null,
        assumptions: projectedSnapshot?.assumptions ?? [],
        profile: projectedSnapshot?.profile
          ? {
              ...projectedSnapshot.profile,
              preferences: normalizeStudentPreferenceProfile(
                projectedSnapshot.profile.preferences
              ),
            }
          : normalizedProfile,
      },
    },
  };

  return {
    ...state,
    missingFields:
      evaluateRecommendationRunReadinessFromState(state).missingFields,
  };
}

export async function saveStudentProfileStateForUser(input: {
  userId: string;
  currentProfile: StudentProfileInput;
  projectedProfile: StudentProfileInput;
  currentAssumptions: string[];
  projectedAssumptions: string[];
}) {
  const authDb = await getAuthDb();
  const values = {
    userId: input.userId,
    citizenshipCountry: input.currentProfile.citizenshipCountry.trim(),
    targetEntryTerm: input.currentProfile.targetEntryTerm.trim(),
    academic: {
      ...input.currentProfile.academic,
      projectedGpa100: input.projectedProfile.academic.projectedGpa100,
    },
    testing: input.currentProfile.testing,
    preferences: normalizeStudentPreferenceProfile(
      input.currentProfile.preferences
    ),
    budget: input.currentProfile.budget,
    readiness: input.currentProfile.readiness,
    updatedAt: new Date(),
  };

  const [savedProfile] = await authDb
    .insert(studentProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: studentProfiles.userId,
      set: values,
    })
    .returning();

  const profileRecord = toStudentProfileRecord(savedProfile);
  const currentSnapshotProfile: StudentProfileRecord = {
    ...profileRecord,
    citizenshipCountry: input.currentProfile.citizenshipCountry.trim(),
    targetEntryTerm: input.currentProfile.targetEntryTerm.trim(),
    academic: {
      ...input.currentProfile.academic,
      projectedGpa100: input.projectedProfile.academic.projectedGpa100,
    },
    testing: input.currentProfile.testing,
    preferences: normalizeStudentPreferenceProfile(
      input.currentProfile.preferences
    ),
    budget: input.currentProfile.budget,
    readiness: input.currentProfile.readiness,
  };
  const projectedSnapshotProfile: StudentProfileRecord = {
    ...profileRecord,
    citizenshipCountry: input.projectedProfile.citizenshipCountry.trim(),
    targetEntryTerm: input.projectedProfile.targetEntryTerm.trim(),
    academic: input.projectedProfile.academic,
    testing: input.projectedProfile.testing,
    preferences: normalizeStudentPreferenceProfile(
      input.projectedProfile.preferences
    ),
    budget: input.projectedProfile.budget,
    readiness: input.projectedProfile.readiness,
  };

  await upsertStudentProfileSnapshot({
    studentProfileId: savedProfile.id,
    snapshotKind: "current",
    assumptions: input.currentAssumptions,
    profile: currentSnapshotProfile,
  });

  await upsertStudentProfileSnapshot({
    studentProfileId: savedProfile.id,
    snapshotKind: "projected",
    assumptions: input.projectedAssumptions,
    profile: projectedSnapshotProfile,
  });

  return getStudentProfileStateForUser(input.userId);
}

async function upsertStudentProfileSnapshot(input: {
  studentProfileId: string;
  snapshotKind: StudentProfileSnapshotKind;
  assumptions: string[];
  profile: StudentProfileRecord;
}) {
  const authDb = await getAuthDb();
  await authDb
    .insert(studentProfileSnapshots)
    .values({
      studentProfileId: input.studentProfileId,
      snapshotKind: input.snapshotKind,
      assumptions: input.assumptions,
      profile: input.profile,
    })
    .onConflictDoUpdate({
      target: [
        studentProfileSnapshots.studentProfileId,
        studentProfileSnapshots.snapshotKind,
      ],
      set: {
        assumptions: input.assumptions,
        profile: input.profile,
      },
    });
}

export async function getStudentIntakeStateForUser(
  userId: string
): Promise<StudentIntakeStateRecord | null> {
  const authDb = await getAuthDb();
  const intakeState = await authDb.query.studentIntakeSessions.findFirst({
    where: eq(studentIntakeSessions.userId, userId),
  });

  return intakeState ? toStudentIntakeStateRecord(intakeState) : null;
}

export async function saveStudentIntakeStateForUser(input: {
  userId: string;
  currentStepIndex: number;
  conversationDone: boolean;
  messages: StudentIntakeMessageInput[];
  previousResponseId?: string | null;
  fieldStatuses?: StudentIntakeFieldStatusMap;
  outstandingFields?: string[];
  progressCompletedCount?: number;
  progressTotalCount?: number;
}): Promise<StudentIntakeStateRecord> {
  const authDb = await getAuthDb();
  const existingState = await authDb.query.studentIntakeSessions.findFirst({
    where: eq(studentIntakeSessions.userId, input.userId),
  });
  const values = {
    userId: input.userId,
    currentStepIndex: Math.max(0, Math.trunc(input.currentStepIndex)),
    conversationDone: input.conversationDone,
    messages: sanitizeStudentIntakeMessages(input.messages),
    previousResponseId:
      input.previousResponseId !== undefined
        ? input.previousResponseId
        : (existingState?.previousResponseId ?? null),
    fieldStatuses:
      input.fieldStatuses !== undefined
        ? normalizeStudentIntakeFieldStatuses(input.fieldStatuses)
        : normalizeStudentIntakeFieldStatuses(existingState?.fieldStatuses),
    outstandingFields:
      input.outstandingFields !== undefined
        ? normalizeStringArray(input.outstandingFields)
        : normalizeStringArray(existingState?.outstandingFields),
    progressCompletedCount:
      input.progressCompletedCount !== undefined
        ? normalizeCount(input.progressCompletedCount)
        : normalizeCount(existingState?.progressCompletedCount),
    progressTotalCount:
      input.progressTotalCount !== undefined
        ? normalizeCount(input.progressTotalCount)
        : normalizeCount(existingState?.progressTotalCount),
    updatedAt: new Date(),
  };

  const [savedState] = await authDb
    .insert(studentIntakeSessions)
    .values(values)
    .onConflictDoUpdate({
      target: studentIntakeSessions.userId,
      set: values,
    })
    .returning();

  return toStudentIntakeStateRecord(savedState);
}
