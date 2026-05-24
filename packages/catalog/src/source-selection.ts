// packages/catalog/src/source-selection.ts
// Deterministic source-selection helpers for ingest normalization.
// Keeps field-to-source rules ranked and diagnostic so ingest can explain fallbacks.

import type {
  CatalogRequiredField,
  UniversitySourceKind,
} from "@etest/api-contracts";

import type {
  CatalogSourceSelectionDiagnostic,
  CatalogSourceSelectionResult,
  ExtractedCatalogFieldCandidate,
  SelectedCatalogFieldSource,
  UniversityFieldProvenance,
} from "./types.js";

type SelectableField = Exclude<CatalogRequiredField, "lastVerifiedAt">;
type NonManualSourceKind = Exclude<UniversitySourceKind, "manual_review">;

export interface SourceSelectionRule {
  field: SelectableField;
  preferred: UniversitySourceKind[];
  allowed: UniversitySourceKind[];
  allowManualReview: boolean;
}

export const sourceSelectionRules: SourceSelectionRule[] = [
  rule("schoolName", ["official_admissions"], ["official_admissions"]),
  rule("city", ["official_admissions"], ["official_admissions"]),
  rule("state", ["official_admissions"], ["official_admissions"]),
  rule(
    "officialAdmissionsUrl",
    ["official_admissions"],
    ["official_admissions"]
  ),
  rule("applicationRounds", ["official_admissions"], ["official_admissions"]),
  rule("deadlinesByRound", ["official_admissions"], ["official_admissions"]),
  rule("englishRequirements", ["official_admissions"], ["official_admissions"]),
  rule("testPolicy", ["official_admissions"], ["official_admissions"]),
  rule("requiredMaterials", ["official_admissions"], ["official_admissions"]),
  rule(
    "tuitionAnnualUsd",
    ["official_tuition"],
    ["official_tuition", "official_cost_of_attendance"]
  ),
  rule(
    "estimatedCostOfAttendanceUsd",
    ["official_cost_of_attendance"],
    ["official_cost_of_attendance", "official_tuition"]
  ),
  rule(
    "livingCostEstimateUsd",
    ["official_cost_of_attendance"],
    ["official_cost_of_attendance", "official_tuition"]
  ),
  rule(
    "scholarshipAvailabilityFlag",
    ["official_scholarship"],
    ["official_scholarship", "official_admissions"]
  ),
  rule(
    "scholarshipNotes",
    ["official_scholarship"],
    ["official_scholarship", "official_admissions"]
  ),
];

function rule(
  field: SelectableField,
  preferred: NonManualSourceKind[],
  allowed: NonManualSourceKind[],
  allowManualReview = false
): SourceSelectionRule {
  return { field, preferred, allowed, allowManualReview };
}

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
  candidate: ExtractedCatalogFieldCandidate,
  diagnostics: CatalogSourceSelectionDiagnostic[]
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
    diagnostics,
  };
}

export function selectUniversityFieldSources(
  candidates: ExtractedCatalogFieldCandidate[]
): CatalogSourceSelectionResult {
  const selectedSources: SelectedCatalogFieldSource[] = [];
  const issues: CatalogSourceSelectionResult["issues"] = [];
  const diagnostics: CatalogSourceSelectionDiagnostic[] = [];

  for (const rule of sourceSelectionRules) {
    const fieldCandidates = candidates.filter(
      (candidate) => candidate.fieldKey === rule.field
    );
    const usableCandidates = fieldCandidates.filter(
      (candidate) =>
        rule.allowed.includes(candidate.sourceKind) &&
        hasContent(candidate.value) &&
        candidate.sourceUrl.trim().length > 0
    );
    const rejected = fieldCandidates.filter(
      (candidate) => !usableCandidates.includes(candidate)
    );

    for (const candidate of rejected) {
      diagnostics.push({
        code: "rejected_source_candidate",
        fieldKey: rule.field,
        sourceKind: candidate.sourceKind,
        sourceUrl: candidate.sourceUrl,
        message: `Rejected ${candidate.sourceKind} candidate for "${rule.field}".`,
      });
    }

    const selectedCandidate =
      firstByKinds(usableCandidates, rule.preferred) ??
      firstByKinds(usableCandidates, rule.allowed);

    if (!selectedCandidate) {
      issues.push({
        code: "missing_source_candidate",
        fieldKey: rule.field,
        message: `No allowed candidate was provided for "${rule.field}".`,
      });
      continue;
    }

    const conflicts = usableCandidates
      .filter((candidate) => candidate !== selectedCandidate)
      .map((candidate) => ({
        code: "source_conflict" as const,
        fieldKey: rule.field,
        sourceKind: candidate.sourceKind,
        sourceUrl: candidate.sourceUrl,
        message: `Selected ${selectedCandidate.sourceKind} over ${candidate.sourceKind} for "${rule.field}".`,
      }));

    diagnostics.push(...conflicts);
    selectedSources.push(toSelectedSource(selectedCandidate, conflicts));
  }

  return { selectedSources, issues, diagnostics };
}

function firstByKinds(
  candidates: ExtractedCatalogFieldCandidate[],
  sourceKinds: UniversitySourceKind[]
) {
  for (const sourceKind of sourceKinds) {
    const candidate = candidates.find(
      (entry) => entry.sourceKind === sourceKind
    );
    if (candidate) {
      return candidate;
    }
  }

  return undefined;
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
