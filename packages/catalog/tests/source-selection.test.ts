// packages/catalog/tests/source-selection.test.ts
// Unit tests for deterministic ingest source selection.
// Verifies the branch-3 runner can map extracted facts back to official page kinds.

import assert from "node:assert/strict";
import test from "node:test";

import { selectUniversityFieldSources } from "../src/index.js";

test("source selection chooses the expected official source kinds", () => {
  const result = selectUniversityFieldSources([
    {
      fieldKey: "schoolName",
      sourceKind: "official_admissions",
      sourceUrl: "https://example.edu/admissions",
      value: "Example University",
      excerpt: "Admissions overview.",
    },
    {
      fieldKey: "tuitionAnnualUsd",
      sourceKind: "official_tuition",
      sourceUrl: "https://example.edu/tuition",
      value: 55000,
      excerpt: "Annual tuition is $55,000.",
    },
    {
      fieldKey: "estimatedCostOfAttendanceUsd",
      sourceKind: "official_cost_of_attendance",
      sourceUrl: "https://example.edu/cost",
      value: 71000,
      excerpt: "Estimated total cost is $71,000.",
    },
    {
      fieldKey: "livingCostEstimateUsd",
      sourceKind: "official_cost_of_attendance",
      sourceUrl: "https://example.edu/cost",
      value: 16000,
      excerpt: "Living costs are $16,000.",
    },
    {
      fieldKey: "scholarshipAvailabilityFlag",
      sourceKind: "official_scholarship",
      sourceUrl: "https://example.edu/scholarships",
      value: true,
      excerpt: "Scholarships are available.",
    },
    {
      fieldKey: "scholarshipNotes",
      sourceKind: "official_scholarship",
      sourceUrl: "https://example.edu/scholarships",
      value: "Merit scholarships available.",
      excerpt: "Merit scholarships available.",
    },
  ]);

  assert.equal(result.selectedSources.length, 6);
  assert.deepEqual(
    result.selectedSources.map((source) => [
      source.fieldKey,
      source.sourceKind,
    ]),
    [
      ["schoolName", "official_admissions"],
      ["tuitionAnnualUsd", "official_tuition"],
      ["estimatedCostOfAttendanceUsd", "official_cost_of_attendance"],
      ["livingCostEstimateUsd", "official_cost_of_attendance"],
      ["scholarshipAvailabilityFlag", "official_scholarship"],
      ["scholarshipNotes", "official_scholarship"],
    ]
  );
});

test("source selection reports missing required candidates", () => {
  const result = selectUniversityFieldSources([
    {
      fieldKey: "schoolName",
      sourceKind: "official_admissions",
      sourceUrl: "https://example.edu/admissions",
      value: "Example University",
      excerpt: "Admissions overview.",
    },
  ]);

  assert.ok(
    result.issues.some(
      (issue) =>
        issue.code === "missing_source_candidate" &&
        issue.fieldKey === "tuitionAnnualUsd"
    )
  );
});
