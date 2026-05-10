// packages/db/tests/catalog-schema-roundtrip.test.ts
// Integration coverage for the branch-2 catalog schema slice.
// Verifies the checked-in migration and Drizzle schema work together for universities and provenance rows.

import assert from "node:assert/strict";
import test from "node:test";

import { eq } from "drizzle-orm";

import { universities, universitySources } from "../src/index.js";
import { createCatalogTestDatabase } from "../src/testing/pglite.js";

test("universities and university_sources round-trip through the catalog schema", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const [insertedUniversity] = await database.db
      .insert(universities)
      .values({
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
        scholarshipNotes:
          "Merit scholarships available for international applicants.",
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
          programFitTags: [
            "engineering",
            "computer_science",
            "research_intensive",
          ],
          programAdmissionModel: "direct_admit",
          applicationStrategyTags: ["binding_early_decision"],
          testingRequirements: {
            acceptedExams: ["sat", "act"],
            minimumSatTotal: null,
            minimumActComposite: null,
            latestSatTestDateNote: "Scores accepted through the December SAT.",
            latestActTestDateNote: "Scores accepted through the December ACT.",
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
        validationStatus: "publishable",
      })
      .returning();

    await database.db.insert(universitySources).values({
      universityId: insertedUniversity.id,
      sourceKind: "official_admissions",
      fieldKey: "officialAdmissionsUrl",
      sourceUrl: "https://example.edu/admissions",
      excerpt: "Official admissions landing page.",
      lastVerifiedAt: new Date("2026-03-21T00:00:00.000Z"),
      isPrimary: true,
      metadata: {
        notes: "Primary source for admissions facts.",
      },
    });

    const storedUniversity = await database.db.query.universities.findFirst({
      where: eq(universities.id, insertedUniversity.id),
      with: {
        universitySources: true,
      },
    });

    assert.ok(storedUniversity);
    assert.equal(storedUniversity.schoolName, "Example University");
    assert.equal(storedUniversity.validationStatus, "publishable");
    assert.equal(
      storedUniversity.recommendationInputs.internationalAidPolicy,
      "need_and_merit_available"
    );
    assert.equal(
      storedUniversity.recommendationInputs.averageNetPriceUsd,
      24000
    );
    assert.deepEqual(storedUniversity.recommendationInputs.programFitTags, [
      "engineering",
      "computer_science",
      "research_intensive",
    ]);
    assert.equal(
      storedUniversity.recommendationInputs.testingRequirements
        .superscorePolicy,
      "both"
    );
    assert.equal(
      storedUniversity.explanationInputs.applicationComplexity,
      "medium"
    );
    assert.equal(storedUniversity.universitySources.length, 1);
    assert.equal(
      storedUniversity.universitySources[0]?.fieldKey,
      "officialAdmissionsUrl"
    );
    assert.equal(
      storedUniversity.universitySources[0]?.sourceUrl,
      "https://example.edu/admissions"
    );
  } finally {
    await database.close();
  }
});
