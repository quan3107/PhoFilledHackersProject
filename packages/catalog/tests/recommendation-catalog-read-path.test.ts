// packages/catalog/tests/recommendation-catalog-read-path.test.ts
// Integration coverage for the published-only recommendation catalog read path.
// Verifies recommendation candidates come from canonical publishable rows and ignore raw import state.

import assert from "node:assert/strict";
import test from "node:test";

import { catalogImportItems, catalogImportRuns, universities } from "@etest/db";

import { listRecommendationCandidateSchools } from "../src/recommendation-catalog-read-path.js";
import { RecommendationCatalogRowValidationError } from "../src/catalog-row-mappers.js";
import { createCatalogTestDatabase } from "../../db/src/testing/pglite.js";

test("recommendation candidates include only publishable universities", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const [draftSchool, publishableSchool, rejectedSchool] = await database.db
      .insert(universities)
      .values([
        buildUniversityInsert({
          schoolName: "Draft College",
          officialAdmissionsUrl: "https://draft.example.edu/admissions",
          validationStatus: "draft",
        }),
        buildUniversityInsert({
          schoolName: "Alpha University",
          officialAdmissionsUrl: "https://alpha.example.edu/admissions",
          validationStatus: "publishable",
          lastVerifiedAt: new Date("2026-03-12T00:00:00.000Z"),
        }),
        buildUniversityInsert({
          schoolName: "Rejected Institute",
          officialAdmissionsUrl: "https://rejected.example.edu/admissions",
          validationStatus: "rejected",
        }),
      ])
      .returning();

    const [importRun] = await database.db
      .insert(catalogImportRuns)
      .values({
        universityId: draftSchool.id,
        requestedSchoolName: draftSchool.schoolName,
        status: "failed",
        failureCode: "stale_source",
        failureMessage: "Draft row should stay out of recommendation reads.",
      })
      .returning();

    await database.db.insert(catalogImportItems).values([
      {
        importRunId: importRun.id,
        universityId: draftSchool.id,
        sourceKind: "official_admissions",
        fieldKey: "schoolName",
        sourceUrl: draftSchool.officialAdmissionsUrl,
        status: "failed",
        rawPayload: { schoolName: "Draft College Imported" },
        normalizedPayload: { schoolName: "Draft College Imported" },
        failureCode: "validation_error",
        failureMessage: "Still excluded from published candidates.",
      },
      {
        importRunId: importRun.id,
        universityId: rejectedSchool.id,
        sourceKind: "official_admissions",
        fieldKey: "schoolName",
        sourceUrl: rejectedSchool.officialAdmissionsUrl,
        status: "succeeded",
        rawPayload: { schoolName: "Rejected Institute Imported" },
        normalizedPayload: { schoolName: "Rejected Institute Imported" },
      },
    ]);

    const candidates = await listRecommendationCandidateSchools(database.db);

    assert.deepEqual(candidates, [
      {
        universityId: publishableSchool.id,
        schoolName: "Alpha University",
        city: "Boston",
        state: "MA",
        lastVerifiedAt: "2026-03-12T00:00:00.000Z",
        tuitionAnnualUsd: 55000,
        estimatedCostOfAttendanceUsd: 71000,
        livingCostEstimateUsd: 16000,
        scholarshipAvailabilityFlag: true,
        scholarshipNotes:
          "Merit scholarships available for international applicants.",
        recommendationInputs: buildRecommendationInputs(),
        explanationInputs: buildExplanationInputs(),
      },
    ]);
  } finally {
    await database.close();
  }
});

test("recommendation candidates are ordered deterministically by school name", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(universities).values([
      buildUniversityInsert({
        schoolName: "Zeta University",
        officialAdmissionsUrl: "https://zeta.example.edu/admissions",
        validationStatus: "publishable",
      }),
      buildUniversityInsert({
        schoolName: "Beta University",
        officialAdmissionsUrl: "https://beta.example.edu/admissions",
        validationStatus: "publishable",
      }),
      buildUniversityInsert({
        schoolName: "Alpha University",
        officialAdmissionsUrl: "https://alpha-two.example.edu/admissions",
        validationStatus: "publishable",
      }),
    ]);

    const candidates = await listRecommendationCandidateSchools(database.db);

    assert.deepEqual(
      candidates.map((candidate) => candidate.schoolName),
      ["Alpha University", "Beta University", "Zeta University"]
    );
  } finally {
    await database.close();
  }
});

test("recommendation candidates reject malformed persisted recommendation JSON at the read boundary", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const [school] = await database.db
      .insert(universities)
      .values({
        ...buildUniversityInsert({
          schoolName: "Broken JSON University",
          officialAdmissionsUrl: "https://broken.example.edu/admissions",
          validationStatus: "publishable",
        }),
        recommendationInputs: { admissionRateOverall: "not-a-number" },
      } as never)
      .returning();

    await assert.rejects(
      listRecommendationCandidateSchools(database.db),
      (error) =>
        error instanceof RecommendationCatalogRowValidationError &&
        error.universityId === school.id &&
        error.field === "recommendationInputs"
    );
  } finally {
    await database.close();
  }
});

test("display-publishable rows are excluded from recommendations until scoring facts are ready", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(universities).values({
      ...buildUniversityInsert({
        schoolName: "Display Only University",
        officialAdmissionsUrl: "https://display-only.example.edu/admissions",
        validationStatus: "publishable",
      }),
      recommendationInputs: {
        ...buildRecommendationInputs(),
        admissionRateOverall: null,
        satAverageOverall: null,
        actMidpointCumulative: null,
      },
    });

    const candidates = await listRecommendationCandidateSchools(database.db);

    assert.deepEqual(candidates, []);
  } finally {
    await database.close();
  }
});

function buildUniversityInsert(input: {
  schoolName: string;
  officialAdmissionsUrl: string;
  validationStatus: "draft" | "publishable" | "rejected";
  lastVerifiedAt?: Date;
}) {
  return {
    schoolName: input.schoolName,
    city: "Boston",
    state: "MA",
    officialAdmissionsUrl: input.officialAdmissionsUrl,
    applicationRounds: ["regular_decision"],
    deadlinesByRound: { regular_decision: "2026-01-15" },
    englishRequirements: {
      minimumIelts: 6.5,
      minimumToeflInternetBased: 90,
      waiverNotes: null,
    },
    testPolicy: "test_optional",
    requiredMaterials: ["transcript", "essay"],
    tuitionAnnualUsd: 55000,
    estimatedCostOfAttendanceUsd: 71000,
    livingCostEstimateUsd: 16000,
    scholarshipAvailabilityFlag: true,
    scholarshipNotes:
      "Merit scholarships available for international applicants.",
    recommendationInputs: buildRecommendationInputs(),
    explanationInputs: buildExplanationInputs(),
    lastVerifiedAt:
      input.lastVerifiedAt ?? new Date("2026-03-21T00:00:00.000Z"),
    validationStatus: input.validationStatus,
  } as const;
}

function buildRecommendationInputs() {
  return {
    admissionRateOverall: 0.45,
    satAverageOverall: 1280,
    actMidpointCumulative: 28,
    undergraduateSize: 8500,
    averageNetPriceUsd: 24000,
    schoolControl: "private_nonprofit" as const,
    campusLocale: "urban",
    internationalAidPolicy: "need_and_merit_available" as const,
    hasNeedBasedAid: true,
    hasMeritAid: true,
    programFitTags: [
      "engineering",
      "computer_science",
      "research_intensive",
    ] as const,
    programAdmissionModel: "direct_admit" as const,
    applicationStrategyTags: ["binding_early_decision"] as const,
    testingRequirements: {
      acceptedExams: ["sat", "act"] as const,
      minimumSatTotal: null,
      minimumActComposite: null,
      latestSatTestDateNote: "Scores accepted through the December SAT.",
      latestActTestDateNote: "Scores accepted through the December ACT.",
      superscorePolicy: "both" as const,
      writingEssayPolicy: "optional" as const,
      scoreReportingPolicy: "self_report_allowed" as const,
      middle50SatTotal: {
        low: 1210,
        high: 1390,
      },
      middle50ActComposite: {
        low: 26,
        high: 31,
      },
    },
  };
}

function buildExplanationInputs() {
  return {
    academicSelectivityBand: "selective" as const,
    testingExpectation: "scores_considered" as const,
    englishPolicySummary: "minimum_scores_required" as const,
    aidModel: "need_and_merit" as const,
    applicationComplexity: "medium" as const,
    deadlineUrgencyWindows: {
      earliestDeadline: "2026-01-15",
      latestMajorDeadline: "2026-01-15",
    },
    internationalStudentConsiderations: ["need_based_aid_available"],
    potentialFitTags: ["strong_merit_aid_signal"],
    potentialRiskTags: [],
    actionableApplicationSteps: ["research_merit_aid_deadlines"],
  };
}
