// apps/ingest/tests/runner.test.ts
// Integration-style tests for the one-school ingest orchestration.
// Verifies both the happy path and explicit failure-state persistence without network access.

import assert from "node:assert/strict";
import test from "node:test";

import { runIngest } from "../src/runner.js";
import type { IngestRepository, OpenAiExtractionClient } from "../src/types.js";

function buildExtractionDraft() {
  return {
    identity: {
      schoolName: "Stanford University",
      city: "Stanford",
      state: "CA",
      officialAdmissionsUrl: "https://admission.stanford.edu/",
    },
    applicationRounds: ["regular decision"],
    deadlinesByRound: {
      regular_decision: "2025-01-05",
    },
    englishRequirements: {
      minimumIelts: 7,
      minimumToeflInternetBased: 100,
      waiverNotes: null,
    },
    testPolicy: "test_optional",
    requiredMaterials: ["transcript", "essay"],
    tuitionAnnualUsd: "$62,484",
    estimatedCostOfAttendanceUsd: "85000",
    livingCostEstimateUsd: 22000,
    scholarshipAvailabilityFlag: "yes",
    scholarshipNotes: "Need-based aid is available.",
    recommendationInputs: {
      admissionRateOverall: 0.0391,
      satAverageOverall: 1553,
      actMidpointCumulative: 35,
      undergraduateSize: 7841,
      averageNetPriceUsd: 12136,
      schoolControl: "private_nonprofit",
      campusLocale: "suburban",
      internationalAidPolicy: "meets_full_demonstrated_need_if_eligible",
      hasNeedBasedAid: true,
      hasMeritAid: false,
      programFitTags: ["research_intensive"],
      programAdmissionModel: "unknown",
      applicationStrategyTags: ["restrictive_early_action"],
      testingRequirements: {
        acceptedExams: ["sat", "act"],
        minimumSatTotal: null,
        minimumActComposite: null,
        latestSatTestDateNote: "by the end of October",
        latestActTestDateNote: "by the end of September",
        superscorePolicy: "both",
        writingEssayPolicy: "optional",
        scoreReportingPolicy: "official_required_after_admit",
        middle50SatTotal: {
          low: 1510,
          high: 1570,
        },
        middle50ActComposite: {
          low: 34,
          high: 35,
        },
      },
    },
    explanationInputs: {
      academicSelectivityBand: "ultra_selective",
      testingExpectation: "high_scores_expected",
      englishPolicySummary: "english_fluency_required_no_exam_minimum_listed",
      aidModel: "need_based_only",
      applicationComplexity: "high",
      deadlineUrgencyWindows: {
        earliestDeadline: "2025-01-05",
        latestMajorDeadline: "2025-01-05",
      },
      internationalStudentConsiderations: ["english_fluency_required"],
      potentialFitTags: ["research_or_innovation_oriented"],
      potentialRiskTags: ["extremely_low_admission_rate", "high_total_cost"],
      actionableApplicationSteps: ["build_supplemental_essay_plan"],
    },
  } as const;
}

test("runner executes the one-school flow without network access", async () => {
  const events: string[] = [];
  const repository: IngestRepository = {
    async createImportRun() {
      events.push("create-run");
      return { id: "run_1" };
    },
    async updateImportRunStatus(input) {
      events.push(input.status);
    },
    async persistSuccessfulImport(input) {
      events.push("persist-success");
      assert.equal(input.validation.status, "publishable");
      assert.equal(input.items.length, 14);
      assert.equal(input.selectedSources.length, 14);
      return {
        universityId: "uni_1",
      };
    },
    async persistFailedImport() {
      events.push("persist-failed");
    },
    async close() {},
  };

  const brightData = {
    async fetchPage({ sourceUrl }) {
      return {
        sourceKind: sourceUrl.includes("tuition")
          ? "official_tuition"
          : sourceUrl.includes("budget")
            ? "official_cost_of_attendance"
            : sourceUrl.includes("types")
              ? "official_scholarship"
              : "official_admissions",
        sourceUrl,
        statusCode: 200,
        headers: {},
        body: "<html>ok</html>",
        fetchedAt: new Date("2025-01-01T00:00:00.000Z"),
      };
    },
  };

  const openAi: OpenAiExtractionClient = {
    async extractSchoolDraft() {
      return buildExtractionDraft();
    },
  };

  const result = await runIngest(
    {
      databaseUrl: "postgres://example",
      brightDataApiKey: "bright-key",
      brightDataZone: "zone-1",
      openAiApiKey: "openai-key",
      openAiModel: "gpt-5-nano",
      openAiReasoningEffort: "minimal",
      triggeredBy: "scheduled",
      schoolSlug: "stanford",
    },
    {
      repository,
      brightData,
      openAi,
      now: () => new Date("2025-01-01T00:00:00.000Z"),
    }
  );

  assert.equal(result.runId, "run_1");
  assert.equal(result.universityId, "uni_1");
  assert.equal(result.validationStatus, "publishable");
  assert.deepEqual(events, [
    "create-run",
    "fetching",
    "extracting",
    "normalizing",
    "validating",
    "persisting",
    "persist-success",
  ]);
});

test("runner persists a stage-specific failure code on extraction errors", async () => {
  let persistedFailure: {
    failureCode: string;
    failureMessage: string;
  } | null = null;

  const repository: IngestRepository = {
    async createImportRun() {
      return { id: "run_2" };
    },
    async updateImportRunStatus() {},
    async persistSuccessfulImport() {
      throw new Error("expected extraction failure");
    },
    async persistFailedImport(input) {
      persistedFailure = {
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
      };
    },
    async close() {},
  };

  await assert.rejects(() =>
    runIngest(
      {
        databaseUrl: "postgres://example",
        brightDataApiKey: "bright-key",
        brightDataZone: "zone-1",
        openAiApiKey: "openai-key",
        openAiModel: "gpt-5-nano",
        openAiReasoningEffort: "minimal",
        triggeredBy: "scheduled",
        schoolSlug: "stanford",
      },
      {
        repository,
        brightData: {
          async fetchPage({ sourceUrl }) {
            return {
              sourceKind: sourceUrl.includes("tuition")
                ? "official_tuition"
                : sourceUrl.includes("budget")
                  ? "official_cost_of_attendance"
                  : sourceUrl.includes("types")
                    ? "official_scholarship"
                    : "official_admissions",
              sourceUrl,
              statusCode: 200,
              headers: {},
              body: "<html>ok</html>",
              fetchedAt: new Date("2025-01-01T00:00:00.000Z"),
            };
          },
        },
        openAi: {
          async extractSchoolDraft() {
            throw new Error("synthetic extraction failure");
          },
        },
        now: () => new Date("2025-01-01T00:00:00.000Z"),
      }
    )
  );

  assert.deepEqual(persistedFailure, {
    failureCode: "openai_extraction_failed",
    failureMessage: "synthetic extraction failure",
  });
});

test("runner persists validation_failed for publishability exceptions", async () => {
  let persistedFailure: {
    failureCode: string;
    failureMessage: string;
  } | null = null;

  const repository: IngestRepository = {
    async createImportRun() {
      return { id: "run_3" };
    },
    async updateImportRunStatus() {},
    async persistSuccessfulImport() {
      throw new Error("validation should fail first");
    },
    async persistFailedImport(input) {
      persistedFailure = {
        failureCode: input.failureCode,
        failureMessage: input.failureMessage,
      };
    },
    async close() {},
  };

  await assert.rejects(() =>
    runIngest(
      {
        databaseUrl: "postgres://example",
        brightDataApiKey: "bright-key",
        brightDataZone: "zone-1",
        openAiApiKey: "openai-key",
        openAiModel: "gpt-5-nano",
        openAiReasoningEffort: "minimal",
        triggeredBy: "scheduled",
        schoolSlug: "stanford",
      },
      {
        repository,
        brightData: {
          async fetchPage({ sourceUrl }) {
            return {
              sourceKind: sourceUrl.includes("tuition")
                ? "official_tuition"
                : sourceUrl.includes("budget")
                  ? "official_cost_of_attendance"
                  : sourceUrl.includes("types")
                    ? "official_scholarship"
                    : "official_admissions",
              sourceUrl,
              statusCode: 200,
              headers: {},
              body: "<html>ok</html>",
              fetchedAt: new Date("2025-01-01T00:00:00.000Z"),
            };
          },
        },
        openAi: {
          async extractSchoolDraft() {
            return buildExtractionDraft();
          },
        },
        evaluatePublishability() {
          throw new Error("synthetic validation failure");
        },
        now: () => new Date("2025-01-01T00:00:00.000Z"),
      }
    )
  );

  assert.deepEqual(persistedFailure, {
    failureCode: "validation_failed",
    failureMessage: "synthetic validation failure",
  });
});
