// Integration coverage for the shared catalog persistence command.
// Verifies live ingest and curated import can share the same Drizzle-backed write path.

import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { universities } from "@etest/db";

import { persistUniversityCatalogRecord } from "../src/catalog-persistence.js";
import { createCatalogTestDatabase } from "../../db/src/testing/pglite.js";

function buildUniversity() {
  return {
    schoolName: "Example University",
    city: "Boston",
    state: "MA",
    officialAdmissionsUrl: "https://example.edu/admissions",
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
    scholarshipNotes: "Merit scholarships available.",
    recommendationInputs: {
      admissionRateOverall: 0.45,
      satAverageOverall: 1280,
      actMidpointCumulative: 28,
      undergraduateSize: 8500,
      averageNetPriceUsd: 24000,
      schoolControl: "private_nonprofit",
      campusLocale: "urban",
      internationalAidPolicy: "need_and_merit_available",
      hasNeedBasedAid: true,
      hasMeritAid: true,
      programFitTags: ["engineering"],
      programAdmissionModel: "direct_admit",
      applicationStrategyTags: ["binding_early_decision"],
      testingRequirements: {
        acceptedExams: ["sat", "act"],
        minimumSatTotal: null,
        minimumActComposite: null,
        latestSatTestDateNote: null,
        latestActTestDateNote: null,
        superscorePolicy: "both",
        writingEssayPolicy: "optional",
        scoreReportingPolicy: "self_report_allowed",
        middle50SatTotal: { low: 1210, high: 1390 },
        middle50ActComposite: { low: 26, high: 31 },
      },
    },
    explanationInputs: {
      academicSelectivityBand: "selective",
      testingExpectation: "scores_considered",
      englishPolicySummary: "minimum_scores_required",
      aidModel: "need_and_merit",
      applicationComplexity: "medium",
      deadlineUrgencyWindows: {
        earliestDeadline: "2026-01-15",
        latestMajorDeadline: "2026-01-15",
      },
      internationalStudentConsiderations: ["need_based_aid_available"],
      potentialFitTags: ["strong_merit_aid_signal"],
      potentialRiskTags: [],
      actionableApplicationSteps: ["research_merit_aid_deadlines"],
    },
    lastVerifiedAt: new Date("2026-03-21T00:00:00.000Z"),
    validationStatus: "publishable",
    validationReasons: [],
  } as const;
}

test("persistUniversityCatalogRecord upserts universities and replaces provenance", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const first = await persistUniversityCatalogRecord(database.db, {
      university: buildUniversity(),
      sources: [
        {
          sourceKind: "official_admissions",
          fieldKey: "officialAdmissionsUrl",
          sourceUrl: "https://example.edu/admissions",
          excerpt: "Admissions page.",
          isPrimary: true,
          metadata: { notes: "first" },
        },
      ],
      sourceReplacementPolicy: "replace_all",
      importedAt: new Date("2026-03-22T00:00:00.000Z"),
    });

    await persistUniversityCatalogRecord(database.db, {
      university: {
        ...buildUniversity(),
        tuitionAnnualUsd: 56000,
      },
      sources: [
        {
          sourceKind: "official_tuition",
          fieldKey: "tuitionAnnualUsd",
          sourceUrl: "https://example.edu/tuition",
          excerpt: "Tuition page.",
          isPrimary: true,
          metadata: { notes: "replacement" },
        },
      ],
      sourceReplacementPolicy: "replace_all",
      importedAt: new Date("2026-03-23T00:00:00.000Z"),
    });

    const stored = await database.db.query.universities.findFirst({
      where: eq(universities.id, first.universityId),
      with: { universitySources: true },
    });

    assert.ok(stored);
    assert.equal(stored.tuitionAnnualUsd, 56000);
    assert.equal(stored.universitySources.length, 1);
    assert.equal(stored.universitySources[0]?.fieldKey, "tuitionAnnualUsd");
    assert.equal(stored.universitySources[0]?.metadata.notes, "replacement");
  } finally {
    await database.close();
  }
});
