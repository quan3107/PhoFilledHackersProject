// apps/ingest/tests/clients.test.ts
// Unit tests for ingest config and external client wrappers.
// Verifies the branch-3 runner sends the intended request shapes without real network calls.

import assert from "node:assert/strict";
import test from "node:test";

import { createBrightDataClient } from "../src/bright-data.js";
import { loadIngestConfig } from "../src/config.js";
import { initializeIngestEnv } from "../src/env.js";
import { createOpenAiExtractionClient } from "../src/openai.js";
import type { BrightDataPage } from "../src/types.js";

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

function buildBrightDataPayload(body = "<html>ok</html>") {
  return {
    status_code: 200,
    body,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  };
}

test("loadIngestConfig parses env and cli values", () => {
  const config = loadIngestConfig(
    {
      DATABASE_URL: "postgres://example",
      BRIGHT_DATA_API_KEY: "bright-key",
      BRIGHT_DATA_ZONE: "zone-1",
      BRIGHT_DATA_BROWSER_USERNAME: "browser-user",
      BRIGHT_DATA_BROWSER_PASSWORD: "browser-pass",
      BRIGHT_DATA_BROWSER_WSS: "wss://browser.example",
      OPENAI_API_KEY: "openai-key",
      INGEST_OPENAI_MODEL: "gpt-5-nano",
      INGEST_OPENAI_REASONING_EFFORT: "minimal",
      INGEST_TRIGGERED_BY: "manual",
      INGEST_SCHOOL_SLUG: "stanford",
    },
    ["--school=stanford"]
  );

  assert.equal(config.databaseUrl, "postgres://example");
  assert.equal(config.brightDataApiKey, "bright-key");
  assert.equal(config.schoolSlug, "stanford");
  assert.equal(config.triggeredBy, "manual");
  assert.equal(config.openAiModel, "gpt-5-nano");
  assert.equal(config.brightDataBrowserUsername, "browser-user");
  assert.equal(config.brightDataBrowserPassword, "browser-pass");
  assert.equal(config.brightDataBrowserWSEndpoint, "wss://browser.example");
});

test("loadIngestConfig rejects partial Browser API credentials", () => {
  assert.throws(
    () =>
      loadIngestConfig({
        DATABASE_URL: "postgres://example",
        BRIGHT_DATA_API_KEY: "bright-key",
        BRIGHT_DATA_ZONE: "zone-1",
        BRIGHT_DATA_BROWSER_USERNAME: "browser-user",
        OPENAI_API_KEY: "openai-key",
      }),
    /BRIGHT_DATA_BROWSER_USERNAME and BRIGHT_DATA_BROWSER_PASSWORD must be set together/
  );
});

test("initializeIngestEnv loads the first available env file", () => {
  const loaded: string[] = [];

  initializeIngestEnv({
    cwd: "/workspace/repo",
    moduleUrl: "file:///workspace/repo/apps/ingest/src/env.ts",
    existsSyncImpl(path) {
      return String(path) === "/workspace/repo/.env";
    },
    loadEnvFileImpl(path) {
      loaded.push(String(path));
    },
  });

  assert.deepEqual(loaded, ["/workspace/repo/.env"]);
});

test("Bright Data client posts the Unlocker request shape", async () => {
  const requests: Array<{
    url: string;
    init: RequestInit;
  }> = [];

  const client = createBrightDataClient(
    {
      apiKey: "bright-key",
      zone: "zone-1",
      endpoint: "https://bright.example/request",
    },
    {
      fetchImpl: async (url, init) => {
        requests.push({ url, init });
        return new Response(JSON.stringify(buildBrightDataPayload()), {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        });
      },
    }
  );

  const page = await client.fetchPage({
    sourceKind: "official_admissions",
    sourceUrl: "https://admission.stanford.edu/",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://bright.example/request");
  assert.equal(requests[0]?.init.method, "POST");
  assert.equal(
    requests[0]?.init.headers &&
      (requests[0].init.headers as Record<string, string>).Authorization,
    "Bearer bright-key"
  );
  assert.equal(page.statusCode, 200);
  assert.equal(page.body, "<html>ok</html>");
});

test("Bright Data client accepts raw HTML responses from Unlocker", async () => {
  const client = createBrightDataClient(
    {
      apiKey: "bright-key",
      zone: "zone-1",
      endpoint: "https://bright.example/request",
    },
    {
      fetchImpl: async () =>
        new Response("<html><body>Example Domain</body></html>", {
          status: 200,
          headers: {
            "content-type": "text/html; charset=utf-8",
          },
        }),
    }
  );

  const page = await client.fetchPage({
    sourceKind: "official_admissions",
    sourceUrl: "https://example.com",
  });

  assert.equal(page.statusCode, 200);
  assert.match(page.body, /Example Domain/);
  assert.equal(page.headers["content-type"], "text/html; charset=utf-8");
});

test("Bright Data client falls back to Browser API for blocked pages", async () => {
  const requests: string[] = [];
  const client = createBrightDataClient(
    {
      apiKey: "bright-key",
      zone: "zone-1",
      browserApi: {
        username: "browser-user",
        password: "browser-pass",
      },
      endpoint: "https://bright.example/request",
    },
    {
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            error:
              "Request Failed (bad_endpoint): Requested site is not available for immediate access mode in accordance with robots.txt",
          }),
          {
            status: 400,
            headers: {
              "content-type": "application/json",
            },
          }
        ),
      fetchWithBrowserApiImpl: async (_config, input) => {
        requests.push(input.sourceUrl);
        return {
          sourceKind: input.sourceKind,
          sourceUrl: input.sourceUrl,
          statusCode: 200,
          headers: { "content-type": "text/html" },
          body: "<html><body>Rendered Stanford page</body></html>",
          fetchedAt: new Date(),
        };
      },
    }
  );

  const page = await client.fetchPage({
    sourceKind: "official_admissions",
    sourceUrl: "https://admission.stanford.edu/",
  });

  assert.deepEqual(requests, ["https://admission.stanford.edu/"]);
  assert.match(page.body, /Rendered Stanford page/);
});

test("OpenAI client posts a structured Responses API request", async () => {
  const requests: Array<{
    url: string;
    init: RequestInit;
  }> = [];

  const client = createOpenAiExtractionClient(
    {
      apiKey: "openai-key",
      model: "gpt-5-nano",
      reasoningEffort: "minimal",
      endpoint: "https://openai.example/responses",
    },
    async (url, init) => {
      requests.push({ url, init });
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(buildExtractionDraft()),
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }
      );
    }
  );

  const draft = await client.extractSchoolDraft({
    school: {
      slug: "stanford",
      schoolName: "Stanford University",
      city: "Stanford",
      state: "CA",
      officialAdmissionsUrl: "https://admission.stanford.edu/",
      sourceUrls: {
        admissions: "https://admission.stanford.edu/",
        tuition:
          "https://studentservices.stanford.edu/my-finances/tuition-fees",
        costOfAttendance: "https://financialaid.stanford.edu/undergrad/budget/",
        scholarship:
          "https://financialaid.stanford.edu/undergrad/types/index.html",
      },
    },
    pages: [
      {
        sourceKind: "official_admissions",
        sourceUrl: "https://admission.stanford.edu/",
        statusCode: 200,
        headers: {},
        body: "<html>admissions</html>",
        fetchedAt: new Date(),
      },
    ] as BrightDataPage[],
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "https://openai.example/responses");
  const body = JSON.parse(String(requests[0]?.init.body ?? "{}")) as {
    model: string;
    instructions: string;
    text: { format: { type: string; strict: boolean } };
  };
  assert.equal(body.model, "gpt-5-nano");
  assert.match(body.instructions, /Stanford University/);
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(draft.identity.schoolName, "Stanford University");
});
