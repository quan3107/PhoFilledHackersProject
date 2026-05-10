// packages/db/tests/recommendation-explanation-schema-roundtrip.test.ts
// Integration coverage for the recommendation shortlist and explanation schema slice.
// Verifies the checked-in migration and Drizzle schema round-trip persisted LLM outputs.

import assert from "node:assert/strict";
import test from "node:test";

import { asc, eq } from "drizzle-orm";

import {
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

type StudentProfileRow = typeof studentProfiles.$inferSelect;

test("recommendation shortlists and explanations round-trip through the schema", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(users).values({
      id: "user_1",
      name: "Minh Anh",
      email: "minh.anh@example.com",
      emailVerified: true,
      image: null,
    });

    const [insertedProfile] = await database.db
      .insert(studentProfiles)
      .values({
        userId: "user_1",
        citizenshipCountry: "VN",
        targetEntryTerm: "fall_2027",
      })
      .returning();

    const currentSnapshotProfile = toSnapshotProfile(insertedProfile);
    const projectedSnapshotProfile = toSnapshotProfile(insertedProfile, {
      projectedGpa100: 96,
    });

    const [currentSnapshot] = await database.db
      .insert(studentProfileSnapshots)
      .values({
        studentProfileId: insertedProfile.id,
        snapshotKind: "current",
        assumptions: ["current academic baseline"],
        profile: currentSnapshotProfile,
      })
      .returning();

    const [projectedSnapshot] = await database.db
      .insert(studentProfileSnapshots)
      .values({
        studentProfileId: insertedProfile.id,
        snapshotKind: "projected",
        assumptions: ["projected GPA uplift"],
        profile: projectedSnapshotProfile,
      })
      .returning();

    const [firstUniversity, secondUniversity] = await database.db
      .insert(universities)
      .values([
        buildUniversityInsert("Alpha University", 1280),
        buildUniversityInsert("Beta University", 1360),
      ])
      .returning();

    const [insertedRun] = await database.db
      .insert(recommendationRuns)
      .values({
        userId: "user_1",
        studentProfileId: insertedProfile.id,
        currentSnapshotId: currentSnapshot.id,
        projectedSnapshotId: projectedSnapshot.id,
        runStatus: "succeeded",
        missingProfileFields: [],
        candidateSchoolCount: 2,
        finishedAt: new Date("2026-03-22T00:00:00.000Z"),
      })
      .returning();

    const [firstResult, secondResult] = await database.db
      .insert(recommendationResults)
      .values([
        {
          recommendationRunId: insertedRun.id,
          universityId: firstUniversity.id,
          tier: "target",
          currentOutlook: "strong",
          projectedOutlook: "very_strong",
          confidenceLevel: "high",
          budgetFit: "comfortable",
          deadlinePressure: "low",
          currentScore: 82,
          projectedScore: 90,
          currentScoreBreakdown: {
            admissionFit: 18,
            readinessFit: 16,
            budgetFit: 17,
            preferenceFit: 15,
            improvementUpside: 16,
          },
          projectedScoreBreakdown: {
            admissionFit: 19,
            readinessFit: 18,
            budgetFit: 17,
            preferenceFit: 16,
            improvementUpside: 20,
          },
          projectedAssumptionDelta: ["Projected GPA increased to 96"],
          rankOrder: 1,
        },
        {
          recommendationRunId: insertedRun.id,
          universityId: secondUniversity.id,
          tier: "reach",
          currentOutlook: "possible",
          projectedOutlook: "strong",
          confidenceLevel: "medium",
          budgetFit: "stretch",
          deadlinePressure: "medium",
          currentScore: 66,
          projectedScore: 74,
          currentScoreBreakdown: {
            admissionFit: 13,
            readinessFit: 12,
            budgetFit: 14,
            preferenceFit: 13,
            improvementUpside: 14,
          },
          projectedScoreBreakdown: {
            admissionFit: 15,
            readinessFit: 13,
            budgetFit: 14,
            preferenceFit: 14,
            improvementUpside: 18,
          },
          projectedAssumptionDelta: ["Projected GPA increased to 96"],
          rankOrder: 2,
        },
      ])
      .returning();

    const [insertedShortlist] = await database.db
      .insert(recommendationShortlists)
      .values({
        recommendationRunId: insertedRun.id,
        model: "gpt-5-nano",
        promptVersion: "v1",
        systemPrompt: "system prompt text",
        shortlistedRecommendationResultIds: [secondResult.id, firstResult.id],
        shortlistRationale: [
          "Kept one reach and one target school.",
          "Balanced budget risk with strong projected fit.",
        ],
      })
      .returning();

    await database.db.insert(recommendationExplanations).values([
      {
        recommendationShortlistId: insertedShortlist.id,
        recommendationResultId: secondResult.id,
        whyRecommended: ["Strong projected fit.", "Matches intended major."],
        topBlockers: ["Higher budget stretch."],
        nextRecommendedActions: ["Review merit aid deadlines."],
        budgetSummary: ["Stretch but manageable."],
        assumptionChanges: ["Projected GPA remains on track."],
        explanationConfidence: "medium",
      },
      {
        recommendationShortlistId: insertedShortlist.id,
        recommendationResultId: firstResult.id,
        whyRecommended: ["Reliable target option.", "Strong budget position."],
        topBlockers: [],
        nextRecommendedActions: ["Submit by regular decision."],
        budgetSummary: ["Comfortable within budget."],
        assumptionChanges: ["Projected GPA uplift helps maintain target fit."],
        explanationConfidence: "high",
      },
    ]);

    const storedShortlist =
      await database.db.query.recommendationShortlists.findFirst({
        where: eq(recommendationShortlists.recommendationRunId, insertedRun.id),
        with: {
          recommendationRun: true,
          explanations: {
            with: {
              recommendationResult: {
                with: {
                  university: true,
                },
              },
            },
          },
        },
      });

    assert.ok(storedShortlist);
    assert.equal(storedShortlist?.model, "gpt-5-nano");
    assert.equal(storedShortlist?.promptVersion, "v1");
    assert.deepEqual(storedShortlist?.shortlistedRecommendationResultIds, [
      secondResult.id,
      firstResult.id,
    ]);
    assert.equal(storedShortlist?.recommendationRun.id, insertedRun.id);
    assert.equal(storedShortlist?.explanations.length, 2);
    assert.deepEqual(
      new Set(
        storedShortlist?.explanations.map(
          (entry) => entry.recommendationResult.id
        )
      ),
      new Set([secondResult.id, firstResult.id])
    );
    assert.ok(
      storedShortlist?.explanations.some(
        (entry) =>
          entry.recommendationResult.university.schoolName === "Beta University"
      )
    );
    assert.ok(
      storedShortlist?.explanations.some(
        (entry) =>
          entry.recommendationResult.university.schoolName ===
          "Alpha University"
      )
    );

    const storedExplanations = await database.db
      .select()
      .from(recommendationExplanations)
      .where(
        eq(
          recommendationExplanations.recommendationShortlistId,
          insertedShortlist.id
        )
      )
      .orderBy(asc(recommendationExplanations.createdAt));

    assert.equal(storedExplanations.length, 2);
    assert.deepEqual(
      storedExplanations.map((row) => row.explanationConfidence),
      ["medium", "high"]
    );
  } finally {
    await database.close();
  }
});

function toSnapshotProfile(
  profile: StudentProfileRow,
  overrides: Partial<{
    projectedGpa100: number | null;
  }> = {}
) {
  return {
    id: profile.id,
    userId: profile.userId,
    citizenshipCountry: profile.citizenshipCountry,
    targetEntryTerm: profile.targetEntryTerm,
    academic: {
      currentGpa100: null,
      projectedGpa100: overrides.projectedGpa100 ?? null,
      curriculumStrength: "unknown" as const,
      classRankPercent: null,
    },
    testing: {
      satTotal: null,
      actComposite: null,
      englishExamType: "unknown" as const,
      englishExamScore: null,
      willSubmitTests: null,
    },
    preferences: {
      intendedMajors: [],
      preferredStates: [],
      preferredLocationPreferences: [],
      preferredCampusLocale: [],
      preferredSchoolControl: [],
      preferredUndergraduateSize: "unknown" as const,
    },
    budget: {
      annualBudgetUsd: null,
      needsFinancialAid: null,
      needsMeritAid: null,
      budgetFlexibility: "unknown" as const,
    },
    readiness: {
      wantsEarlyRound: null,
      hasTeacherRecommendationsReady: null,
      hasCounselorDocumentsReady: null,
      hasEssayDraftsStarted: null,
    },
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function buildUniversityInsert(schoolName: string, satAverageOverall: number) {
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
      satAverageOverall,
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
