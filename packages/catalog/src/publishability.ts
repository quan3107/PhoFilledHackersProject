// packages/catalog/src/publishability.ts
// Validator utilities for required-field and provenance-based publishability.
// Produces explicit machine-readable reasons so later review UI can gate publication deterministically.

import {
  catalogRequiredFields,
  type CatalogRequiredField,
} from "@etest/api-contracts";
import type { UniversityValidationReason } from "@etest/db";

import type {
  NormalizedUniversityCatalogRecord,
  UniversityFieldProvenance,
  UniversityPublishabilityResult,
} from "./types.js";

function hasNonEmptyString(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyArray(value: unknown) {
  return Array.isArray(value) && value.length > 0;
}

function hasObjectEntries(value: unknown) {
  return (
    typeof value === "object" && value !== null && Object.keys(value).length > 0
  );
}

function hasValidDate(value: unknown) {
  return value instanceof Date && !Number.isNaN(value.valueOf());
}

function hasFieldValue(
  record: NormalizedUniversityCatalogRecord,
  field: CatalogRequiredField
) {
  switch (field) {
    case "schoolName":
    case "city":
    case "state":
    case "officialAdmissionsUrl":
    case "testPolicy":
    case "scholarshipNotes":
      return hasNonEmptyString(record[field]);
    case "applicationRounds":
    case "requiredMaterials":
      return hasNonEmptyArray(record[field]);
    case "deadlinesByRound":
    case "englishRequirements":
      return hasObjectEntries(record[field]);
    case "tuitionAnnualUsd":
    case "estimatedCostOfAttendanceUsd":
    case "livingCostEstimateUsd":
      return Number.isFinite(record[field]) && record[field] > 0;
    case "scholarshipAvailabilityFlag":
      return typeof record.scholarshipAvailabilityFlag === "boolean";
    case "lastVerifiedAt":
      return hasValidDate(record.lastVerifiedAt);
  }
}

function buildReason(
  code: UniversityValidationReason["code"],
  field: CatalogRequiredField,
  message: string
): UniversityValidationReason {
  return { code, field, message };
}

export function validateRequiredUniversityFields(
  record: NormalizedUniversityCatalogRecord
) {
  return catalogRequiredFields.flatMap((field) =>
    hasFieldValue(record, field)
      ? []
      : [
          buildReason(
            "missing_required_field",
            field,
            `The catalog field "${field}" is required before a university can be reviewed as publishable.`
          ),
        ]
  );
}

export function evaluateUniversityPublishability(
  record: NormalizedUniversityCatalogRecord,
  provenance: UniversityFieldProvenance[]
): UniversityPublishabilityResult {
  const reasons: UniversityValidationReason[] = [
    ...validateRequiredUniversityFields(record),
  ];

  for (const field of catalogRequiredFields) {
    if (field === "lastVerifiedAt") {
      continue;
    }

    const hasSupportingSource = provenance.some(
      (source) =>
        source.fieldKey === field &&
        hasNonEmptyString(source.sourceUrl) &&
        hasValidDate(source.lastVerifiedAt)
    );

    if (!hasSupportingSource) {
      reasons.push(
        buildReason(
          "missing_source_provenance",
          field,
          `The catalog field "${field}" requires at least one verified source record.`
        )
      );
    }
  }

  return {
    status: reasons.length === 0 ? "publishable" : "rejected",
    reasons,
  };
}
