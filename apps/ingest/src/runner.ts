// apps/ingest/src/runner.ts
// Orchestrates the one-school ingest slice from fetch through persistence.
// Keeps stage transitions explicit so failures are easy to reason about in logs and tests.

import {
  evaluateUniversityPublishability,
  toUniversityFieldProvenance,
} from "@etest/catalog";

import {
  buildFieldImportItems,
  normalizeUniversityExtraction,
  selectFieldSources,
} from "./normalize.js";
import { resolveSeedSchool } from "./manifest.js";
import {
  consoleIngestLogger,
  serializeIngestError,
  type IngestLogger,
} from "./observability.js";
import type {
  BrightDataClient,
  BrightDataFetchResult,
  IngestConfig,
  IngestRepository,
  IngestRunSummary,
  OpenAiExtractionClient,
} from "./types.js";
import { IngestStageError } from "./types.js";
import type {
  NormalizedUniversityCatalogRecord,
  UniversityFieldProvenance,
  UniversityPublishabilityResult,
} from "@etest/catalog";

export interface RunIngestDependencies {
  repository: IngestRepository;
  brightData: BrightDataClient;
  openAi: OpenAiExtractionClient;
  logger?: IngestLogger;
  now?: () => Date;
  evaluatePublishability?: (
    record: NormalizedUniversityCatalogRecord,
    provenance: UniversityFieldProvenance[]
  ) => UniversityPublishabilityResult;
}

function classifyStageError(error: unknown) {
  if (error instanceof IngestStageError) {
    return error.stage;
  }

  return null;
}

function toFailureCode(stage: string | null) {
  switch (stage) {
    case "fetching":
      return "bright_data_fetch_failed";
    case "extracting":
      return "openai_extraction_failed";
    case "normalizing":
      return "normalization_failed";
    case "validating":
      return "validation_failed";
    case "persisting":
      return "persistence_failed";
    default:
      return "ingest_failed";
  }
}

async function runStage<T>(
  stage:
    | "fetching"
    | "extracting"
    | "normalizing"
    | "validating"
    | "persisting",
  action: () => Promise<T>
) {
  try {
    return await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new IngestStageError(stage, message, error);
  }
}

async function fetchSchoolPages(
  brightData: BrightDataClient,
  seedSchool: ReturnType<typeof resolveSeedSchool>,
  concurrency = 2
) {
  const entries = Object.entries(seedSchool.sourceUrls);
  const results: BrightDataFetchResult[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < entries.length) {
      const [kind, sourceUrl] = entries[nextIndex]!;
      nextIndex += 1;
      const sourceKind =
        kind === "admissions"
          ? "official_admissions"
          : kind === "tuition"
            ? "official_tuition"
            : kind === "costOfAttendance"
              ? "official_cost_of_attendance"
              : "official_scholarship";

      try {
        const page = await brightData.fetchPage({
          sourceKind,
          sourceUrl,
        });

        if (page.statusCode < 200 || page.statusCode >= 300) {
          throw new Error(
            `Bright Data returned status ${page.statusCode} for ${sourceUrl}.`
          );
        }

        results.push({ sourceKind, sourceUrl, page, errorMessage: null });
      } catch (error) {
        results.push({
          sourceKind,
          sourceUrl,
          page: null,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker())
  );

  const failures = results.filter((result) => result.errorMessage);
  if (failures.length > 0) {
    throw new Error(
      `Failed to fetch ${failures.length} source(s): ${failures
        .map((failure) => `${failure.sourceUrl}: ${failure.errorMessage}`)
        .join("; ")}`
    );
  }

  const pages = results.flatMap((result) => (result.page ? [result.page] : []));

  return pages;
}

export async function runIngest(
  config: IngestConfig,
  deps: RunIngestDependencies
): Promise<IngestRunSummary> {
  const seedSchool = resolveSeedSchool(config.schoolSlug);
  const verifiedAt = deps.now?.() ?? new Date();
  const importRun = await deps.repository.createImportRun({
    requestedSchoolName: seedSchool.schoolName,
    triggeredBy: config.triggeredBy,
    attemptCount: 1,
  });

  try {
    await deps.repository.updateImportRunStatus({
      runId: importRun.id,
      status: "fetching",
    });

    const pages = await runStage("fetching", () =>
      fetchSchoolPages(
        deps.brightData,
        seedSchool,
        config.sourceFetchConcurrency
      )
    );

    await deps.repository.updateImportRunStatus({
      runId: importRun.id,
      status: "extracting",
    });

    const draft = await runStage("extracting", () =>
      deps.openAi.extractSchoolDraft({
        school: seedSchool,
        pages,
      })
    );

    await deps.repository.updateImportRunStatus({
      runId: importRun.id,
      status: "normalizing",
    });

    const selectedSources = await runStage("normalizing", async () =>
      selectFieldSources(draft, seedSchool)
    );
    const record = await runStage("normalizing", async () =>
      normalizeUniversityExtraction(selectedSources, verifiedAt, draft)
    );
    const provenance = toUniversityFieldProvenance(selectedSources, verifiedAt);
    const items = buildFieldImportItems(selectedSources);

    await deps.repository.updateImportRunStatus({
      runId: importRun.id,
      status: "validating",
    });

    const validation = await runStage("validating", async () =>
      (deps.evaluatePublishability ?? evaluateUniversityPublishability)(
        record,
        provenance
      )
    );

    await deps.repository.updateImportRunStatus({
      runId: importRun.id,
      status: "persisting",
    });

    const persisted = await runStage("persisting", () =>
      deps.repository.persistSuccessfulImport({
        runId: importRun.id,
        school: seedSchool,
        record,
        selectedSources,
        provenance,
        items,
        validation,
        verifiedAt,
      })
    );

    return {
      runId: importRun.id,
      universityId: persisted.universityId,
      validationStatus: validation.status,
      itemCount: items.length,
    };
  } catch (error) {
    const stage = classifyStageError(error);
    const failureMessage =
      error instanceof Error ? error.message : String(error);
    const failureCode = toFailureCode(stage);

    (deps.logger ?? consoleIngestLogger).error({
      event: "ingest.run_failed",
      operationId: importRun.id,
      ingestRunId: importRun.id,
      publicErrorCode: failureCode,
      stage,
      schoolSlug: seedSchool.slug,
      triggeredBy: config.triggeredBy,
      internalError: serializeIngestError(error),
    });

    await deps.repository.persistFailedImport({
      runId: importRun.id,
      failureCode,
      failureMessage,
      finishedAt: deps.now?.() ?? new Date(),
    });

    throw error;
  }
}
