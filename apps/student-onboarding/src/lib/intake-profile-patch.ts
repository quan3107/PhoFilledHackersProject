// apps/student-onboarding/src/lib/intake-profile-patch.ts
// Canonical patch application for LLM-driven onboarding turns.
// Validates and normalizes model-proposed profile updates before persistence.

import {
  budgetFlexibilityOptions,
  createEmptyStudentProfileDocument,
  curriculumStrengthOptions,
  englishExamTypeOptions,
  preferredUndergraduateSizeOptions,
  type StudentProfileDocument,
} from "@/lib/student-profile";
import {
  cloneStudentProfileDocument,
  syncProjectedBase,
} from "@/lib/student-onboarding";
import {
  locationPreferenceKinds,
  locationPreferenceLabels,
} from "@/lib/location-preferences";

function toTrimmedStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
}

function normalizeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFreeTextField(value: unknown) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "";
  }

  const lowered = normalized.toLowerCase();
  if (
    lowered === "unknown" ||
    lowered === "declined" ||
    lowered === "prefer not to answer" ||
    lowered === "i don't know"
  ) {
    return "";
  }

  return normalized;
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T
) {
  return typeof value === "string" && allowed.includes(value as T[number])
    ? (value as T[number])
    : null;
}

function normalizeLocationPreferences(value: unknown) {
  const labelsByLowercase = new Map(
    locationPreferenceKinds.map((kind) => [
      locationPreferenceLabels[kind].toLowerCase(),
      kind,
    ])
  );

  return toTrimmedStringArray(value)
    .map(
      (item) =>
        labelsByLowercase.get(item.toLowerCase()) ??
        (locationPreferenceKinds.includes(
          item as (typeof locationPreferenceKinds)[number]
        )
          ? item
          : null)
    )
    .filter(
      (item): item is (typeof locationPreferenceKinds)[number] => item !== null
    );
}

function normalizeSchoolControl(value: unknown) {
  return toTrimmedStringArray(value).filter(
    (item): item is "public" | "private_nonprofit" =>
      item === "public" || item === "private_nonprofit"
  );
}

function normalizeCampusLocale(value: unknown) {
  return toTrimmedStringArray(value).map((item) => item.toLowerCase());
}

function normalizeStates(value: unknown) {
  return toTrimmedStringArray(value)
    .map((item) => item.toUpperCase())
    .filter((item) => /^[A-Z]{2}$/.test(item));
}

function patchProfile(
  target: StudentProfileDocument["current"]["profile"],
  patch: Record<string, unknown>
) {
  const academic =
    patch.academic && typeof patch.academic === "object"
      ? (patch.academic as Record<string, unknown>)
      : null;
  const testing =
    patch.testing && typeof patch.testing === "object"
      ? (patch.testing as Record<string, unknown>)
      : null;
  const preferences =
    patch.preferences && typeof patch.preferences === "object"
      ? (patch.preferences as Record<string, unknown>)
      : null;
  const budget =
    patch.budget && typeof patch.budget === "object"
      ? (patch.budget as Record<string, unknown>)
      : null;
  const readiness =
    patch.readiness && typeof patch.readiness === "object"
      ? (patch.readiness as Record<string, unknown>)
      : null;

  const citizenshipCountry = normalizeFreeTextField(patch.citizenshipCountry);
  if (citizenshipCountry) {
    target.citizenshipCountry = citizenshipCountry;
  }

  const targetEntryTerm = normalizeFreeTextField(patch.targetEntryTerm);
  if (targetEntryTerm) {
    target.targetEntryTerm = targetEntryTerm;
  }

  if (academic) {
    const currentGpa100 = normalizeNumber(academic.currentGpa100);
    if (currentGpa100 !== null) {
      target.academic.currentGpa100 = Math.max(0, Math.min(100, currentGpa100));
    }

    const projectedGpa100 = normalizeNumber(academic.projectedGpa100);
    if (projectedGpa100 !== null) {
      target.academic.projectedGpa100 = Math.max(
        0,
        Math.min(100, projectedGpa100)
      );
    }

    const curriculumStrength = normalizeEnum(
      academic.curriculumStrength,
      curriculumStrengthOptions
    );
    if (curriculumStrength) {
      target.academic.curriculumStrength = curriculumStrength;
    }

    const classRankPercent = normalizeNumber(academic.classRankPercent);
    if (classRankPercent !== null) {
      target.academic.classRankPercent = Math.max(
        0,
        Math.min(100, classRankPercent)
      );
    }
  }

  if (testing) {
    const satTotal = normalizeNumber(testing.satTotal);
    if (satTotal !== null) {
      target.testing.satTotal = Math.max(0, Math.round(satTotal));
    }

    const actComposite = normalizeNumber(testing.actComposite);
    if (actComposite !== null) {
      target.testing.actComposite = Math.max(0, Math.round(actComposite));
    }

    const englishExamType = normalizeEnum(
      testing.englishExamType,
      englishExamTypeOptions
    );
    if (englishExamType) {
      target.testing.englishExamType = englishExamType;
    }

    const englishExamScore = normalizeNumber(testing.englishExamScore);
    if (englishExamScore !== null) {
      target.testing.englishExamScore = englishExamScore;
    }

    if (typeof testing.willSubmitTests === "boolean") {
      target.testing.willSubmitTests = testing.willSubmitTests;
    }
  }

  if (preferences) {
    const intendedMajors = toTrimmedStringArray(preferences.intendedMajors);
    if (intendedMajors.length > 0) {
      target.preferences.intendedMajors = intendedMajors;
    }

    const preferredStates = normalizeStates(preferences.preferredStates);
    if (preferredStates.length > 0) {
      target.preferences.preferredStates = preferredStates;
    }

    const preferredLocationPreferences = normalizeLocationPreferences(
      preferences.preferredLocationPreferences
    );
    if (preferredLocationPreferences.length > 0) {
      target.preferences.preferredLocationPreferences =
        preferredLocationPreferences;
    }

    const preferredCampusLocale = normalizeCampusLocale(
      preferences.preferredCampusLocale
    );
    if (preferredCampusLocale.length > 0) {
      target.preferences.preferredCampusLocale = preferredCampusLocale;
    }

    const preferredSchoolControl = normalizeSchoolControl(
      preferences.preferredSchoolControl
    );
    if (preferredSchoolControl.length > 0) {
      target.preferences.preferredSchoolControl = preferredSchoolControl;
    }

    const preferredUndergraduateSize = normalizeEnum(
      preferences.preferredUndergraduateSize,
      preferredUndergraduateSizeOptions
    );
    if (preferredUndergraduateSize) {
      target.preferences.preferredUndergraduateSize =
        preferredUndergraduateSize;
    }
  }

  if (budget) {
    const annualBudgetUsd = normalizeNumber(budget.annualBudgetUsd);
    if (annualBudgetUsd !== null) {
      target.budget.annualBudgetUsd = Math.max(0, Math.round(annualBudgetUsd));
    }

    const needsFinancialAid = normalizeBoolean(budget.needsFinancialAid);
    if (needsFinancialAid !== null) {
      target.budget.needsFinancialAid = needsFinancialAid;
    }

    const needsMeritAid = normalizeBoolean(budget.needsMeritAid);
    if (needsMeritAid !== null) {
      target.budget.needsMeritAid = needsMeritAid;
    }

    const budgetFlexibility = normalizeEnum(
      budget.budgetFlexibility,
      budgetFlexibilityOptions
    );
    if (budgetFlexibility) {
      target.budget.budgetFlexibility = budgetFlexibility;
    }
  }

  if (readiness) {
    const wantsEarlyRound = normalizeBoolean(readiness.wantsEarlyRound);
    if (wantsEarlyRound !== null) {
      target.readiness.wantsEarlyRound = wantsEarlyRound;
    }

    const hasTeacherRecommendationsReady = normalizeBoolean(
      readiness.hasTeacherRecommendationsReady
    );
    if (hasTeacherRecommendationsReady !== null) {
      target.readiness.hasTeacherRecommendationsReady =
        hasTeacherRecommendationsReady;
    }

    const hasCounselorDocumentsReady = normalizeBoolean(
      readiness.hasCounselorDocumentsReady
    );
    if (hasCounselorDocumentsReady !== null) {
      target.readiness.hasCounselorDocumentsReady = hasCounselorDocumentsReady;
    }

    const hasEssayDraftsStarted = normalizeBoolean(
      readiness.hasEssayDraftsStarted
    );
    if (hasEssayDraftsStarted !== null) {
      target.readiness.hasEssayDraftsStarted = hasEssayDraftsStarted;
    }
  }
}

export function applyIntakeProfilePatches(input: {
  document: StudentProfileDocument | null;
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
}) {
  const next = input.document
    ? cloneStudentProfileDocument(input.document)
    : createEmptyStudentProfileDocument();

  patchProfile(next.current.profile, input.currentProfilePatch);
  patchProfile(next.projected.profile, input.projectedProfilePatch);

  syncProjectedBase(next);
  patchProfile(next.projected.profile, input.projectedProfilePatch);

  if (
    Array.isArray(input.projectedAssumptions) &&
    input.projectedAssumptions.length > 0
  ) {
    next.projected.assumptions = input.projectedAssumptions
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return next;
}
