// packages/catalog/src/source-selection.ts
// Deterministic source-selection helpers for ingest normalization.
// Keeps field-to-source rules in one package-owned place for branch-3 ingest.

import type {
  CatalogRequiredField,
  UniversitySourceKind,
} from "@etest/api-contracts";

import type {
  CatalogSourceSelectionResult,
  ExtractedCatalogFieldCandidate,
  SelectedCatalogFieldSource,
  UniversityFieldProvenance,
} from "./types.js";

const preferredSourceByField: Record<
  Exclude<CatalogRequiredField, "lastVerifiedAt">,
  Exclude<UniversitySourceKind, "manual_review">
> = {
  schoolName: "official_admissions",
  city: "official_admissions",
  state: "official_admissions",
  officialAdmissionsUrl: "official_admissions",
  applicationRounds: "official_admissions",
  deadlinesByRound: "official_admissions",
  englishRequirements: "official_admissions",
  testPolicy: "official_admissions",
  requiredMaterials: "official_admissions",
  tuitionAnnualUsd: "official_tuition",
  estimatedCostOfAttendanceUsd: "official_cost_of_attendance",
  livingCostEstimateUsd: "official_cost_of_attendance",
  scholarshipAvailabilityFlag: "official_scholarship",
  scholarshipNotes: "official_scholarship",
};

function hasContent(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return true;
  }

  return value !== null && value !== undefined;
}

function toSelectedSource(
  candidate: ExtractedCatalogFieldCandidate
): SelectedCatalogFieldSource {
  return {
    fieldKey: candidate.fieldKey,
    sourceKind: candidate.sourceKind,
    sourceUrl: candidate.sourceUrl,
    value: candidate.value,
    excerpt: candidate.excerpt,
    metadata: {
      capturedValue:
        candidate.capturedValue ??
        (typeof candidate.value === "string"
          ? candidate.value
          : JSON.stringify(candidate.value)),
    },
  };
}

export function selectUniversityFieldSources(
  candidates: ExtractedCatalogFieldCandidate[]
): CatalogSourceSelectionResult {
  const selectedSources: SelectedCatalogFieldSource[] = [];
  const issues: CatalogSourceSelectionResult["issues"] = [];

  for (const [fieldKey, preferredSourceKind] of Object.entries(
    preferredSourceByField
  ) as Array<
    [
      Exclude<CatalogRequiredField, "lastVerifiedAt">,
      Exclude<UniversitySourceKind, "manual_review">,
    ]
  >) {
    const selectedCandidate = candidates.find(
      (candidate) =>
        candidate.fieldKey === fieldKey &&
        candidate.sourceKind === preferredSourceKind &&
        hasContent(candidate.value) &&
        candidate.sourceUrl.trim().length > 0
    );

    if (!selectedCandidate) {
      issues.push({
        code: "missing_source_candidate",
        fieldKey,
        message: `No ${preferredSourceKind} candidate was provided for "${fieldKey}".`,
      });
      continue;
    }

    selectedSources.push(toSelectedSource(selectedCandidate));
  }

  return { selectedSources, issues };
}

export function toUniversityFieldProvenance(
  selectedSources: SelectedCatalogFieldSource[],
  lastVerifiedAt: Date
): UniversityFieldProvenance[] {
  return selectedSources.map((source) => ({
    fieldKey: source.fieldKey,
    sourceKind: source.sourceKind,
    sourceUrl: source.sourceUrl,
    lastVerifiedAt,
  }));
}
