// apps/ingest/src/curation-validation.ts
// Validation helpers for the non-database curation workflow.
// Keeps prompt/example shape checks close to the ingest CLI without touching persistence.

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
  type ApplicationRound,
  type UniversityExplanationInputs,
  type UniversityRecommendationInputs,
} from "@etest/db";

export const applicationRoundKeys = [
  "early_action",
  "early_decision",
  "regular_decision",
  "rolling_admission",
  "priority",
] as const satisfies readonly ApplicationRound[];

export const curationSourceKinds = [
  "official_admissions",
  "official_tuition",
  "official_cost_of_attendance",
  "official_scholarship",
  "public_dataset",
  "manual_note",
] as const;

export type CurationSourceKind = (typeof curationSourceKinds)[number];

export interface CuratedSchoolSeed {
  usRank: number;
  slug: string;
  schoolName: string;
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
  testPolicy:
    | "required"
    | "test_optional"
    | "test_flexible"
    | "test_blind"
    | "unknown";
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
  const rawTestingRequirements = value.testingRequirements;
  const testingRequirementsInput = isRecord(rawTestingRequirements)
    ? rawTestingRequirements
    : null;
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
  const testingRequirements = testingRequirementsInput
    ? {
        acceptedExams: expectEnumArray(
          testingRequirementsInput.acceptedExams,
          "recommendationInputs.testingRequirements.acceptedExams",
          issues,
          standardizedTestExamKinds
        ),
        minimumSatTotal:
          testingRequirementsInput.minimumSatTotal === null
            ? null
            : expectNumber(
                testingRequirementsInput.minimumSatTotal,
                "recommendationInputs.testingRequirements.minimumSatTotal",
                issues
              ),
        minimumActComposite:
          testingRequirementsInput.minimumActComposite === null
            ? null
            : expectNumber(
                testingRequirementsInput.minimumActComposite,
                "recommendationInputs.testingRequirements.minimumActComposite",
                issues
              ),
        latestSatTestDateNote: expectNullableString(
          testingRequirementsInput.latestSatTestDateNote,
          "recommendationInputs.testingRequirements.latestSatTestDateNote",
          issues,
          true
        ),
        latestActTestDateNote: expectNullableString(
          testingRequirementsInput.latestActTestDateNote,
          "recommendationInputs.testingRequirements.latestActTestDateNote",
          issues,
          true
        ),
        superscorePolicy: expectEnum(
          testingRequirementsInput.superscorePolicy,
          "recommendationInputs.testingRequirements.superscorePolicy",
          superscorePolicies,
          issues
        ),
        writingEssayPolicy: expectEnum(
          testingRequirementsInput.writingEssayPolicy,
          "recommendationInputs.testingRequirements.writingEssayPolicy",
          writingEssayPolicies,
          issues
        ),
        scoreReportingPolicy: expectEnum(
          testingRequirementsInput.scoreReportingPolicy,
          "recommendationInputs.testingRequirements.scoreReportingPolicy",
          scoreReportingPolicies,
          issues
        ),
        middle50SatTotal: isRecord(testingRequirementsInput.middle50SatTotal)
          ? {
              low:
                testingRequirementsInput.middle50SatTotal.low === null
                  ? null
                  : expectNumber(
                      testingRequirementsInput.middle50SatTotal.low,
                      "recommendationInputs.testingRequirements.middle50SatTotal.low",
                      issues
                    ),
              high:
                testingRequirementsInput.middle50SatTotal.high === null
                  ? null
                  : expectNumber(
                      testingRequirementsInput.middle50SatTotal.high,
                      "recommendationInputs.testingRequirements.middle50SatTotal.high",
                      issues
                    ),
            }
          : null,
        middle50ActComposite: isRecord(
          testingRequirementsInput.middle50ActComposite
        )
          ? {
              low:
                testingRequirementsInput.middle50ActComposite.low === null
                  ? null
                  : expectNumber(
                      testingRequirementsInput.middle50ActComposite.low,
                      "recommendationInputs.testingRequirements.middle50ActComposite.low",
                      issues
                    ),
              high:
                testingRequirementsInput.middle50ActComposite.high === null
                  ? null
                  : expectNumber(
                      testingRequirementsInput.middle50ActComposite.high,
                      "recommendationInputs.testingRequirements.middle50ActComposite.high",
                      issues
                    ),
            }
          : null,
      }
    : null;

  if (
    testingRequirements &&
    testingRequirementsInput &&
    !isRecord(testingRequirementsInput.middle50SatTotal)
  ) {
    pushIssue(
      issues,
      "recommendationInputs.testingRequirements.middle50SatTotal",
      "Expected an object with low and high values."
    );
  }

  if (
    testingRequirements &&
    testingRequirementsInput &&
    !isRecord(testingRequirementsInput.middle50ActComposite)
  ) {
    pushIssue(
      issues,
      "recommendationInputs.testingRequirements.middle50ActComposite",
      "Expected an object with low and high values."
    );
  }

  const parsed = {
    admissionRateOverall:
      admissionRateOverall === null
        ? null
        : expectNumber(
            admissionRateOverall,
            "recommendationInputs.admissionRateOverall",
            issues
          ),
    satAverageOverall:
      satAverageOverall === null
        ? null
        : expectNumber(
            satAverageOverall,
            "recommendationInputs.satAverageOverall",
            issues
          ),
    actMidpointCumulative:
      actMidpointCumulative === null
        ? null
        : expectNumber(
            actMidpointCumulative,
            "recommendationInputs.actMidpointCumulative",
            issues
          ),
    undergraduateSize:
      undergraduateSize === null
        ? null
        : expectNumber(
            undergraduateSize,
            "recommendationInputs.undergraduateSize",
            issues
          ),
    averageNetPriceUsd:
      averageNetPriceUsd === null
        ? null
        : expectNumber(
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

  if (!testingRequirements) {
    pushIssue(
      issues,
      "recommendationInputs.testingRequirements",
      "Expected an object with exam rules, score reporting, and middle-50 ranges."
    );
  }

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
  const identity = isRecord(raw.identity)
    ? {
        schoolName: expectString(
          raw.identity.schoolName,
          "identity.schoolName",
          issues
        ),
        city: expectString(raw.identity.city, "identity.city", issues),
        state: expectString(raw.identity.state, "identity.state", issues),
        officialAdmissionsUrl: expectString(
          raw.identity.officialAdmissionsUrl,
          "identity.officialAdmissionsUrl",
          issues
        ),
      }
    : (pushIssue(issues, "identity", "Expected an object."), null);

  const applicationRounds = expectEnumArray(
    raw.applicationRounds,
    "applicationRounds",
    issues,
    applicationRoundKeys
  );
  const deadlinesByRound = isRecord(raw.deadlinesByRound)
    ? (() => {
        const result: Partial<Record<ApplicationRound, string | null>> = {};
        for (const round of applicationRoundKeys) {
          const value = raw.deadlinesByRound[round];
          if (value === undefined) {
            pushIssue(issues, `deadlinesByRound.${round}`, "Expected a value.");
            continue;
          }

          result[round] =
            value === null
              ? null
              : expectDateString(value, `deadlinesByRound.${round}`, issues);
        }
        return result;
      })()
    : (pushIssue(issues, "deadlinesByRound", "Expected an object."), null);
  const englishRequirements = isRecord(raw.englishRequirements)
    ? {
        minimumIelts:
          raw.englishRequirements.minimumIelts === null
            ? null
            : expectNumber(
                raw.englishRequirements.minimumIelts,
                "englishRequirements.minimumIelts",
                issues
              ),
        minimumToeflInternetBased:
          raw.englishRequirements.minimumToeflInternetBased === null
            ? null
            : expectNumber(
                raw.englishRequirements.minimumToeflInternetBased,
                "englishRequirements.minimumToeflInternetBased",
                issues
              ),
        waiverNotes: expectNullableString(
          raw.englishRequirements.waiverNotes,
          "englishRequirements.waiverNotes",
          issues,
          true
        ),
      }
    : (pushIssue(issues, "englishRequirements", "Expected an object."), null);
  const testPolicy = expectEnum(
    raw.testPolicy,
    "testPolicy",
    [
      "required",
      "test_optional",
      "test_flexible",
      "test_blind",
      "unknown",
    ] as const,
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

  if (!isRecord(raw.quality)) {
    pushIssue(issues, "quality", "Expected an object.");
  }

  const qualityStatus = isRecord(raw.quality)
    ? expectEnum(
        raw.quality.status,
        "quality.status",
        ["publishable", "needs_review"] as const,
        issues
      )
    : null;
  const missingFields = isRecord(raw.quality)
    ? expectStringArray(
        raw.quality.missingFields,
        "quality.missingFields",
        issues
      )
    : null;
  const warnings = isRecord(raw.quality)
    ? expectStringArray(raw.quality.warnings, "quality.warnings", issues)
    : null;

  if (qualityStatus === "publishable" && (missingFields?.length ?? 0) > 0) {
    pushIssue(
      issues,
      "quality.missingFields",
      "Publishable artifacts should not list missing fields."
    );
  }

  if (qualityStatus === "needs_review" && (missingFields?.length ?? 0) === 0) {
    pushIssue(
      issues,
      "quality.missingFields",
      "Needs-review artifacts must list missing fields."
    );
  }

  const ok =
    !!schoolSlug &&
    !!lastVerifiedAt &&
    !!identity?.schoolName &&
    !!identity?.city &&
    !!identity?.state &&
    !!identity?.officialAdmissionsUrl &&
    !!applicationRounds &&
    !!deadlinesByRound &&
    !!englishRequirements &&
    !!testPolicy &&
    !!requiredMaterials &&
    tuitionAnnualUsd !== null &&
    estimatedCostOfAttendanceUsd !== null &&
    livingCostEstimateUsd !== null &&
    scholarshipAvailabilityFlag !== null &&
    !!scholarshipNotes &&
    !!recommendationInputs &&
    !!explanationInputs &&
    !!fieldProvenance &&
    !!qualityStatus &&
    !!missingFields &&
    !!warnings &&
    issues.length === 0;

  return {
    ok,
    issues,
    artifact: ok
      ? ({
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
          quality: {
            status: qualityStatus,
            missingFields,
            warnings,
          },
        } as CuratedSchoolArtifact)
      : null,
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
