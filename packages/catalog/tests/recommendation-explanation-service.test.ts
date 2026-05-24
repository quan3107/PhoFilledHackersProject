// packages/catalog/tests/recommendation-explanation-service.test.ts
// Integration coverage for the LLM shortlist/explanation pass.
// Verifies strict Responses API parsing, persistence, and read-back behavior.

import assert from "node:assert/strict";
import test from "node:test";
import { eq } from "drizzle-orm";

import {
  recommendationExplanations,
  recommendationResults,
  recommendationRuns,
  recommendationShortlists,
  studentProfileSnapshots,
  studentProfiles,
  universities,
  users,
} from "@etest/db";

import { createCatalogTestDatabase } from "../../db/src/testing/pglite.js";
import {
  createRecommendationExplanationClient,
  getPersistedRecommendationExplanationBundle,
  RecommendationExplanationOutputError,
  runRecommendationExplanationPassForRun,
} from "../src/index.js";

test("recommendation explanation pass persists shortlist and explanation rows", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedRunState(database.db);
    const requests: Array<{ url: string; init: RequestInit }> = [];

    await database.db
      .update(universities)
      .set({
        schoolName: "Renamed Draft University",
        validationStatus: "draft",
      })
      .where(eq(universities.id, seeded.results[1].universityId));

    const client = createRecommendationExplanationClient(
      {
        apiKey: "openai-key",
        model: "gpt-5-nano",
        reasoningEffort: "low",
        endpoint: "https://openai.example/responses",
      },
      async (url, init) => {
        requests.push({ url, init: init ?? {} });
        return new Response(
          JSON.stringify(
            buildOpenAiResponse({
              recommendationRunId: seeded.run.id,
              shortlistedRecommendationResultIds: [
                seeded.results[1].id,
                seeded.results[0].id,
              ],
              shortlistRationale: [
                "Balanced target and reach coverage.",
                "Kept budget risk acceptable.",
              ],
              explanations: [
                {
                  recommendationResultId: seeded.results[1].id,
                  whyRecommended: ["Strong projected fit."],
                  topBlockers: ["Stretch budget."],
                  nextRecommendedActions: ["Review merit aid deadlines."],
                  budgetSummary: ["Stretch but manageable."],
                  assumptionChanges: ["Projected GPA uplift remains on track."],
                  explanationConfidence: "medium",
                },
                {
                  recommendationResultId: seeded.results[0].id,
                  whyRecommended: ["Reliable target option."],
                  topBlockers: [],
                  nextRecommendedActions: ["Submit by regular decision."],
                  budgetSummary: ["Comfortable within budget."],
                  assumptionChanges: [
                    "Projected GPA uplift helps maintain fit.",
                  ],
                  explanationConfidence: "high",
                },
              ],
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    );

    const bundle = await runRecommendationExplanationPassForRun({
      db: database.db,
      recommendationRunId: seeded.run.id,
      client,
    });

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.url, "https://openai.example/responses");

    const requestBody = JSON.parse(String(requests[0]?.init.body));
    assert.equal(requestBody.model, "gpt-5-nano");
    assert.equal(requestBody.store, false);
    assert.equal(
      requestBody.text.format.name,
      "recommendation_explanation_pass"
    );
    assert.match(
      requestBody.instructions,
      /Shortlist only from the provided scored result ids/
    );

    assert.equal(bundle.shortlist?.model, "gpt-5-nano");
    assert.equal(bundle.shortlist?.promptVersion, "v1");
    assert.deepEqual(bundle.shortlist?.shortlistedRecommendationResultIds, [
      seeded.results[1].id,
      seeded.results[0].id,
    ]);
    assert.deepEqual(
      bundle.explanations.map((entry) => entry.recommendationResultId),
      [seeded.results[1].id, seeded.results[0].id]
    );
    assert.equal(bundle.explanations[0]?.school.schoolName, "Beta University");
    assert.equal(bundle.explanations[1]?.school.schoolName, "Alpha University");

    const storedBundle = await getPersistedRecommendationExplanationBundle(
      database.db,
      seeded.run.id
    );
    assert.ok(storedBundle);
    assert.deepEqual(
      storedBundle?.shortlist?.shortlistedRecommendationResultIds,
      [seeded.results[1].id, seeded.results[0].id]
    );
    assert.equal(
      storedBundle?.explanations[0]?.recommendationResult.id,
      seeded.results[1].id
    );
    assert.equal(
      storedBundle?.explanations[1]?.recommendationResult.id,
      seeded.results[0].id
    );
  } finally {
    await database.close();
  }
});

test("invalid model output is rejected before persistence", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedRunState(database.db);
    const client = createRecommendationExplanationClient(
      {
        apiKey: "openai-key",
        model: "gpt-5-nano",
        reasoningEffort: "low",
      },
      async () =>
        new Response(
          JSON.stringify(
            buildOpenAiResponse({
              recommendationRunId: seeded.run.id,
              shortlistedRecommendationResultIds: [
                seeded.results[0].id,
                "unknown-result-id",
              ],
              shortlistRationale: ["Invalid shortlist."],
              explanations: [
                {
                  recommendationResultId: seeded.results[0].id,
                  whyRecommended: ["Still grounded."],
                  topBlockers: [],
                  nextRecommendedActions: [],
                  budgetSummary: [],
                  assumptionChanges: [],
                  explanationConfidence: "low",
                },
                {
                  recommendationResultId: "unknown-result-id",
                  whyRecommended: ["Invented school."],
                  topBlockers: [],
                  nextRecommendedActions: [],
                  budgetSummary: [],
                  assumptionChanges: [],
                  explanationConfidence: "low",
                },
              ],
            })
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
    );

    await assert.rejects(
      () =>
        runRecommendationExplanationPassForRun({
          db: database.db,
          recommendationRunId: seeded.run.id,
          client,
        }),
      RecommendationExplanationOutputError
    );

    const storedShortlists = await database.db
      .select()
      .from(recommendationShortlists);
    const storedExplanations = await database.db
      .select()
      .from(recommendationExplanations);

    assert.equal(storedShortlists.length, 0);
    assert.equal(storedExplanations.length, 0);
    assert.equal(
      await getPersistedRecommendationExplanationBundle(
        database.db,
        seeded.run.id
      ),
      null
    );
  } finally {
    await database.close();
  }
});

async function seedRunState(
  db: Awaited<ReturnType<typeof createCatalogTestDatabase>>["db"]
) {
  await db.insert(users).values({
    id: "user_1",
    name: "Minh Anh",
    email: "minh.anh@example.com",
    emailVerified: true,
    image: null,
  });

  const [insertedProfile] = await db
    .insert(studentProfiles)
    .values({
      userId: "user_1",
      citizenshipCountry: "VN",
      targetEntryTerm: "fall_2027",
    })
    .returning();

  const [currentSnapshot] = await db
    .insert(studentProfileSnapshots)
    .values({
      studentProfileId: insertedProfile.id,
      snapshotKind: "current",
      assumptions: ["current academic baseline"],
      profile: toSnapshotProfile(insertedProfile),
    })
    .returning();

  const [projectedSnapshot] = await db
    .insert(studentProfileSnapshots)
    .values({
      studentProfileId: insertedProfile.id,
      snapshotKind: "projected",
      assumptions: ["projected GPA uplift"],
      profile: toSnapshotProfile(insertedProfile, { projectedGpa100: 96 }),
    })
    .returning();

  const [firstUniversity, secondUniversity] = await db
    .insert(universities)
    .values([
      buildUniversityInsert("Alpha University", 1280),
      buildUniversityInsert("Beta University", 1360),
    ])
    .returning();

  const [run] = await db
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

  const [firstResult, secondResult] = await db
    .insert(recommendationResults)
    .values([
      {
        recommendationRunId: run.id,
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
        recommendationRunId: run.id,
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
    ])
    .returning();

  return {
    profile: insertedProfile,
    run,
    results: [firstResult, secondResult],
  } as const;
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

function toSnapshotProfile(
  profile: typeof studentProfiles.$inferSelect,
  overrides: Partial<{ projectedGpa100: number | null }> = {}
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

function buildOpenAiResponse(output: object) {
  return {
    status: "completed",
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(output),
          },
        ],
      },
    ],
  };
}
