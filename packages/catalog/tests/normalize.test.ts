// packages/catalog/tests/normalize.test.ts
// Unit tests for ingest normalization into the canonical catalog record.
// Covers both happy-path coercion and explicit invalid-field diagnostics.

import assert from "node:assert/strict";
import test from "node:test";

import { normalizeUniversityCatalogRecord } from "../src/index.js";

function buildSelectedSources() {
  return [
    {
      fieldKey: "schoolName" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: "Example University",
      excerpt: "Admissions page",
      metadata: { capturedValue: "Example University" },
    },
    {
      fieldKey: "city" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: "Boston",
      excerpt: "Boston, Massachusetts",
      metadata: { capturedValue: "Boston" },
    },
    {
      fieldKey: "state" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: "MA",
      excerpt: "Boston, Massachusetts",
      metadata: { capturedValue: "MA" },
    },
    {
      fieldKey: "officialAdmissionsUrl" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: "https://example.edu/admissions",
      excerpt: "Official admissions URL",
      metadata: { capturedValue: "https://example.edu/admissions" },
    },
    {
      fieldKey: "applicationRounds" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: ["early_action", "regular_decision"],
      excerpt: "Early action and regular decision.",
      metadata: { capturedValue: "early_action,regular_decision" },
    },
    {
      fieldKey: "deadlinesByRound" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: { early_action: "2025-11-01", regular_decision: "2026-01-15" },
      excerpt: "Deadlines by round.",
      metadata: { capturedValue: '{"early_action":"2025-11-01"}' },
    },
    {
      fieldKey: "englishRequirements" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: {
        minimumIelts: 6.5,
        minimumToeflInternetBased: 90,
        waiverNotes: null,
      },
      excerpt: "IELTS 6.5, TOEFL 90.",
      metadata: { capturedValue: '{"minimumIelts":6.5}' },
    },
    {
      fieldKey: "testPolicy" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: "test_optional",
      excerpt: "Test optional",
      metadata: { capturedValue: "test_optional" },
    },
    {
      fieldKey: "requiredMaterials" as const,
      sourceKind: "official_admissions" as const,
      sourceUrl: "https://example.edu/admissions",
      value: ["transcript", "essay"],
      excerpt: "Transcript and essay required.",
      metadata: { capturedValue: "transcript,essay" },
    },
    {
      fieldKey: "tuitionAnnualUsd" as const,
      sourceKind: "official_tuition" as const,
      sourceUrl: "https://example.edu/tuition",
      value: 55000,
      excerpt: "$55,000 tuition.",
      metadata: { capturedValue: "55000" },
    },
    {
      fieldKey: "estimatedCostOfAttendanceUsd" as const,
      sourceKind: "official_cost_of_attendance" as const,
      sourceUrl: "https://example.edu/cost",
      value: 71000,
      excerpt: "$71,000 cost of attendance.",
      metadata: { capturedValue: "71000" },
    },
    {
      fieldKey: "livingCostEstimateUsd" as const,
      sourceKind: "official_cost_of_attendance" as const,
      sourceUrl: "https://example.edu/cost",
      value: 16000,
      excerpt: "$16,000 living costs.",
      metadata: { capturedValue: "16000" },
    },
    {
      fieldKey: "scholarshipAvailabilityFlag" as const,
      sourceKind: "official_scholarship" as const,
      sourceUrl: "https://example.edu/scholarships",
      value: true,
      excerpt: "Scholarships available.",
      metadata: { capturedValue: "true" },
    },
    {
      fieldKey: "scholarshipNotes" as const,
      sourceKind: "official_scholarship" as const,
      sourceUrl: "https://example.edu/scholarships",
      value: "Merit scholarships available.",
      excerpt: "Merit scholarships available.",
      metadata: { capturedValue: "Merit scholarships available." },
    },
  ];
}

test("normalization builds a catalog record from selected sources", () => {
  const result = normalizeUniversityCatalogRecord(
    buildSelectedSources(),
    new Date("2026-03-21T00:00:00.000Z")
  );

  assert.deepEqual(result.issues, []);
  assert.equal(result.record?.schoolName, "Example University");
  assert.equal(result.record?.tuitionAnnualUsd, 55000);
  assert.deepEqual(result.record?.applicationRounds, [
    "early_action",
    "regular_decision",
  ]);
});

test("normalization reports invalid numeric fields explicitly", () => {
  const selectedSources = buildSelectedSources().map((source) =>
    source.fieldKey === "tuitionAnnualUsd"
      ? { ...source, value: "not-a-number" }
      : source
  );

  const result = normalizeUniversityCatalogRecord(
    selectedSources,
    new Date("2026-03-21T00:00:00.000Z")
  );

  assert.equal(result.record, null);
  assert.ok(
    result.issues.some(
      (issue) =>
        issue.code === "invalid_field_value" &&
        issue.fieldKey === "tuitionAnnualUsd"
    )
  );
});
