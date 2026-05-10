// packages/catalog/tests/publishability.test.ts
// Unit tests for branch-2 publishability rules.
// Covers required-field validation and provenance gating for canonical catalog records.

import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateUniversityPublishability,
  validateRequiredUniversityFields,
  type NormalizedUniversityCatalogRecord,
} from "../src/index.js";

function buildRecord(
  overrides: Partial<NormalizedUniversityCatalogRecord> = {}
): NormalizedUniversityCatalogRecord {
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
      programFitTags: ["engineering", "business"],
      programAdmissionModel: "open",
      applicationStrategyTags: ["non_binding_early_action"],
      testingRequirements: {
        acceptedExams: ["sat", "act"],
        minimumSatTotal: null,
        minimumActComposite: null,
        latestSatTestDateNote: "Scores accepted through December.",
        latestActTestDateNote: "Scores accepted through December.",
        superscorePolicy: "both",
        writingEssayPolicy: "optional",
        scoreReportingPolicy: "self_report_allowed",
        middle50SatTotal: {
          low: 1210,
          high: 1390,
        },
        middle50ActComposite: {
          low: 26,
          high: 31,
        },
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
    ...overrides,
  };
}

const completeProvenance = [
  "schoolName",
  "city",
  "state",
  "officialAdmissionsUrl",
  "applicationRounds",
  "deadlinesByRound",
  "englishRequirements",
  "testPolicy",
  "requiredMaterials",
  "tuitionAnnualUsd",
  "estimatedCostOfAttendanceUsd",
  "livingCostEstimateUsd",
  "scholarshipAvailabilityFlag",
  "scholarshipNotes",
].map((fieldKey) => ({
  fieldKey,
  sourceKind: "official_admissions" as const,
  sourceUrl: `https://example.edu/${fieldKey}`,
  lastVerifiedAt: new Date("2026-03-21T00:00:00.000Z"),
}));

test("a complete source-backed university record is publishable", () => {
  const result = evaluateUniversityPublishability(
    buildRecord(),
    completeProvenance
  );

  assert.equal(result.status, "publishable");
  assert.deepEqual(result.reasons, []);
});

test("missing required fields produce explicit rejection reasons", () => {
  const reasons = validateRequiredUniversityFields(
    buildRecord({
      schoolName: " ",
      scholarshipNotes: "",
    })
  );

  assert.deepEqual(
    reasons.map((reason) => [reason.code, reason.field]),
    [
      ["missing_required_field", "schoolName"],
      ["missing_required_field", "scholarshipNotes"],
    ]
  );
});

test("missing provenance produces explicit rejection reasons", () => {
  const result = evaluateUniversityPublishability(buildRecord(), [
    completeProvenance[0]!,
  ]);

  assert.equal(result.status, "rejected");
  assert.ok(
    result.reasons.some(
      (reason) =>
        reason.code === "missing_source_provenance" &&
        reason.field === "tuitionAnnualUsd"
    )
  );
});
