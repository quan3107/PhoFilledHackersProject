// packages/db/tests/recommendation-engine-schema-roundtrip.test.ts
// Integration coverage for the recommendation run/result schema slice.
// Verifies the checked-in migration and Drizzle schema round-trip persisted recommendation history.

import assert from "node:assert/strict";
import test from "node:test";

import { asc, eq } from "drizzle-orm";

import {
  recommendationResults,
  recommendationRuns,
  type RecommendationScoringConfigSnapshot,
  studentProfileSnapshots,
  studentProfiles,
  universities,
  users,
} from "../src/index.js";
import { createCatalogTestDatabase } from "../src/testing/pglite.js";

type StudentProfileRow = typeof studentProfiles.$inferSelect;

test("recommendation runs and results round-trip through the schema", async () => {
  const database = await createCatalogTestDatabase();
  const scoringConfigSnapshot: RecommendationScoringConfigSnapshot = {
    admissionFit: {
      defaultScore: 12,
      scoreByMinGap: [
        { minGap: 18, score: 20 },
        { minGap: 8, score: 17 },
        { minGap: -4, score: 14 },
        { minGap: -14, score: 10 },
        { minGap: -24, score: 6 },
        { minGap: -999, score: 2 },
      ],
      testingRequiredNoSubmissionPenalty: 6,
    },
    readinessFit: {
      perReadyItem: 5,
      noEarlyRoundBonus: 5,
      earlyRoundReadyBonus: 5,
      earlyRoundReadyThreshold: 2,
    },
    preferenceFit: {
      majorMatchScore: 8,
      majorFallbackScore: 2,
      stateMatchScore: 4,
      localeMatchScore: 3,
      schoolControlMatchScore: 2,
      sizeMatchScore: 3,
    },
    improvementUpside: {
      gpaDeltaDivisor: 1.5,
      assumptionBonusCap: 4,
    },
    studentIndex: {
      gpaMultiplier: 0.6,
      satPointsMax: 18,
      actPointsMax: 18,
      curriculumBonuses: {
        baseline: 5,
        rigorous: 10,
        most_rigorous: 14,
        unknown: 0,
      },
      classRankBands: [
        { maxPercentile: 5, bonus: 14 },
        { maxPercentile: 10, bonus: 11 },
        { maxPercentile: 20, bonus: 8 },
        { maxPercentile: 35, bonus: 4 },
      ],
    },
    schoolIndex: {
      admissionRateNullScore: 50,
      admissionRateMinScore: 10,
      admissionRateMaxScore: 95,
      satScoreMin: 0,
      satScoreMax: 100,
      actScoreMin: 0,
      actScoreMax: 100,
    },
    budgetFit: {
      flexibilityBufferHigh: 12000,
      flexibilityBufferMedium: 6000,
      stretchCoaGapBuffer: 5000,
      componentScores: {
        comfortable: 20,
        stretch: 11,
        high_risk: 4,
        unknown: 0,
      },
    },
    tierThresholds: {
      safetyMin: 80,
      targetMin: 60,
    },
    outlookThresholds: {
      very_strong: 85,
      strong: 70,
      possible: 55,
      stretch: 40,
    },
    sizeBuckets: {
      smallMaxExclusive: 5000,
      mediumMaxInclusive: 15000,
    },
  };

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
        academic: {
          currentGpa100: 91,
          projectedGpa100: 95,
          curriculumStrength: "rigorous",
          classRankPercent: 12,
        },
        testing: {
          satTotal: 1450,
          actComposite: null,
          englishExamType: "ielts",
          englishExamScore: 7.5,
          willSubmitTests: true,
        },
        preferences: {
          intendedMajors: ["computer_science", "data_science"],
          preferredStates: ["CA", "MA"],
          preferredLocationPreferences: ["us_west_coast", "us_east_coast"],
          preferredCampusLocale: ["urban"],
          preferredSchoolControl: ["public", "private_nonprofit"],
          preferredUndergraduateSize: "medium",
        },
        budget: {
          annualBudgetUsd: 50000,
          needsFinancialAid: true,
          needsMeritAid: true,
          budgetFlexibility: "medium",
        },
        readiness: {
          wantsEarlyRound: true,
          hasTeacherRecommendationsReady: false,
          hasCounselorDocumentsReady: false,
          hasEssayDraftsStarted: true,
        },
      })
      .returning();

    const currentSnapshotProfile = toSnapshotProfile(insertedProfile, {
      projectedGpa100: insertedProfile.academic.projectedGpa100,
    });
    const projectedSnapshotProfile = toSnapshotProfile(insertedProfile, {
      academic: {
        ...insertedProfile.academic,
        projectedGpa100: 96,
      },
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
        scoringConfigSnapshot,
        missingProfileFields: [],
        candidateSchoolCount: 2,
        finishedAt: new Date("2026-03-22T00:00:00.000Z"),
      })
      .returning();

    await database.db.insert(recommendationResults).values([
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
        candidateSchoolSnapshot: toCandidateSchoolSnapshot(firstUniversity),
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
        candidateSchoolSnapshot: toCandidateSchoolSnapshot(secondUniversity),
        rankOrder: 2,
      },
    ]);

    const storedRun = await database.db.query.recommendationRuns.findFirst({
      where: eq(recommendationRuns.id, insertedRun.id),
      with: {
        studentProfile: true,
        currentSnapshot: true,
        projectedSnapshot: true,
      },
    });

    assert.ok(storedRun);
    assert.equal(storedRun?.runStatus, "succeeded");
    assert.deepEqual(storedRun?.scoringConfigSnapshot, scoringConfigSnapshot);
    assert.equal(storedRun?.candidateSchoolCount, 2);
    assert.equal(storedRun?.studentProfile.userId, "user_1");
    assert.equal(storedRun?.currentSnapshot.id, currentSnapshot.id);
    assert.equal(storedRun?.projectedSnapshot?.id, projectedSnapshot.id);
    assert.deepEqual(storedRun?.currentSnapshot.assumptions, [
      "current academic baseline",
    ]);
    assert.deepEqual(storedRun?.projectedSnapshot?.assumptions, [
      "projected GPA uplift",
    ]);

    const storedResults = await database.db
      .select()
      .from(recommendationResults)
      .where(eq(recommendationResults.recommendationRunId, insertedRun.id))
      .orderBy(asc(recommendationResults.rankOrder));

    assert.deepEqual(
      storedResults.map((result) => ({
        universityId: result.universityId,
        tier: result.tier,
        currentOutlook: result.currentOutlook,
        projectedOutlook: result.projectedOutlook,
        confidenceLevel: result.confidenceLevel,
        budgetFit: result.budgetFit,
        deadlinePressure: result.deadlinePressure,
        currentScore: result.currentScore,
        projectedScore: result.projectedScore,
        rankOrder: result.rankOrder,
      })),
      [
        {
          universityId: firstUniversity.id,
          tier: "target",
          currentOutlook: "strong",
          projectedOutlook: "very_strong",
          confidenceLevel: "high",
          budgetFit: "comfortable",
          deadlinePressure: "low",
          currentScore: 82,
          projectedScore: 90,
          rankOrder: 1,
        },
        {
          universityId: secondUniversity.id,
          tier: "reach",
          currentOutlook: "possible",
          projectedOutlook: "strong",
          confidenceLevel: "medium",
          budgetFit: "stretch",
          deadlinePressure: "medium",
          currentScore: 66,
          projectedScore: 74,
          rankOrder: 2,
        },
      ]
    );
  } finally {
    await database.close();
  }
});

function toSnapshotProfile(
  profile: StudentProfileRow,
  overrides: Partial<{
    academic: StudentProfileRow["academic"];
    projectedGpa100: number | null;
  }>
) {
  return {
    id: profile.id,
    userId: profile.userId,
    citizenshipCountry: profile.citizenshipCountry,
    targetEntryTerm: profile.targetEntryTerm,
    academic: overrides.academic ?? {
      ...profile.academic,
      projectedGpa100:
        overrides.projectedGpa100 ?? profile.academic.projectedGpa100,
    },
    testing: profile.testing,
    preferences: profile.preferences,
    budget: profile.budget,
    readiness: profile.readiness,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

function toCandidateSchoolSnapshot(row: typeof universities.$inferSelect) {
  return {
    universityId: row.id,
    schoolName: row.schoolName,
    city: row.city,
    state: row.state,
    lastVerifiedAt: row.lastVerifiedAt.toISOString(),
    tuitionAnnualUsd: row.tuitionAnnualUsd,
    estimatedCostOfAttendanceUsd: row.estimatedCostOfAttendanceUsd,
    livingCostEstimateUsd: row.livingCostEstimateUsd,
    scholarshipAvailabilityFlag: row.scholarshipAvailabilityFlag,
    scholarshipNotes: row.scholarshipNotes,
    recommendationInputs: row.recommendationInputs,
    explanationInputs: row.explanationInputs,
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
      schoolControl: "private_nonprofit",
      campusLocale: "urban",
      internationalAidPolicy: "need_and_merit_available",
      hasNeedBasedAid: true,
      hasMeritAid: true,
      programFitTags: ["engineering", "computer_science", "research_intensive"],
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
  } as const;
}
