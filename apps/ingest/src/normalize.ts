// apps/ingest/src/normalize.ts
// Normalization and provenance helpers for the branch-3 ingest runner.
// Converts the model draft into the canonical catalog shape and keeps field provenance explicit.

import { type CatalogImportStatus, type UniversitySourceKind } from "@etest/db";

import {
  normalizeUniversityCatalogRecord,
  selectUniversityFieldSources,
  type ExtractedCatalogFieldCandidate,
  type NormalizedUniversityCatalogRecord,
  type SelectedCatalogFieldSource,
} from "@etest/catalog";

import type {
  FieldImportItemInput,
  SchoolExtractionDraft,
  SeedSchool,
} from "./types.js";
import {
  assertMatchingIdentity,
  normalizeApplicationRounds,
  normalizeBoolean,
  normalizeCurrency,
  normalizeDeadlinesByRound,
  normalizeEnglishRequirements,
  normalizeExplanationInputs,
  normalizeRecommendationInputs,
  normalizeString,
  normalizeStringArray,
} from "./normalize-parsers.js";

const fieldSourceMap: Record<
  ExtractedCatalogFieldCandidate["fieldKey"],
  {
    sourceKind: Exclude<UniversitySourceKind, "manual_review">;
    sourceUrlKey: keyof SeedSchool["sourceUrls"];
  }
> = {
  schoolName: { sourceKind: "official_admissions", sourceUrlKey: "admissions" },
  city: { sourceKind: "official_admissions", sourceUrlKey: "admissions" },
  state: { sourceKind: "official_admissions", sourceUrlKey: "admissions" },
  officialAdmissionsUrl: {
    sourceKind: "official_admissions",
    sourceUrlKey: "admissions",
  },
  applicationRounds: {
    sourceKind: "official_admissions",
    sourceUrlKey: "admissions",
  },
  deadlinesByRound: {
    sourceKind: "official_admissions",
    sourceUrlKey: "admissions",
  },
  englishRequirements: {
    sourceKind: "official_admissions",
    sourceUrlKey: "admissions",
  },
  testPolicy: { sourceKind: "official_admissions", sourceUrlKey: "admissions" },
  requiredMaterials: {
    sourceKind: "official_admissions",
    sourceUrlKey: "admissions",
  },
  tuitionAnnualUsd: { sourceKind: "official_tuition", sourceUrlKey: "tuition" },
  estimatedCostOfAttendanceUsd: {
    sourceKind: "official_cost_of_attendance",
    sourceUrlKey: "costOfAttendance",
  },
  livingCostEstimateUsd: {
    sourceKind: "official_cost_of_attendance",
    sourceUrlKey: "costOfAttendance",
  },
  scholarshipAvailabilityFlag: {
    sourceKind: "official_scholarship",
    sourceUrlKey: "scholarship",
  },
  scholarshipNotes: {
    sourceKind: "official_scholarship",
    sourceUrlKey: "scholarship",
  },
};

function buildFieldCandidate(
  fieldKey: ExtractedCatalogFieldCandidate["fieldKey"],
  seed: SeedSchool,
  value: unknown
): ExtractedCatalogFieldCandidate {
  const source = fieldSourceMap[fieldKey];
  return {
    fieldKey,
    sourceKind: source.sourceKind,
    sourceUrl: seed.sourceUrls[source.sourceUrlKey],
    value,
    excerpt: null,
  };
}

function formatSelectionIssues(
  issues: Array<{ fieldKey: string; message: string }>
) {
  return issues
    .map((issue) => `${issue.fieldKey}: ${issue.message}`)
    .join("; ");
}

export function selectFieldSources(
  draft: SchoolExtractionDraft,
  seed: SeedSchool
): SelectedCatalogFieldSource[] {
  assertMatchingIdentity(seed, draft.identity);

  const selection = selectUniversityFieldSources([
    buildFieldCandidate("schoolName", seed, seed.schoolName),
    buildFieldCandidate("city", seed, seed.city),
    buildFieldCandidate("state", seed, seed.state),
    buildFieldCandidate(
      "officialAdmissionsUrl",
      seed,
      seed.officialAdmissionsUrl
    ),
    buildFieldCandidate(
      "applicationRounds",
      seed,
      normalizeApplicationRounds(draft.applicationRounds)
    ),
    buildFieldCandidate(
      "deadlinesByRound",
      seed,
      normalizeDeadlinesByRound(draft.deadlinesByRound)
    ),
    buildFieldCandidate(
      "englishRequirements",
      seed,
      normalizeEnglishRequirements(draft.englishRequirements)
    ),
    buildFieldCandidate(
      "testPolicy",
      seed,
      normalizeString(draft.testPolicy, "testPolicy")
    ),
    buildFieldCandidate(
      "requiredMaterials",
      seed,
      normalizeStringArray(draft.requiredMaterials, "requiredMaterials")
    ),
    buildFieldCandidate(
      "tuitionAnnualUsd",
      seed,
      normalizeCurrency(draft.tuitionAnnualUsd, "tuitionAnnualUsd")
    ),
    buildFieldCandidate(
      "estimatedCostOfAttendanceUsd",
      seed,
      normalizeCurrency(
        draft.estimatedCostOfAttendanceUsd,
        "estimatedCostOfAttendanceUsd"
      )
    ),
    buildFieldCandidate(
      "livingCostEstimateUsd",
      seed,
      normalizeCurrency(draft.livingCostEstimateUsd, "livingCostEstimateUsd")
    ),
    buildFieldCandidate(
      "scholarshipAvailabilityFlag",
      seed,
      normalizeBoolean(
        draft.scholarshipAvailabilityFlag,
        "scholarshipAvailabilityFlag"
      )
    ),
    buildFieldCandidate(
      "scholarshipNotes",
      seed,
      normalizeString(draft.scholarshipNotes, "scholarshipNotes")
    ),
  ]);

  if (selection.issues.length > 0) {
    throw new Error(
      `Missing required official sources: ${formatSelectionIssues(selection.issues)}`
    );
  }

  return selection.selectedSources;
}

export function normalizeUniversityExtraction(
  selectedSources: SelectedCatalogFieldSource[],
  verifiedAt: Date,
  draft?: Pick<
    SchoolExtractionDraft,
    "recommendationInputs" | "explanationInputs"
  >
): NormalizedUniversityCatalogRecord {
  const normalization = normalizeUniversityCatalogRecord(
    selectedSources,
    verifiedAt
  );
  if (!normalization.record) {
    throw new Error(
      `Normalization failed: ${formatSelectionIssues(normalization.issues)}`
    );
  }

  return {
    ...normalization.record,
    recommendationInputs: normalizeRecommendationInputs(
      draft?.recommendationInputs
    ),
    explanationInputs: normalizeExplanationInputs(draft?.explanationInputs),
  };
}

export function buildFieldImportItems(
  selectedSources: SelectedCatalogFieldSource[]
): FieldImportItemInput[] {
  return selectedSources.map((source) => ({
    fieldKey: source.fieldKey,
    sourceKind: source.sourceKind,
    sourceUrl: source.sourceUrl,
    status: "succeeded" satisfies CatalogImportStatus,
    rawPayload: {
      normalizedValue: source.value,
    },
    normalizedPayload: {
      normalizedValue: source.value,
    },
  }));
}
