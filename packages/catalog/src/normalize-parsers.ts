// packages/catalog/src/normalize-parsers.ts
// Shared parsing helpers for ingest normalization.
// Keeps the main normalization entrypoint under the repo's file-size limit.

import { applicationRounds } from "@etest/api-contracts";
import type {
  ApplicationRound,
  CatalogRequiredField,
} from "@etest/api-contracts";
import type { DeadlinesByRound, EnglishRequirements } from "@etest/db";

import type {
  CatalogNormalizationResult,
  SelectedCatalogFieldSource,
} from "./types.js";

const validRounds: readonly ApplicationRound[] = applicationRounds;

export type SelectedSourceMap = Partial<
  Record<
    Exclude<CatalogRequiredField, "lastVerifiedAt">,
    SelectedCatalogFieldSource
  >
>;

export function buildSourceMap(selectedSources: SelectedCatalogFieldSource[]) {
  return selectedSources.reduce<SelectedSourceMap>((map, source) => {
    map[source.fieldKey] = source;
    return map;
  }, {});
}

function pushMissingSourceIssue(
  fieldKey: CatalogRequiredField,
  issues: CatalogNormalizationResult["issues"]
) {
  issues.push({
    code: "missing_selected_source",
    fieldKey,
    message: `No selected source exists for "${fieldKey}".`,
  });
}

function readSource(
  fieldKey: Exclude<CatalogRequiredField, "lastVerifiedAt">,
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = sourceMap[fieldKey];
  if (!source) {
    pushMissingSourceIssue(fieldKey, issues);
    return null;
  }

  return source;
}

export function parseRequiredString(
  fieldKey: Exclude<CatalogRequiredField, "lastVerifiedAt">,
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource(fieldKey, sourceMap, issues);
  if (!source) {
    return null;
  }

  if (typeof source.value !== "string" || source.value.trim().length === 0) {
    issues.push({
      code: "invalid_field_value",
      fieldKey,
      message: `The selected value for "${fieldKey}" must be a non-empty string.`,
    });
    return null;
  }

  return source.value.trim();
}

export function parsePositiveInteger(
  fieldKey:
    | "tuitionAnnualUsd"
    | "estimatedCostOfAttendanceUsd"
    | "livingCostEstimateUsd",
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource(fieldKey, sourceMap, issues);
  if (!source) {
    return null;
  }

  const numericValue =
    typeof source.value === "number"
      ? source.value
      : Number.parseInt(String(source.value), 10);

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    issues.push({
      code: "invalid_field_value",
      fieldKey,
      message: `The selected value for "${fieldKey}" must be a positive number.`,
    });
    return null;
  }

  return Math.round(numericValue);
}

export function parseRounds(
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource("applicationRounds", sourceMap, issues);
  if (!source) {
    return null;
  }

  if (!Array.isArray(source.value)) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "applicationRounds",
      message: 'The selected value for "applicationRounds" must be an array.',
    });
    return null;
  }

  const rounds = source.value.filter(
    (value): value is ApplicationRound =>
      typeof value === "string" &&
      validRounds.includes(value as ApplicationRound)
  );

  if (rounds.length === 0) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "applicationRounds",
      message:
        'The selected value for "applicationRounds" must contain valid rounds.',
    });
    return null;
  }

  return rounds;
}

export function parseDeadlines(
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource("deadlinesByRound", sourceMap, issues);
  if (!source) {
    return null;
  }

  if (typeof source.value !== "object" || source.value === null) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "deadlinesByRound",
      message: 'The selected value for "deadlinesByRound" must be an object.',
    });
    return null;
  }

  const deadlines = Object.entries(source.value).reduce<DeadlinesByRound>(
    (result, [round, deadline]) => {
      if (
        validRounds.includes(round as ApplicationRound) &&
        typeof deadline === "string" &&
        deadline.trim().length > 0
      ) {
        result[round as ApplicationRound] = deadline.trim();
      }
      return result;
    },
    {}
  );

  if (Object.keys(deadlines).length === 0) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "deadlinesByRound",
      message:
        'The selected value for "deadlinesByRound" must contain at least one deadline.',
    });
    return null;
  }

  return deadlines;
}

export function parseEnglishRequirements(
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource("englishRequirements", sourceMap, issues);
  if (!source) {
    return null;
  }

  if (typeof source.value !== "object" || source.value === null) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "englishRequirements",
      message:
        'The selected value for "englishRequirements" must be an object.',
    });
    return null;
  }

  const englishRequirements = source.value as Record<string, unknown>;
  const parsed: EnglishRequirements = {
    minimumIelts:
      typeof englishRequirements.minimumIelts === "number"
        ? englishRequirements.minimumIelts
        : null,
    minimumToeflInternetBased:
      typeof englishRequirements.minimumToeflInternetBased === "number"
        ? englishRequirements.minimumToeflInternetBased
        : null,
    waiverNotes:
      typeof englishRequirements.waiverNotes === "string"
        ? englishRequirements.waiverNotes
        : null,
  };

  if (
    parsed.minimumIelts === null &&
    parsed.minimumToeflInternetBased === null &&
    parsed.waiverNotes === null
  ) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "englishRequirements",
      message:
        'The selected value for "englishRequirements" must contain at least one populated field.',
    });
    return null;
  }

  return parsed;
}

export function parseRequiredMaterials(
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource("requiredMaterials", sourceMap, issues);
  if (!source) {
    return null;
  }

  if (!Array.isArray(source.value)) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "requiredMaterials",
      message: 'The selected value for "requiredMaterials" must be an array.',
    });
    return null;
  }

  const values = source.value.filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );

  if (values.length === 0) {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "requiredMaterials",
      message:
        'The selected value for "requiredMaterials" must contain at least one string.',
    });
    return null;
  }

  return values.map((value) => value.trim());
}

export function parseScholarshipFlag(
  sourceMap: SelectedSourceMap,
  issues: CatalogNormalizationResult["issues"]
) {
  const source = readSource("scholarshipAvailabilityFlag", sourceMap, issues);
  if (!source) {
    return null;
  }

  if (typeof source.value !== "boolean") {
    issues.push({
      code: "invalid_field_value",
      fieldKey: "scholarshipAvailabilityFlag",
      message:
        'The selected value for "scholarshipAvailabilityFlag" must be a boolean.',
    });
    return null;
  }

  return source.value;
}
