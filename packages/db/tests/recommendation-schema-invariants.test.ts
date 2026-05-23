// packages/db/tests/recommendation-schema-invariants.test.ts
// Verifies recommendation persistence invariants that should be enforced by the database.

import assert from "node:assert/strict";
import test from "node:test";

import { asc, eq } from "drizzle-orm";

import {
  recommendationExplanationShortlistItems,
  recommendationExplanations,
  recommendationResults,
  recommendationRuns,
  recommendationShortlists,
  studentProfileSnapshots,
  studentProfiles,
  universities,
  users,
} from "../src/index.js";
import { createCatalogTestDatabase } from "../src/testing/pglite.js";

test("recommendation runs reject mismatched user and student profile ownership", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const { firstProfile, secondProfile, firstSnapshot } =
      await seedTwoProfiles(database.db);

    await assert.rejects(
      database.db.insert(recommendationRuns).values({
        userId: secondProfile.userId,
        studentProfileId: firstProfile.id,
        currentSnapshotId: firstSnapshot.id,
      })
    );
  } finally {
    await database.close();
  }
});

test("recommendation explanation shortlist items are ordered and FK-backed", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const { firstProfile, firstSnapshot } = await seedTwoProfiles(database.db);
    const [university] = await database.db
      .insert(universities)
      .values(buildUniversityInsert("Alpha University"))
      .returning();
    const [run] = await database.db
      .insert(recommendationRuns)
      .values({
        userId: firstProfile.userId,
        studentProfileId: firstProfile.id,
        currentSnapshotId: firstSnapshot.id,
        runStatus: "succeeded",
        candidateSchoolCount: 1,
      })
      .returning();
    const [result] = await database.db
      .insert(recommendationResults)
      .values({
        recommendationRunId: run.id,
        universityId: university.id,
        tier: "target",
        currentOutlook: "strong",
        confidenceLevel: "high",
        budgetFit: "comfortable",
        deadlinePressure: "low",
        currentScore: 82,
        currentScoreBreakdown: {
          admissionFit: 18,
          readinessFit: 16,
          budgetFit: 17,
          preferenceFit: 15,
          improvementUpside: 16,
        },
        rankOrder: 1,
      })
      .returning();
    const [shortlist] = await database.db
      .insert(recommendationShortlists)
      .values({
        recommendationRunId: run.id,
        model: "gpt-5-nano",
        promptVersion: "v1",
        systemPrompt: "system prompt text",
        shortlistRationale: ["Kept a target school."],
      })
      .returning();
    const [explanation] = await database.db
      .insert(recommendationExplanations)
      .values({
        recommendationShortlistId: shortlist.id,
        recommendationResultId: result.id,
        whyRecommended: ["Strong projected fit."],
        topBlockers: [],
        nextRecommendedActions: ["Review aid deadlines."],
        budgetSummary: ["Comfortable within budget."],
        assumptionChanges: [],
        explanationConfidence: "high",
      })
      .returning();

    await database.db.insert(recommendationExplanationShortlistItems).values({
      recommendationExplanationId: explanation.id,
      recommendationResultId: result.id,
      rankOrder: 1,
    });

    await assert.rejects(
      database.db.insert(recommendationExplanationShortlistItems).values({
        recommendationExplanationId: explanation.id,
        recommendationResultId: "00000000-0000-0000-0000-000000000000",
        rankOrder: 2,
      })
    );

    const rows = await database.db
      .select()
      .from(recommendationExplanationShortlistItems)
      .where(
        eq(
          recommendationExplanationShortlistItems.recommendationExplanationId,
          explanation.id
        )
      )
      .orderBy(asc(recommendationExplanationShortlistItems.rankOrder));

    assert.deepEqual(
      rows.map((row) => ({
        recommendationResultId: row.recommendationResultId,
        rankOrder: row.rankOrder,
      })),
      [{ recommendationResultId: result.id, rankOrder: 1 }]
    );
  } finally {
    await database.close();
  }
});

async function seedTwoProfiles(
  db: ReturnType<typeof createCatalogTestDatabase> extends Promise<infer T>
    ? T["db"]
    : never
) {
  await db.insert(users).values([
    {
      id: "user_1",
      name: "Minh Anh",
      email: "minh.anh@example.com",
      emailVerified: true,
      image: null,
    },
    {
      id: "user_2",
      name: "Lan Chi",
      email: "lan.chi@example.com",
      emailVerified: true,
      image: null,
    },
  ]);

  const [firstProfile, secondProfile] = await db
    .insert(studentProfiles)
    .values([
      {
        userId: "user_1",
        citizenshipCountry: "VN",
        targetEntryTerm: "fall_2027",
      },
      {
        userId: "user_2",
        citizenshipCountry: "VN",
        targetEntryTerm: "fall_2027",
      },
    ])
    .returning();

  const [firstSnapshot] = await db
    .insert(studentProfileSnapshots)
    .values({
      studentProfileId: firstProfile.id,
      snapshotKind: "current",
      assumptions: [],
      profile: {
        id: firstProfile.id,
        userId: firstProfile.userId,
        citizenshipCountry: firstProfile.citizenshipCountry,
        targetEntryTerm: firstProfile.targetEntryTerm,
        academic: firstProfile.academic,
        testing: firstProfile.testing,
        preferences: firstProfile.preferences,
        budget: firstProfile.budget,
        readiness: firstProfile.readiness,
        createdAt: firstProfile.createdAt.toISOString(),
        updatedAt: firstProfile.updatedAt.toISOString(),
      },
    })
    .returning();

  return { firstProfile, secondProfile, firstSnapshot };
}

function buildUniversityInsert(schoolName: string) {
  return {
    schoolName,
    city: "Boston",
    state: "MA",
    officialAdmissionsUrl: `https://${schoolName.toLowerCase().replaceAll(" ", "-")}.example.edu/admissions`,
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
      schoolControl: "private_nonprofit" as const,
      campusLocale: "urban",
      internationalAidPolicy: "need_and_merit_available" as const,
      hasNeedBasedAid: true,
      hasMeritAid: true,
      programFitTags: ["computer_science"],
      programAdmissionModel: "direct_admit" as const,
      applicationStrategyTags: ["regular_decision"],
      testingRequirements: {
        acceptedExams: ["sat", "act"],
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
    },
    explanationInputs: {
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
    },
    lastVerifiedAt: new Date("2026-03-21T00:00:00.000Z"),
    validationStatus: "publishable",
  } as const;
}
