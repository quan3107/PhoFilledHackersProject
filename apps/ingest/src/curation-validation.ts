// apps/ingest/src/curation-validation.ts
// Validation helpers for the non-database curation workflow.
// Keeps prompt/example shape checks close to the ingest CLI without touching persistence.

import {
  applicationRounds,
  testPolicies,
  curatedArtifactSchema,
  type ApplicationRound,
  type TestPolicy,
} from "@etest/api-contracts";
import type { SchoolSeed } from "./types.js";
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
  scoreReportingPolicies,
  standardizedTestExamKinds,
  superscorePolicies,
  testingExpectations,
  writingEssayPolicies,
  type UniversityExplanationInputs,
  type UniversityRecommendationInputs,
} from "@etest/db";

export const applicationRoundKeys = applicationRounds;

export const curationSourceKinds = [
  "official_admissions",
  "official_tuition",
  "official_cost_of_attendance",
  "official_scholarship",
  "public_dataset",
  "manual_note",
] as const;

export type CurationSourceKind = (typeof curationSourceKinds)[number];

export interface CuratedSchoolSeed extends SchoolSeed {
  usRank: number;
}

export interface CuratedProvenanceEntry {
  sourceKind: CurationSourceKind;
  sourceUrl: string;
  excerpt: string | null;
}

export interface CuratedSchoolArtifact {
  schoolSlug: string;
  lastVerifiedAt: string;
  identity: {
    schoolName: string;
    city: string;
    state: string;
    officialAdmissionsUrl: string;
  };
  applicationRounds: ApplicationRound[];
  deadlinesByRound: Partial<Record<ApplicationRound, string | null>>;
  englishRequirements: {
    minimumIelts: number | null;
    minimumToeflInternetBased: number | null;
    waiverNotes: string | null;
  };
  testPolicy: TestPolicy;
  requiredMaterials: string[];
  tuitionAnnualUsd: number;
  estimatedCostOfAttendanceUsd: number;
  livingCostEstimateUsd: number;
  scholarshipAvailabilityFlag: boolean;
  scholarshipNotes: string;
  recommendationInputs: UniversityRecommendationInputs;
  explanationInputs: UniversityExplanationInputs;
  fieldProvenance: Record<string, CuratedProvenanceEntry[]>;
  quality: {
    status: "publishable" | "needs_review";
    missingFields: string[];
    warnings: string[];
  };
}

export interface CurationIssue {
  path: string;
  message: string;
}

export interface CurationValidationResult {
  ok: boolean;
  issues: CurationIssue[];
  artifact: CuratedSchoolArtifact | null;
}

export function parseCuratedArtifactStrict(value: unknown) {
  return curatedArtifactSchema.parse(value);
}

type CurationArtifactCandidate = Record<keyof CuratedSchoolArtifact, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pushIssue(issues: CurationIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function expectString(
  value: unknown,
  path: string,
  issues: CurationIssue[],
  allowEmpty = false
) {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    pushIssue(issues, path, "Expected a non-empty string.");
    return null;
  }

  return value.trim();
}

function expectNumber(value: unknown, path: string, issues: CurationIssue[]) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    pushIssue(issues, path, "Expected a finite number.");
    return null;
  }

  return value;
}

function expectBoolean(value: unknown, path: string, issues: CurationIssue[]) {
  if (typeof value !== "boolean") {
    pushIssue(issues, path, "Expected a boolean.");
    return null;
  }

  return value;
}

function expectNullableString(
  value: unknown,
  path: string,
  issues: CurationIssue[],
  allowEmpty = false
) {
  if (value === null) {
    return null;
  }

  return expectString(value, path, issues, allowEmpty);
}

function expectEnum<T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
  issues: CurationIssue[]
) {
  const stringValue = expectString(value, path, issues);
  if (!stringValue) {
    return null;
  }

  if (!allowed.includes(stringValue as T[number])) {
    pushIssue(issues, path, `Expected one of: ${allowed.join(", ")}.`);
    return null;
  }

  return stringValue as T[number];
}

function expectStringArray(
  value: unknown,
  path: string,
  issues: CurationIssue[]
) {
  if (!Array.isArray(value)) {
    pushIssue(issues, path, "Expected an array of strings.");
    return null;
  }

  const result: string[] = [];
  value.forEach((item, index) => {
    const parsed = expectString(item, `${path}[${index}]`, issues);
    if (parsed) {
      result.push(parsed);
    }
  });

  return result;
}

function expectEnumArray<T extends readonly string[]>(
  value: unknown,
  path: string,
  issues: CurationIssue[],
  allowed: T
) {
  const items = expectStringArray(value, path, issues);
  if (!items) {
    return null;
  }

  const result: T[number][] = [];
  for (const [index, item] of items.entries()) {
    if (!allowed.includes(item as T[number])) {
      pushIssue(
        issues,
        `${path}[${index}]`,
        `Expected one of: ${allowed.join(", ")}.`
      );
      continue;
    }

    result.push(item as T[number]);
  }

  return result;
}

function expectDateString(
  value: unknown,
  path: string,
  issues: CurationIssue[]
) {
  const parsed = expectString(value, path, issues);
  if (!parsed) {
    return null;
  }

  if (Number.isNaN(new Date(parsed).valueOf())) {
    pushIssue(issues, path, "Expected a parseable date string.");
    return null;
  }

  return parsed;
}

function expectNullableNumber(
  value: unknown,
  path: string,
  issues: CurationIssue[]
) {
  return value === null ? null : expectNumber(value, path, issues);
}

function validateMiddle50Range(
  value: unknown,
  path: string,
  issues: CurationIssue[]
) {
  if (!isRecord(value)) {
    pushIssue(issues, path, "Expected an object with low and high values.");
    return null;
  }

  return {
    low: expectNullableNumber(value.low, `${path}.low`, issues),
    high: expectNullableNumber(value.high, `${path}.high`, issues),
  };
}

function validateTestingRequirements(value: unknown, issues: CurationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(
      issues,
      "recommendationInputs.testingRequirements",
      "Expected an object with exam rules, score reporting, and middle-50 ranges."
    );
    return null;
  }

  return {
    acceptedExams: expectEnumArray(
      value.acceptedExams,
      "recommendationInputs.testingRequirements.acceptedExams",
      issues,
      standardizedTestExamKinds
    ),
    minimumSatTotal: expectNullableNumber(
      value.minimumSatTotal,
      "recommendationInputs.testingRequirements.minimumSatTotal",
      issues
    ),
    minimumActComposite: expectNullableNumber(
      value.minimumActComposite,
      "recommendationInputs.testingRequirements.minimumActComposite",
      issues
    ),
    latestSatTestDateNote: expectNullableString(
      value.latestSatTestDateNote,
      "recommendationInputs.testingRequirements.latestSatTestDateNote",
      issues,
      true
    ),
    latestActTestDateNote: expectNullableString(
      value.latestActTestDateNote,
      "recommendationInputs.testingRequirements.latestActTestDateNote",
      issues,
      true
    ),
    superscorePolicy: expectEnum(
      value.superscorePolicy,
      "recommendationInputs.testingRequirements.superscorePolicy",
      superscorePolicies,
      issues
    ),
    writingEssayPolicy: expectEnum(
      value.writingEssayPolicy,
      "recommendationInputs.testingRequirements.writingEssayPolicy",
      writingEssayPolicies,
      issues
    ),
    scoreReportingPolicy: expectEnum(
      value.scoreReportingPolicy,
      "recommendationInputs.testingRequirements.scoreReportingPolicy",
      scoreReportingPolicies,
      issues
    ),
    middle50SatTotal: validateMiddle50Range(
      value.middle50SatTotal,
      "recommendationInputs.testingRequirements.middle50SatTotal",
      issues
    ),
    middle50ActComposite: validateMiddle50Range(
      value.middle50ActComposite,
      "recommendationInputs.testingRequirements.middle50ActComposite",
      issues
    ),
  };
}

function validateRecommendationInputs(
  value: unknown,
  issues: CurationIssue[]
): UniversityRecommendationInputs | null {
  if (!isRecord(value)) {
    pushIssue(issues, "recommendationInputs", "Expected an object.");
    return null;
  }

  const issueCountBefore = issues.length;
  const admissionRateOverall = value.admissionRateOverall;
  const satAverageOverall = value.satAverageOverall;
  const actMidpointCumulative = value.actMidpointCumulative;
  const undergraduateSize = value.undergraduateSize;
  const averageNetPriceUsd = value.averageNetPriceUsd;
  const schoolControl = expectEnum(
    value.schoolControl,
    "recommendationInputs.schoolControl",
    schoolControls,
    issues
  );
  const campusLocale = expectNullableString(
    value.campusLocale,
    "recommendationInputs.campusLocale",
    issues,
    true
  );
  const internationalAidPolicy = expectEnum(
    value.internationalAidPolicy,
    "recommendationInputs.internationalAidPolicy",
    internationalAidPolicies,
    issues
  );
  const hasNeedBasedAid =
    value.hasNeedBasedAid === null
      ? null
      : expectBoolean(
          value.hasNeedBasedAid,
          "recommendationInputs.hasNeedBasedAid",
          issues
        );
  const hasMeritAid =
    value.hasMeritAid === null
      ? null
      : expectBoolean(
          value.hasMeritAid,
          "recommendationInputs.hasMeritAid",
          issues
        );
  const programFitTagsValue = expectEnumArray(
    value.programFitTags,
    "recommendationInputs.programFitTags",
    issues,
    programFitTags
  );
  const programAdmissionModel = expectEnum(
    value.programAdmissionModel,
    "recommendationInputs.programAdmissionModel",
    programAdmissionModels,
    issues
  );
  const applicationStrategyTagsValue = expectEnumArray(
    value.applicationStrategyTags,
    "recommendationInputs.applicationStrategyTags",
    issues,
    applicationStrategyTags
  );
  const testingRequirements = validateTestingRequirements(
    value.testingRequirements,
    issues
  );

  const parsed = {
    admissionRateOverall: expectNullableNumber(
      admissionRateOverall,
      "recommendationInputs.admissionRateOverall",
      issues
    ),
    satAverageOverall: expectNullableNumber(
      satAverageOverall,
      "recommendationInputs.satAverageOverall",
      issues
    ),
    actMidpointCumulative: expectNullableNumber(
      actMidpointCumulative,
      "recommendationInputs.actMidpointCumulative",
      issues
    ),
    undergraduateSize: expectNullableNumber(
      undergraduateSize,
      "recommendationInputs.undergraduateSize",
      issues
    ),
    averageNetPriceUsd: expectNullableNumber(
      averageNetPriceUsd,
      "recommendationInputs.averageNetPriceUsd",
      issues
    ),
    schoolControl,
    campusLocale,
    internationalAidPolicy,
    hasNeedBasedAid,
    hasMeritAid,
    programFitTags: programFitTagsValue,
    programAdmissionModel,
    applicationStrategyTags: applicationStrategyTagsValue,
    testingRequirements,
  };

  return issues.length > issueCountBefore
    ? null
    : (parsed as UniversityRecommendationInputs);
}

function validateExplanationInputs(
  value: unknown,
  issues: CurationIssue[]
): UniversityExplanationInputs | null {
  if (!isRecord(value)) {
    pushIssue(issues, "explanationInputs", "Expected an object.");
    return null;
  }

  const deadlineUrgencyWindows = isRecord(value.deadlineUrgencyWindows)
    ? {
        earliestDeadline: expectNullableString(
          value.deadlineUrgencyWindows.earliestDeadline,
          "explanationInputs.deadlineUrgencyWindows.earliestDeadline",
          issues
        ),
        latestMajorDeadline: expectNullableString(
          value.deadlineUrgencyWindows.latestMajorDeadline,
          "explanationInputs.deadlineUrgencyWindows.latestMajorDeadline",
          issues
        ),
      }
    : null;

  const academicSelectivityBand = expectEnum(
    value.academicSelectivityBand,
    "explanationInputs.academicSelectivityBand",
    academicSelectivityBands,
    issues
  );
  const testingExpectation = expectEnum(
    value.testingExpectation,
    "explanationInputs.testingExpectation",
    testingExpectations,
    issues
  );
  const englishPolicySummary = expectEnum(
    value.englishPolicySummary,
    "explanationInputs.englishPolicySummary",
    englishPolicySummaries,
    issues
  );
  const aidModel = expectEnum(
    value.aidModel,
    "explanationInputs.aidModel",
    aidModels,
    issues
  );
  const applicationComplexity = expectEnum(
    value.applicationComplexity,
    "explanationInputs.applicationComplexity",
    applicationComplexities,
    issues
  );
  const internationalStudentConsiderations = expectEnumArray(
    value.internationalStudentConsiderations,
    "explanationInputs.internationalStudentConsiderations",
    issues,
    internationalStudentConsiderationTags
  );
  const potentialFitTags = expectEnumArray(
    value.potentialFitTags,
    "explanationInputs.potentialFitTags",
    issues,
    schoolFitTags
  );
  const potentialRiskTags = expectEnumArray(
    value.potentialRiskTags,
    "explanationInputs.potentialRiskTags",
    issues,
    schoolRiskTags
  );
  const actionableApplicationSteps = expectEnumArray(
    value.actionableApplicationSteps,
    "explanationInputs.actionableApplicationSteps",
    issues,
    applicationActionTags
  );

  if (!deadlineUrgencyWindows) {
    pushIssue(
      issues,
      "explanationInputs.deadlineUrgencyWindows",
      "Expected an object with earliestDeadline and latestMajorDeadline."
    );
  }

  return academicSelectivityBand &&
    testingExpectation &&
    englishPolicySummary &&
    aidModel &&
    applicationComplexity &&
    deadlineUrgencyWindows &&
    internationalStudentConsiderations &&
    potentialFitTags &&
    potentialRiskTags &&
    actionableApplicationSteps
    ? {
        academicSelectivityBand,
        testingExpectation,
        englishPolicySummary,
        aidModel,
        applicationComplexity,
        deadlineUrgencyWindows,
        internationalStudentConsiderations,
        potentialFitTags,
        potentialRiskTags,
        actionableApplicationSteps,
      }
    : null;
}

function validateFieldProvenance(value: unknown, issues: CurationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(
      issues,
      "fieldProvenance",
      "Expected an object of provenance arrays."
    );
    return null;
  }

  const provenance: Record<string, CuratedProvenanceEntry[]> = {};
  let entryCount = 0;

  for (const [fieldPath, entries] of Object.entries(value)) {
    if (!Array.isArray(entries) || entries.length === 0) {
      pushIssue(
        issues,
        `fieldProvenance.${fieldPath}`,
        "Expected a non-empty array."
      );
      continue;
    }

    provenance[fieldPath] = [];
    for (const [index, entry] of entries.entries()) {
      if (!isRecord(entry)) {
        pushIssue(
          issues,
          `fieldProvenance.${fieldPath}[${index}]`,
          "Expected an object."
        );
        continue;
      }

      const sourceKind = expectEnum(
        entry.sourceKind,
        `fieldProvenance.${fieldPath}[${index}].sourceKind`,
        curationSourceKinds,
        issues
      );
      const sourceUrl = expectString(
        entry.sourceUrl,
        `fieldProvenance.${fieldPath}[${index}].sourceUrl`,
        issues
      );
      const excerpt =
        entry.excerpt === null
          ? null
          : expectString(
              entry.excerpt,
              `fieldProvenance.${fieldPath}[${index}].excerpt`,
              issues,
              true
            );

      if (sourceKind && sourceUrl && excerpt !== undefined) {
        provenance[fieldPath].push({ sourceKind, sourceUrl, excerpt });
        entryCount += 1;
      }
    }
  }

  if (entryCount === 0) {
    pushIssue(
      issues,
      "fieldProvenance",
      "Expected at least one provenance entry."
    );
    return null;
  }

  return provenance;
}

function validateIdentity(value: unknown, issues: CurationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, "identity", "Expected an object.");
    return null;
  }

  return {
    schoolName: expectString(value.schoolName, "identity.schoolName", issues),
    city: expectString(value.city, "identity.city", issues),
    state: expectString(value.state, "identity.state", issues),
    officialAdmissionsUrl: expectString(
      value.officialAdmissionsUrl,
      "identity.officialAdmissionsUrl",
      issues
    ),
  };
}

function validateDeadlinesByRound(value: unknown, issues: CurationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, "deadlinesByRound", "Expected an object.");
    return null;
  }

  const result: Partial<Record<ApplicationRound, string | null>> = {};
  for (const round of applicationRoundKeys) {
    const deadline = value[round];
    if (deadline === undefined) {
      pushIssue(issues, `deadlinesByRound.${round}`, "Expected a value.");
      continue;
    }

    result[round] =
      deadline === null
        ? null
        : expectDateString(deadline, `deadlinesByRound.${round}`, issues);
  }

  return result;
}

function validateEnglishRequirements(value: unknown, issues: CurationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, "englishRequirements", "Expected an object.");
    return null;
  }

  return {
    minimumIelts: expectNullableNumber(
      value.minimumIelts,
      "englishRequirements.minimumIelts",
      issues
    ),
    minimumToeflInternetBased: expectNullableNumber(
      value.minimumToeflInternetBased,
      "englishRequirements.minimumToeflInternetBased",
      issues
    ),
    waiverNotes: expectNullableString(
      value.waiverNotes,
      "englishRequirements.waiverNotes",
      issues,
      true
    ),
  };
}

function validateQuality(value: unknown, issues: CurationIssue[]) {
  if (!isRecord(value)) {
    pushIssue(issues, "quality", "Expected an object.");
    return null;
  }

  const status = expectEnum(
    value.status,
    "quality.status",
    ["publishable", "needs_review"] as const,
    issues
  );
  const missingFields = expectStringArray(
    value.missingFields,
    "quality.missingFields",
    issues
  );
  const warnings = expectStringArray(
    value.warnings,
    "quality.warnings",
    issues
  );

  if (status === "publishable" && (missingFields?.length ?? 0) > 0) {
    pushIssue(
      issues,
      "quality.missingFields",
      "Publishable artifacts should not list missing fields."
    );
  }

  if (status === "needs_review" && (missingFields?.length ?? 0) === 0) {
    pushIssue(
      issues,
      "quality.missingFields",
      "Needs-review artifacts must list missing fields."
    );
  }

  return { status, missingFields, warnings };
}

function hasRequiredIdentity(artifact: CurationArtifactCandidate) {
  const identity = artifact.identity;
  if (!isRecord(identity)) {
    return false;
  }

  return Boolean(
    identity.schoolName &&
    identity.city &&
    identity.state &&
    identity.officialAdmissionsUrl
  );
}

function hasRequiredCostFields(artifact: CurationArtifactCandidate) {
  return Boolean(
    artifact.tuitionAnnualUsd !== null &&
    artifact.estimatedCostOfAttendanceUsd !== null &&
    artifact.livingCostEstimateUsd !== null &&
    artifact.scholarshipAvailabilityFlag !== null &&
    artifact.scholarshipNotes
  );
}

function hasRequiredNestedFields(artifact: CurationArtifactCandidate) {
  const quality = artifact.quality;
  if (!isRecord(quality)) {
    return false;
  }

  return Boolean(
    artifact.recommendationInputs &&
    artifact.explanationInputs &&
    artifact.fieldProvenance &&
    quality.status &&
    quality.missingFields &&
    quality.warnings
  );
}

function isValidCurationArtifact(
  artifact: CurationArtifactCandidate,
  issues: CurationIssue[]
) {
  return Boolean(
    artifact.schoolSlug &&
    artifact.lastVerifiedAt &&
    hasRequiredIdentity(artifact) &&
    artifact.applicationRounds &&
    artifact.deadlinesByRound &&
    artifact.englishRequirements &&
    artifact.testPolicy &&
    artifact.requiredMaterials &&
    hasRequiredCostFields(artifact) &&
    hasRequiredNestedFields(artifact) &&
    issues.length === 0
  );
}

export function validateCurationArtifact(
  raw: unknown,
  expectedSlug?: string
): CurationValidationResult {
  const issues: CurationIssue[] = [];
  if (!isRecord(raw)) {
    pushIssue(issues, "$", "Expected a JSON object.");
    return { ok: false, issues, artifact: null };
  }

  const schoolSlug = expectString(raw.schoolSlug, "schoolSlug", issues);
  if (expectedSlug && schoolSlug && schoolSlug !== expectedSlug) {
    pushIssue(issues, "schoolSlug", `Expected "${expectedSlug}".`);
  }

  const lastVerifiedAt = expectDateString(
    raw.lastVerifiedAt,
    "lastVerifiedAt",
    issues
  );
  const identity = validateIdentity(raw.identity, issues);

  const applicationRounds = expectEnumArray(
    raw.applicationRounds,
    "applicationRounds",
    issues,
    applicationRoundKeys
  );
  const deadlinesByRound = validateDeadlinesByRound(
    raw.deadlinesByRound,
    issues
  );
  const englishRequirements = validateEnglishRequirements(
    raw.englishRequirements,
    issues
  );
  const testPolicy = expectEnum(
    raw.testPolicy,
    "testPolicy",
    testPolicies,
    issues
  );
  const requiredMaterials = expectStringArray(
    raw.requiredMaterials,
    "requiredMaterials",
    issues
  );
  const tuitionAnnualUsd = expectNumber(
    raw.tuitionAnnualUsd,
    "tuitionAnnualUsd",
    issues
  );
  const estimatedCostOfAttendanceUsd = expectNumber(
    raw.estimatedCostOfAttendanceUsd,
    "estimatedCostOfAttendanceUsd",
    issues
  );
  const livingCostEstimateUsd = expectNumber(
    raw.livingCostEstimateUsd,
    "livingCostEstimateUsd",
    issues
  );
  const scholarshipAvailabilityFlag = expectBoolean(
    raw.scholarshipAvailabilityFlag,
    "scholarshipAvailabilityFlag",
    issues
  );
  const scholarshipNotes = expectString(
    raw.scholarshipNotes,
    "scholarshipNotes",
    issues
  );
  const recommendationInputs = validateRecommendationInputs(
    raw.recommendationInputs,
    issues
  );
  const explanationInputs = validateExplanationInputs(
    raw.explanationInputs,
    issues
  );
  const fieldProvenance = validateFieldProvenance(raw.fieldProvenance, issues);
  const quality = validateQuality(raw.quality, issues);

  const artifact = {
    schoolSlug,
    lastVerifiedAt,
    identity,
    applicationRounds,
    deadlinesByRound,
    englishRequirements,
    testPolicy,
    requiredMaterials,
    tuitionAnnualUsd,
    estimatedCostOfAttendanceUsd,
    livingCostEstimateUsd,
    scholarshipAvailabilityFlag,
    scholarshipNotes,
    recommendationInputs,
    explanationInputs,
    fieldProvenance,
    quality: quality
      ? {
          status: quality.status,
          missingFields: quality.missingFields,
          warnings: quality.warnings,
        }
      : null,
  };
  const ok = isValidCurationArtifact(artifact, issues);

  return {
    ok,
    issues,
    artifact: ok ? (artifact as CuratedSchoolArtifact) : null,
  };
}

export function buildCurationArtifactExample(
  seed: CuratedSchoolSeed
): CuratedSchoolArtifact {
  return {
    schoolSlug: seed.slug,
    lastVerifiedAt: new Date().toISOString().slice(0, 10),
    identity: {
      schoolName: seed.schoolName,
      city: "UNKNOWN",
      state: "UNKNOWN",
      officialAdmissionsUrl: "https://example.edu/admissions",
    },
    applicationRounds: ["early_action", "regular_decision"],
    deadlinesByRound: {
      early_action: null,
      early_decision: null,
      regular_decision: null,
      rolling_admission: null,
      priority: null,
    },
    englishRequirements: {
      minimumIelts: null,
      minimumToeflInternetBased: null,
      waiverNotes: null,
    },
    testPolicy: "unknown",
    requiredMaterials: [],
    tuitionAnnualUsd: 0,
    estimatedCostOfAttendanceUsd: 0,
    livingCostEstimateUsd: 0,
    scholarshipAvailabilityFlag: false,
    scholarshipNotes: "UNKNOWN",
    recommendationInputs: {
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
    },
    explanationInputs: {
      ...defaultUniversityExplanationInputs,
    },
    fieldProvenance: {
      "identity.schoolName": [
        {
          sourceKind: "official_admissions",
          sourceUrl: "https://example.edu/admissions",
          excerpt: seed.schoolName,
        },
      ],
      "recommendationInputs.admissionRateOverall": [
        {
          sourceKind: "public_dataset",
          sourceUrl: "https://api.data.gov/ed/collegescorecard/v1/schools",
          excerpt: '"latest.admissions.admission_rate.overall": 0.0391',
        },
      ],
    },
    quality: {
      status: "needs_review",
      missingFields: [
        "identity.city",
        "identity.state",
        "identity.officialAdmissionsUrl",
      ],
      warnings: [
        "Example output only; replace placeholders with sourced values.",
      ],
    },
  };
}
