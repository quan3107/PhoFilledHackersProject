// apps/ingest/src/normalize-parsers.ts
// Low-level parsing helpers used by ingest normalization.
// Splitting these helpers keeps the main normalization module under the repo file-size limit.

import {
  academicSelectivityBands,
  aidModels,
  applicationActionTags,
  applicationComplexities,
  applicationStrategyTags,
  defaultUniversityExplanationInputs,
  defaultUniversityRecommendationInputs,
  englishPolicySummaries,
  internationalAidPolicies,
  internationalStudentConsiderationTags,
  programAdmissionModels,
  programFitTags,
  schoolControls,
  schoolFitTags,
  schoolRiskTags,
  testingExpectations,
  type ApplicationRound,
  type DeadlinesByRound,
  type EnglishRequirements,
  type UniversityExplanationInputs,
  type UniversityRecommendationInputs,
} from "@etest/db";

import type { SchoolExtractionDraft, SeedSchool } from "./types.js";

const roundAliases: Record<string, ApplicationRound> = {
  "early action": "early_action",
  early_action: "early_action",
  ea: "early_action",
  "early decision": "early_decision",
  early_decision: "early_decision",
  ed: "early_decision",
  "regular decision": "regular_decision",
  regular_decision: "regular_decision",
  rd: "regular_decision",
  "rolling admission": "rolling_admission",
  rolling_admission: "rolling_admission",
  rolling: "rolling_admission",
  priority: "priority",
};

export function normalizeComparableText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeComparableUrl(value: string) {
  return new URL(value.trim()).toString().replace(/\/$/, "");
}

export function assertMatchingIdentity(
  seed: SeedSchool,
  draft: SchoolExtractionDraft["identity"]
) {
  if (
    normalizeComparableText(seed.schoolName) !==
      normalizeComparableText(draft.schoolName) ||
    normalizeComparableText(seed.city) !==
      normalizeComparableText(draft.city) ||
    normalizeComparableText(seed.state) !==
      normalizeComparableText(draft.state) ||
    normalizeComparableUrl(seed.officialAdmissionsUrl) !==
      normalizeComparableUrl(draft.officialAdmissionsUrl)
  ) {
    throw new Error(
      `OpenAI extraction identity does not match the configured school seed "${seed.slug}".`
    );
  }
}

export function normalizeString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing or empty string for "${fieldName}".`);
  }

  return value.trim();
}

export function normalizeOptionalString(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  return normalizeString(value, "optional string");
}

export function normalizeBoolean(value: unknown, fieldName: string) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "no" || normalized === "0") {
      return false;
    }
  }

  throw new Error(`Missing or invalid boolean for "${fieldName}".`);
}

export function normalizeCurrency(value: unknown, fieldName: string) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const digits = value.replace(/[^0-9.]/g, "");
    const parsed = Number(digits);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.round(parsed);
    }
  }

  throw new Error(`Missing or invalid currency value for "${fieldName}".`);
}

export function normalizeApplicationRound(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Application round values must be strings.");
  }

  const normalized = roundAliases[value.trim().toLowerCase()];
  if (!normalized) {
    throw new Error(`Unsupported application round "${value}".`);
  }

  return normalized;
}

export function normalizeApplicationRounds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Application rounds must be a non-empty array.");
  }

  return Array.from(new Set(value.map(normalizeApplicationRound)));
}

export function normalizeDateString(value: unknown, fieldName: string) {
  const text = normalizeString(value, fieldName);
  const parsed = new Date(text);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error(`Invalid date value for "${fieldName}".`);
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeDeadlinesByRound(value: unknown): DeadlinesByRound {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Deadlines by round must be an object.");
  }

  const normalized: DeadlinesByRound = {};
  for (const [key, deadline] of Object.entries(value)) {
    if (
      deadline === null ||
      typeof deadline === "undefined" ||
      deadline === ""
    ) {
      continue;
    }

    const round = normalizeApplicationRound(key);
    normalized[round] = normalizeDateString(
      deadline,
      `deadlinesByRound.${key}`
    );
  }

  if (Object.keys(normalized).length === 0) {
    throw new Error(
      "Deadlines by round must include at least one populated deadline."
    );
  }

  return normalized;
}

export function normalizeEnglishRequirements(
  value: unknown
): EnglishRequirements {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("English requirements must be an object.");
  }

  const requirements = value as Record<string, unknown>;
  const parseNullableNumber = (input: unknown, fieldName: string) => {
    if (input === null || typeof input === "undefined" || input === "") {
      return null;
    }

    if (typeof input === "number" && Number.isFinite(input) && input > 0) {
      return input;
    }

    if (typeof input === "string") {
      const parsed = Number(input.trim());
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }

    throw new Error(`Invalid number for "${fieldName}".`);
  };

  return {
    minimumIelts: parseNullableNumber(
      requirements.minimumIelts,
      "englishRequirements.minimumIelts"
    ),
    minimumToeflInternetBased: parseNullableNumber(
      requirements.minimumToeflInternetBased,
      "englishRequirements.minimumToeflInternetBased"
    ),
    waiverNotes: normalizeOptionalString(requirements.waiverNotes),
  };
}

export function normalizeStringArray(value: unknown, fieldName: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array.`);
  }

  const normalized = value
    .map((entry) => normalizeString(entry, fieldName))
    .filter((entry) => entry.length > 0);

  if (normalized.length === 0) {
    throw new Error(`${fieldName} must contain at least one non-empty value.`);
  }

  return Array.from(new Set(normalized));
}

function normalizeNullableNumber(value: unknown) {
  if (value === null || typeof value === "undefined" || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeEnumValue<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number]
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return (allowed as readonly string[]).includes(normalized)
    ? (normalized as T[number])
    : fallback;
}

function normalizeTagArray<T extends readonly string[]>(
  value: unknown,
  allowed: T
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value.flatMap((entry) => {
        if (typeof entry !== "string") {
          return [];
        }

        const normalized = entry.trim().toLowerCase();
        return (allowed as readonly string[]).includes(normalized)
          ? [normalized as T[number]]
          : [];
      })
    )
  );
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneDefaultRecommendationInputs(): UniversityRecommendationInputs {
  return {
    ...defaultUniversityRecommendationInputs,
    testingRequirements: {
      ...defaultUniversityRecommendationInputs.testingRequirements,
      middle50SatTotal: {
        ...defaultUniversityRecommendationInputs.testingRequirements
          .middle50SatTotal,
      },
      middle50ActComposite: {
        ...defaultUniversityRecommendationInputs.testingRequirements
          .middle50ActComposite,
      },
    },
  };
}

function normalizeOptionalTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function normalizeAcceptedExams(value: unknown): ("sat" | "act")[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (typeof entry !== "string") {
      return [];
    }

    const normalized = entry.trim().toLowerCase();
    return normalized === "sat" || normalized === "act" ? [normalized] : [];
  });
}

function normalizeTestingRequirements(input: Record<string, unknown>) {
  const testingRequirements = isUnknownRecord(input.testingRequirements)
    ? input.testingRequirements
    : {};
  const middle50SatTotal = isUnknownRecord(testingRequirements.middle50SatTotal)
    ? testingRequirements.middle50SatTotal
    : {};
  const middle50ActComposite = isUnknownRecord(
    testingRequirements.middle50ActComposite
  )
    ? testingRequirements.middle50ActComposite
    : {};

  return {
    acceptedExams: normalizeAcceptedExams(testingRequirements.acceptedExams),
    minimumSatTotal: normalizeNullableNumber(
      testingRequirements.minimumSatTotal
    ),
    minimumActComposite: normalizeNullableNumber(
      testingRequirements.minimumActComposite
    ),
    latestSatTestDateNote: normalizeOptionalTrimmedString(
      testingRequirements.latestSatTestDateNote
    ),
    latestActTestDateNote: normalizeOptionalTrimmedString(
      testingRequirements.latestActTestDateNote
    ),
    superscorePolicy: normalizeEnumValue(
      testingRequirements.superscorePolicy,
      ["sat_only", "act_only", "both", "none", "unknown"] as const,
      defaultUniversityRecommendationInputs.testingRequirements.superscorePolicy
    ),
    writingEssayPolicy: normalizeEnumValue(
      testingRequirements.writingEssayPolicy,
      ["required", "optional", "not_considered", "unknown"] as const,
      defaultUniversityRecommendationInputs.testingRequirements
        .writingEssayPolicy
    ),
    scoreReportingPolicy: normalizeEnumValue(
      testingRequirements.scoreReportingPolicy,
      [
        "self_report_allowed",
        "official_required_upfront",
        "official_required_after_admit",
        "unknown",
      ] as const,
      defaultUniversityRecommendationInputs.testingRequirements
        .scoreReportingPolicy
    ),
    middle50SatTotal: {
      low: normalizeNullableNumber(middle50SatTotal.low),
      high: normalizeNullableNumber(middle50SatTotal.high),
    },
    middle50ActComposite: {
      low: normalizeNullableNumber(middle50ActComposite.low),
      high: normalizeNullableNumber(middle50ActComposite.high),
    },
  };
}

export function normalizeRecommendationInputs(
  value: unknown
): UniversityRecommendationInputs {
  if (!isUnknownRecord(value)) {
    return cloneDefaultRecommendationInputs();
  }

  const input = value;

  return {
    admissionRateOverall: normalizeNullableNumber(input.admissionRateOverall),
    satAverageOverall: normalizeNullableNumber(input.satAverageOverall),
    actMidpointCumulative: normalizeNullableNumber(input.actMidpointCumulative),
    undergraduateSize: normalizeNullableNumber(input.undergraduateSize),
    averageNetPriceUsd: normalizeNullableNumber(input.averageNetPriceUsd),
    schoolControl: normalizeEnumValue(
      input.schoolControl,
      schoolControls,
      defaultUniversityRecommendationInputs.schoolControl
    ),
    campusLocale: normalizeOptionalTrimmedString(input.campusLocale),
    internationalAidPolicy: normalizeEnumValue(
      input.internationalAidPolicy,
      internationalAidPolicies,
      defaultUniversityRecommendationInputs.internationalAidPolicy
    ),
    hasNeedBasedAid:
      typeof input.hasNeedBasedAid === "boolean" ? input.hasNeedBasedAid : null,
    hasMeritAid:
      typeof input.hasMeritAid === "boolean" ? input.hasMeritAid : null,
    programFitTags: normalizeTagArray(input.programFitTags, programFitTags),
    programAdmissionModel: normalizeEnumValue(
      input.programAdmissionModel,
      programAdmissionModels,
      defaultUniversityRecommendationInputs.programAdmissionModel
    ),
    applicationStrategyTags: normalizeTagArray(
      input.applicationStrategyTags,
      applicationStrategyTags
    ),
    testingRequirements: normalizeTestingRequirements(input),
  };
}

export function normalizeExplanationInputs(
  value: unknown
): UniversityExplanationInputs {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {
      ...defaultUniversityExplanationInputs,
      deadlineUrgencyWindows: {
        ...defaultUniversityExplanationInputs.deadlineUrgencyWindows,
      },
    };
  }

  const input = value as Record<string, unknown>;
  const windows =
    typeof input.deadlineUrgencyWindows === "object" &&
    input.deadlineUrgencyWindows !== null &&
    !Array.isArray(input.deadlineUrgencyWindows)
      ? (input.deadlineUrgencyWindows as Record<string, unknown>)
      : {};

  return {
    academicSelectivityBand: normalizeEnumValue(
      input.academicSelectivityBand,
      academicSelectivityBands,
      defaultUniversityExplanationInputs.academicSelectivityBand
    ),
    testingExpectation: normalizeEnumValue(
      input.testingExpectation,
      testingExpectations,
      defaultUniversityExplanationInputs.testingExpectation
    ),
    englishPolicySummary: normalizeEnumValue(
      input.englishPolicySummary,
      englishPolicySummaries,
      defaultUniversityExplanationInputs.englishPolicySummary
    ),
    aidModel: normalizeEnumValue(
      input.aidModel,
      aidModels,
      defaultUniversityExplanationInputs.aidModel
    ),
    applicationComplexity: normalizeEnumValue(
      input.applicationComplexity,
      applicationComplexities,
      defaultUniversityExplanationInputs.applicationComplexity
    ),
    deadlineUrgencyWindows: {
      earliestDeadline:
        windows.earliestDeadline === null
          ? null
          : typeof windows.earliestDeadline === "undefined"
            ? null
            : normalizeDateString(
                windows.earliestDeadline,
                "explanationInputs.deadlineUrgencyWindows.earliestDeadline"
              ),
      latestMajorDeadline:
        windows.latestMajorDeadline === null
          ? null
          : typeof windows.latestMajorDeadline === "undefined"
            ? null
            : normalizeDateString(
                windows.latestMajorDeadline,
                "explanationInputs.deadlineUrgencyWindows.latestMajorDeadline"
              ),
    },
    internationalStudentConsiderations: normalizeTagArray(
      input.internationalStudentConsiderations,
      internationalStudentConsiderationTags
    ),
    potentialFitTags: normalizeTagArray(input.potentialFitTags, schoolFitTags),
    potentialRiskTags: normalizeTagArray(
      input.potentialRiskTags,
      schoolRiskTags
    ),
    actionableApplicationSteps: normalizeTagArray(
      input.actionableApplicationSteps,
      applicationActionTags
    ),
  };
}
