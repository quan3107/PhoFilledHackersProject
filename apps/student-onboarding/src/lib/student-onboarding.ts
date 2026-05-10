// apps/student-onboarding/src/lib/student-onboarding.ts
// Client-side onboarding adapters for the student experience.
// Keeps summary and recommendation normalization logic close to the route components.
import {
  getStudentProfileMissingFields,
  type StudentProfile,
  type StudentProfileDocument,
  type StudentProfileMissingField,
} from "@/lib/student-profile";

export type StudentOnboardingRoute =
  | "chat"
  | "profile"
  | "results"
  | "review"
  | "settings";
export type StudentOnboardingSnapshotKind = "current" | "projected";

export interface StudentOnboardingSummaryItem {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "success";
}

export interface StudentOnboardingSummary {
  completion: number;
  missingCount: number;
  currentMissingCount: number;
  projectedMissingCount: number;
  currentHighlights: StudentOnboardingSummaryItem[];
  projectedHighlights: StudentOnboardingSummaryItem[];
  nextSteps: string[];
}

export interface StudentOnboardingRecommendationView {
  title: string;
  summary: string;
  items: StudentOnboardingSummaryItem[];
  rawPreview: string;
}

const totalMissingChecks = 22;

const cloneProfile = (profile: StudentProfile): StudentProfile => ({
  citizenshipCountry: profile.citizenshipCountry,
  targetEntryTerm: profile.targetEntryTerm,
  academic: { ...profile.academic },
  testing: { ...profile.testing },
  preferences: {
    intendedMajors: [...profile.preferences.intendedMajors],
    preferredStates: [...profile.preferences.preferredStates],
    preferredLocationPreferences: [
      ...profile.preferences.preferredLocationPreferences,
    ],
    preferredCampusLocale: [...profile.preferences.preferredCampusLocale],
    preferredSchoolControl: [...profile.preferences.preferredSchoolControl],
    preferredUndergraduateSize: profile.preferences.preferredUndergraduateSize,
  },
  budget: { ...profile.budget },
  readiness: { ...profile.readiness },
});

export const cloneStudentProfileDocument = (
  document: StudentProfileDocument
): StudentProfileDocument => ({
  current: {
    assumptions: [...document.current.assumptions],
    profile: cloneProfile(document.current.profile),
  },
  projected: {
    assumptions: [...document.projected.assumptions],
    profile: cloneProfile(document.projected.profile),
  },
});

export const syncProjectedBase = (document: StudentProfileDocument) => {
  document.projected.profile = {
    ...cloneProfile(document.current.profile),
    academic: {
      ...document.current.profile.academic,
      projectedGpa100: document.projected.profile.academic.projectedGpa100,
    },
  };
};

const fmt = {
  percent: (value: number | null) => (value === null ? "Not set" : `${value}%`),
  money: (value: number | null) =>
    value === null
      ? "Not set"
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value),
  list: (value: string[]) => (value.length ? value.join(", ") : "Not set"),
  bool: (value: boolean | null) =>
    value === null ? "Not set" : value ? "Yes" : "No",
};

const getSnapshotMissingCount = (
  fields: StudentProfileMissingField[],
  kind: StudentOnboardingSnapshotKind
) => fields.filter((field) => field.snapshotKind === kind).length;

export const buildStudentOnboardingSummary = (
  document: StudentProfileDocument
): StudentOnboardingSummary => {
  const missingFields = getStudentProfileMissingFields(document);

  return {
    completion: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          ((totalMissingChecks - missingFields.length) / totalMissingChecks) *
            100
        )
      )
    ),
    missingCount: missingFields.length,
    currentMissingCount: getSnapshotMissingCount(missingFields, "current"),
    projectedMissingCount: getSnapshotMissingCount(missingFields, "projected"),
    currentHighlights: [
      {
        label: "Country",
        value: document.current.profile.citizenshipCountry || "Not set",
      },
      {
        label: "Term",
        value: document.current.profile.targetEntryTerm || "Not set",
      },
      {
        label: "GPA",
        value: fmt.percent(document.current.profile.academic.currentGpa100),
      },
      {
        label: "Tests",
        value:
          document.current.profile.testing.willSubmitTests === null
            ? "Not set"
            : document.current.profile.testing.willSubmitTests
              ? "Will submit"
              : "Will not submit",
      },
      {
        label: "Majors",
        value: fmt.list(document.current.profile.preferences.intendedMajors),
      },
      {
        label: "Budget",
        value: fmt.money(document.current.profile.budget.annualBudgetUsd),
      },
    ],
    projectedHighlights: [
      {
        label: "Projected GPA",
        value: fmt.percent(document.projected.profile.academic.projectedGpa100),
      },
      {
        label: "Projected assumptions",
        value: document.projected.assumptions.length
          ? `${document.projected.assumptions.length} note(s)`
          : "Not set",
      },
      {
        label: "Budget flexibility",
        value: document.projected.profile.budget.budgetFlexibility,
      },
      {
        label: "Readiness",
        value: fmt.bool(
          document.projected.profile.readiness.hasEssayDraftsStarted
        ),
      },
    ],
    nextSteps: missingFields.slice(0, 5).map((field) => field.message),
  };
};

const extractItemLabel = (item: unknown, index: number) => {
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    if (
      record.school &&
      typeof record.school === "object" &&
      typeof (record.school as Record<string, unknown>).schoolName === "string"
    ) {
      return (record.school as Record<string, unknown>).schoolName as string;
    }
    if (typeof record.name === "string") return record.name;
    if (typeof record.schoolName === "string") return record.schoolName;
    if (typeof record.title === "string") return record.title;
    if (typeof record.label === "string") return record.label;
  }

  if (typeof item === "string") return item;
  return `Item ${index + 1}`;
};

const extractItemValue = (item: unknown) => {
  if (item && typeof item === "object") {
    const record = item as Record<string, unknown>;
    if (
      record.school &&
      typeof record.school === "object" &&
      typeof (record.school as Record<string, unknown>).schoolName === "string"
    ) {
      const school = record.school as Record<string, unknown>;
      const location = [school.city, school.state]
        .filter((value) => typeof value === "string" && value.length > 0)
        .join(", ");
      const tier =
        typeof record.tier === "string"
          ? record.tier.replaceAll("_", " ")
          : null;
      const outlook =
        typeof record.currentOutlook === "string"
          ? record.currentOutlook.replaceAll("_", " ")
          : null;
      const segments = [location, tier, outlook].filter(Boolean);

      return segments.length
        ? segments.join(" | ")
        : (school.schoolName as string);
    }
    if (typeof record.summary === "string") return record.summary;
    if (typeof record.description === "string") return record.description;
    if (typeof record.reason === "string") return record.reason;
    if (typeof record.value === "string") return record.value;
    return JSON.stringify(record, null, 2);
  }

  return typeof item === "string" ? item : String(item);
};

export const normalizeRecommendationData = (
  data: unknown
): StudentOnboardingRecommendationView => {
  const items: StudentOnboardingSummaryItem[] = [];

  if (Array.isArray(data)) {
    data.slice(0, 8).forEach((item, index) => {
      items.push({
        label: extractItemLabel(item, index),
        value: extractItemValue(item),
      });
    });
  } else if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const source = Array.isArray(record.recommendations)
      ? record.recommendations
      : Array.isArray(record.schools)
        ? record.schools
        : Array.isArray(record.results)
          ? record.results
          : Array.isArray(record.items)
            ? record.items
            : [];

    source.slice(0, 8).forEach((item, index) => {
      items.push({
        label: extractItemLabel(item, index),
        value: extractItemValue(item),
      });
    });

    Object.entries(record)
      .filter(
        ([, value]) =>
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
      )
      .slice(0, 4)
      .forEach(([key, value]) => {
        if (!items.some((item) => item.label === key)) {
          items.push({ label: key, value: String(value) });
        }
      });
  }

  const rawPreview =
    data === undefined
      ? ""
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  const title =
    data &&
    typeof data === "object" &&
    "title" in data &&
    typeof (data as Record<string, unknown>).title === "string"
      ? ((data as Record<string, unknown>).title as string)
      : items.length
        ? "Recommendation results"
        : "No recommendation data yet";

  const summary =
    items.length > 0
      ? `${items.length} item${items.length === 1 ? "" : "s"} ready to review.`
      : "Run recommendations to surface schools, gaps, and next steps.";

  return { title, summary, items, rawPreview };
};
