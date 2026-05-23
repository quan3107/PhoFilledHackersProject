// packages/catalog/src/types.ts
// Normalized catalog types used by validators and downstream catalog workflows.
// Mirrors the required school facts from the PRD while keeping provenance separate.

import type {
  ApplicationRound,
  CatalogRequiredField,
  UniversitySourceKind,
} from "@etest/api-contracts";
import type {
  DeadlinesByRound,
  EnglishRequirements,
  UniversityExplanationInputs,
  UniversityRecommendationInputs,
  UniversitySourceMetadata,
  UniversityValidationReason,
  UniversityValidationStatus,
} from "@etest/db";

export interface NormalizedUniversityCatalogRecord {
  schoolName: string;
  city: string;
  state: string;
  officialAdmissionsUrl: string;
  applicationRounds: ApplicationRound[];
  deadlinesByRound: DeadlinesByRound;
  englishRequirements: EnglishRequirements;
  testPolicy: string;
  requiredMaterials: string[];
  tuitionAnnualUsd: number;
  estimatedCostOfAttendanceUsd: number;
  livingCostEstimateUsd: number;
  scholarshipAvailabilityFlag: boolean;
  scholarshipNotes: string;
  recommendationInputs: UniversityRecommendationInputs;
  explanationInputs: UniversityExplanationInputs;
  lastVerifiedAt: Date;
}

export interface RecommendationCandidateSchool {
  universityId: string;
  schoolName: string;
  city: string;
  state: string;
  lastVerifiedAt: string;
  tuitionAnnualUsd: number;
  estimatedCostOfAttendanceUsd: number;
  livingCostEstimateUsd: number;
  scholarshipAvailabilityFlag: boolean;
  scholarshipNotes: string;
  recommendationInputs: UniversityRecommendationInputs;
  explanationInputs: UniversityExplanationInputs;
}

export interface UniversityFieldProvenance {
  fieldKey: CatalogRequiredField | string;
  sourceKind: UniversitySourceKind;
  sourceUrl: string;
  lastVerifiedAt: Date;
}

export interface UniversityPublishabilityResult {
  status: Extract<UniversityValidationStatus, "publishable" | "rejected">;
  reasons: UniversityValidationReason[];
}

export interface ExtractedCatalogFieldCandidate {
  fieldKey: Exclude<CatalogRequiredField, "lastVerifiedAt">;
  sourceKind: Exclude<UniversitySourceKind, "manual_review">;
  sourceUrl: string;
  value: unknown;
  excerpt: string | null;
  capturedValue?: string | null;
}

export interface SelectedCatalogFieldSource {
  fieldKey: Exclude<CatalogRequiredField, "lastVerifiedAt">;
  sourceKind: Exclude<UniversitySourceKind, "manual_review">;
  sourceUrl: string;
  value: unknown;
  excerpt: string | null;
  metadata: UniversitySourceMetadata;
}

export interface CatalogSourceSelectionIssue {
  code: "missing_source_candidate";
  fieldKey: Exclude<CatalogRequiredField, "lastVerifiedAt">;
  message: string;
}

export interface CatalogSourceSelectionResult {
  selectedSources: SelectedCatalogFieldSource[];
  issues: CatalogSourceSelectionIssue[];
}

export interface CatalogNormalizationIssue {
  code: "invalid_field_value" | "missing_selected_source";
  fieldKey: CatalogRequiredField;
  message: string;
}

export interface CatalogNormalizationResult {
  record: NormalizedUniversityCatalogRecord | null;
  issues: CatalogNormalizationIssue[];
}
