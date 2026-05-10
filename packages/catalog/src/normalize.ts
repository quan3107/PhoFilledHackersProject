// packages/catalog/src/normalize.ts
// Normalization helpers that coerce extracted ingest facts into catalog records.
// Fails fast with field-level issues so ingest runs can persist explicit diagnostics.

import type {
  CatalogNormalizationResult,
  NormalizedUniversityCatalogRecord,
  SelectedCatalogFieldSource,
} from "./types.js";
import {
  defaultUniversityExplanationInputs,
  defaultUniversityRecommendationInputs,
} from "@etest/db";
import {
  buildSourceMap,
  parseDeadlines,
  parseEnglishRequirements,
  parsePositiveInteger,
  parseRequiredMaterials,
  parseRequiredString,
  parseRounds,
  parseScholarshipFlag,
} from "./normalize-parsers.js";

export function normalizeUniversityCatalogRecord(
  selectedSources: SelectedCatalogFieldSource[],
  lastVerifiedAt: Date
): CatalogNormalizationResult {
  const issues: CatalogNormalizationResult["issues"] = [];
  const sourceMap = buildSourceMap(selectedSources);

  const schoolName = parseRequiredString("schoolName", sourceMap, issues);
  const city = parseRequiredString("city", sourceMap, issues);
  const state = parseRequiredString("state", sourceMap, issues);
  const officialAdmissionsUrl = parseRequiredString(
    "officialAdmissionsUrl",
    sourceMap,
    issues
  );
  const applicationRounds = parseRounds(sourceMap, issues);
  const deadlinesByRound = parseDeadlines(sourceMap, issues);
  const englishRequirements = parseEnglishRequirements(sourceMap, issues);
  const testPolicy = parseRequiredString("testPolicy", sourceMap, issues);
  const requiredMaterials = parseRequiredMaterials(sourceMap, issues);
  const tuitionAnnualUsd = parsePositiveInteger(
    "tuitionAnnualUsd",
    sourceMap,
    issues
  );
  const estimatedCostOfAttendanceUsd = parsePositiveInteger(
    "estimatedCostOfAttendanceUsd",
    sourceMap,
    issues
  );
  const livingCostEstimateUsd = parsePositiveInteger(
    "livingCostEstimateUsd",
    sourceMap,
    issues
  );
  const scholarshipAvailabilityFlag = parseScholarshipFlag(sourceMap, issues);
  const scholarshipNotes = parseRequiredString(
    "scholarshipNotes",
    sourceMap,
    issues
  );

  if (Number.isNaN(lastVerifiedAt.valueOf())) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "lastVerifiedAt",
      message: 'The selected value for "lastVerifiedAt" must be a valid date.',
    });
  }

  if (issues.length > 0) {
    return { record: null, issues };
  }

  const record: NormalizedUniversityCatalogRecord = {
    schoolName: schoolName!,
    city: city!,
    state: state!,
    officialAdmissionsUrl: officialAdmissionsUrl!,
    applicationRounds: applicationRounds!,
    deadlinesByRound: deadlinesByRound!,
    englishRequirements: englishRequirements!,
    testPolicy: testPolicy!,
    requiredMaterials: requiredMaterials!,
    tuitionAnnualUsd: tuitionAnnualUsd!,
    estimatedCostOfAttendanceUsd: estimatedCostOfAttendanceUsd!,
    livingCostEstimateUsd: livingCostEstimateUsd!,
    scholarshipAvailabilityFlag: scholarshipAvailabilityFlag!,
    scholarshipNotes: scholarshipNotes!,
    recommendationInputs: {
      ...defaultUniversityRecommendationInputs,
    },
    explanationInputs: {
      ...defaultUniversityExplanationInputs,
      deadlineUrgencyWindows: {
        ...defaultUniversityExplanationInputs.deadlineUrgencyWindows,
      },
    },
    lastVerifiedAt,
  };

  return { record, issues };
}
