// apps/ingest/src/types.ts
// Shared ingest-only types for the one-school runner.
// Keeps the runner, clients, and repository boundary aligned without pulling in extra abstractions.

import type {
  CatalogImportItemPayload,
  CatalogImportStatus,
  UniversitySourceKind,
  UniversityValidationReason,
} from "@etest/db";

import type {
  NormalizedUniversityCatalogRecord,
  SelectedCatalogFieldSource,
  UniversityFieldProvenance,
  UniversityPublishabilityResult,
} from "@etest/catalog";

export interface SeedSchool {
  slug: string;
  schoolName: string;
  city: string;
  state: string;
  officialAdmissionsUrl: string;
  sourceUrls: {
    admissions: string;
    tuition: string;
    costOfAttendance: string;
    scholarship: string;
  };
}

export type IngestTriggeredBy = "seed" | "manual" | "scheduled";

export interface IngestConfig {
  databaseUrl: string;
  brightDataApiKey: string;
  brightDataZone: string;
  brightDataBrowserUsername: string | null;
  brightDataBrowserPassword: string | null;
  brightDataBrowserWSEndpoint: string | null;
  openAiApiKey: string;
  openAiModel: string;
  openAiReasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
  triggeredBy: IngestTriggeredBy;
  schoolSlug: string | null;
}

export interface BrightDataPage {
  sourceKind: BrightDataSourceKind;
  sourceUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  fetchedAt: Date;
}

export type BrightDataSourceKind = Exclude<
  UniversitySourceKind,
  "manual_review"
>;

export interface SchoolExtractionDraft {
  identity: {
    schoolName: string;
    city: string;
    state: string;
    officialAdmissionsUrl: string;
  };
  applicationRounds: unknown;
  deadlinesByRound: unknown;
  englishRequirements: unknown;
  testPolicy: unknown;
  requiredMaterials: unknown;
  tuitionAnnualUsd: unknown;
  estimatedCostOfAttendanceUsd: unknown;
  livingCostEstimateUsd: unknown;
  scholarshipAvailabilityFlag: unknown;
  scholarshipNotes: unknown;
  recommendationInputs: unknown;
  explanationInputs: unknown;
}

export interface FieldImportItemInput {
  fieldKey: string;
  sourceKind: UniversitySourceKind;
  sourceUrl: string;
  status: CatalogImportStatus;
  rawPayload: CatalogImportItemPayload;
  normalizedPayload: CatalogImportItemPayload;
}

export interface PersistSuccessfulImportInput {
  runId: string;
  school: SeedSchool;
  record: NormalizedUniversityCatalogRecord;
  selectedSources: SelectedCatalogFieldSource[];
  provenance: UniversityFieldProvenance[];
  items: FieldImportItemInput[];
  validation: UniversityPublishabilityResult;
  verifiedAt: Date;
}

export interface IngestRunSummary {
  runId: string;
  universityId: string;
  validationStatus: UniversityPublishabilityResult["status"];
  itemCount: number;
}

export interface BrightDataClient {
  fetchPage(input: {
    sourceKind: BrightDataSourceKind;
    sourceUrl: string;
  }): Promise<BrightDataPage>;
}

export interface OpenAiExtractionClient {
  extractSchoolDraft(input: {
    school: SeedSchool;
    pages: BrightDataPage[];
  }): Promise<SchoolExtractionDraft>;
}

export interface IngestRepository {
  createImportRun(input: {
    requestedSchoolName: string;
    triggeredBy: IngestTriggeredBy;
    attemptCount: number;
  }): Promise<{ id: string }>;
  updateImportRunStatus(input: {
    runId: string;
    status: CatalogImportStatus;
    universityId?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    finishedAt?: Date | null;
  }): Promise<void>;
  persistSuccessfulImport(input: PersistSuccessfulImportInput): Promise<{
    universityId: string;
  }>;
  persistFailedImport(input: {
    runId: string;
    failureCode: string;
    failureMessage: string;
    finishedAt: Date;
  }): Promise<void>;
  close(): Promise<void>;
}

export class IngestStageError extends Error {
  constructor(
    public readonly stage:
      | "fetching"
      | "extracting"
      | "normalizing"
      | "persisting",
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
    this.name = "IngestStageError";
  }
}
