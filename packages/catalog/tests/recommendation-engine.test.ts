// packages/catalog/tests/recommendation-engine.test.ts
// Integration coverage for the deterministic recommendation engine.
// Verifies failed and successful runs persist canonical run/result rows from published schools only.

import assert from "node:assert/strict";
import test from "node:test";

import {
  recommendationResults,
  recommendationRuns,
  studentProfileSnapshots,
  studentProfiles,
  universities,
  users,
  type StudentProfileRecord,
} from "@etest/db";

import { createCatalogTestDatabase } from "../../db/src/testing/pglite.js";
import { runRecommendationEngineForUser } from "../src/recommendation-engine.js";
import type { RecommendationEngineDb } from "../src/recommendation-engine.js";

test.todo(
  "intentional unknown or declined readiness fields are treated as caveated rather than missing"
);

test("engine persists a failed run when recommendation-blocking profile gaps remain", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedProfileState(database.db, {
      userId: "user_missing",
      currentProfile: buildCurrentSnapshotProfile({
        classRankPercent: null,
      }),
      projectedProfile: buildProjectedSnapshotProfile({
        projectedGpa100: null,
      }),
      projectedAssumptions: [],
    });

    await database.db.insert(universities).values([
      buildUniversityInsert({
        schoolName: "Only Publishable University",
        validationStatus: "publishable",
        admissionRateOverall: 0.4,
        satAverageOverall: 1300,
        annualCost: 50000,
        averageNetPriceUsd: 31000,
        programFitTags: ["computer_science"],
      }),
    ]);

    const result = await runRecommendationEngineForUser({
      db: database.db,
      userId: seeded.userId,
      profileState: {
        profile: {
          id: seeded.profile.id,
          userId: seeded.userId,
        },
        snapshots: seeded.snapshots,
        missingFields: [
          {
            snapshotKind: "current",
            path: "academic.classRankPercent",
            message: "Class rank percentile is required.",
          },
          {
            snapshotKind: "projected",
            path: "assumptions",
            message: "At least one projected-state assumption is required.",
          },
        ],
      },
    });

    assert.equal(result.run.runStatus, "failed");
    assert.equal(result.run.candidateSchoolCount, 0);
    assert.equal(result.run.scoringConfigSnapshot.tierThresholds.safetyMin, 80);
    assert.deepEqual(result.run.missingProfileFields, [
      "current.academic.classRankPercent",
      "projected.assumptions",
    ]);
    assert.deepEqual(result.results, []);

    const storedResults = await database.db
      .select()
      .from(recommendationResults);
    assert.equal(storedResults.length, 0);
  } finally {
    await database.close();
  }
});

test("engine scores only publishable schools and persists deterministic rank order", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedProfileState(database.db, {
      userId: "user_success",
      currentProfile: buildCurrentSnapshotProfile(),
      projectedProfile: buildProjectedSnapshotProfile(),
      projectedAssumptions: ["Raise GPA to 95", "Finalize essay drafts"],
    });

    await database.db.insert(universities).values([
      buildUniversityInsert({
        schoolName: "Target Tech",
        validationStatus: "publishable",
        admissionRateOverall: 0.42,
        satAverageOverall: 1290,
        annualCost: 52000,
        averageNetPriceUsd: 32000,
        programFitTags: ["computer_science", "engineering"],
      }),
      buildUniversityInsert({
        schoolName: "Stretch Institute",
        validationStatus: "publishable",
        admissionRateOverall: 0.12,
        satAverageOverall: 1490,
        annualCost: 69000,
        averageNetPriceUsd: 59000,
        programFitTags: ["computer_science"],
      }),
      buildUniversityInsert({
        schoolName: "Hidden Draft College",
        validationStatus: "draft",
        admissionRateOverall: 0.95,
        satAverageOverall: 1000,
        annualCost: 38000,
        averageNetPriceUsd: 25000,
        programFitTags: ["computer_science"],
      }),
    ]);

    const result = await runRecommendationEngineForUser({
      db: database.db,
      userId: seeded.userId,
      profileState: {
        profile: {
          id: seeded.profile.id,
          userId: seeded.userId,
        },
        snapshots: seeded.snapshots,
        missingFields: [],
      },
    });

    assert.equal(result.run.runStatus, "succeeded");
    assert.equal(result.run.candidateSchoolCount, 2);
    assert.equal(result.run.scoringConfigSnapshot.tierThresholds.safetyMin, 80);
    assert.equal(result.results.length, 2);
    assert.deepEqual(
      result.results.map((row) => row.rankOrder),
      [1, 2]
    );
    assert.ok(result.results[0].currentScore >= result.results[1].currentScore);
    assert.ok(result.results.every((row) => row.projectedScore !== null));
    assert.ok(
      result.results.every((row) => row.projectedAssumptionDelta.length === 2)
    );

    const storedRuns = await database.db.select().from(recommendationRuns);
    const storedResults = await database.db
      .select()
      .from(recommendationResults);

    assert.equal(storedRuns.length, 1);
    assert.equal(storedResults.length, 2);
  } finally {
    await database.close();
  }
});

test("engine rolls back pending run when result persistence fails", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedProfileState(database.db, {
      userId: "user_rollback",
      currentProfile: buildCurrentSnapshotProfile(),
      projectedProfile: buildProjectedSnapshotProfile(),
      projectedAssumptions: ["Raise GPA to 95"],
    });

    await database.db.insert(universities).values([
      buildUniversityInsert({
        schoolName: "Rollback University",
        validationStatus: "publishable",
        admissionRateOverall: 0.42,
        satAverageOverall: 1290,
        annualCost: 52000,
        averageNetPriceUsd: 32000,
        programFitTags: ["computer_science"],
      }),
    ]);

    const dbWithFailingResultInsert = createDbWithFailingResultInsert(
      database.db
    );

    await assert.rejects(
      runRecommendationEngineForUser({
        db: dbWithFailingResultInsert,
        userId: seeded.userId,
        profileState: {
          profile: {
            id: seeded.profile.id,
            userId: seeded.userId,
          },
          snapshots: seeded.snapshots,
          missingFields: [],
        },
      }),
      /simulated result insert failure/
    );

    const storedRuns = await database.db.select().from(recommendationRuns);
    const storedResults = await database.db
      .select()
      .from(recommendationResults);

    assert.equal(storedRuns.length, 0);
    assert.equal(storedResults.length, 0);
  } finally {
    await database.close();
  }
});

test("engine scoring config overrides can change tiers and outlooks", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedProfileState(database.db, {
      userId: "user_configurable",
      currentProfile: buildCurrentSnapshotProfile(),
      projectedProfile: buildProjectedSnapshotProfile(),
      projectedAssumptions: ["Raise GPA to 95", "Finalize essay drafts"],
    });

    await database.db.insert(universities).values([
      buildUniversityInsert({
        schoolName: "Configurable University",
        validationStatus: "publishable",
        admissionRateOverall: 0.42,
        satAverageOverall: 1290,
        annualCost: 52000,
        averageNetPriceUsd: 32000,
        programFitTags: ["computer_science", "engineering"],
      }),
    ]);

    const defaultResult = await runRecommendationEngineForUser({
      db: database.db,
      userId: seeded.userId,
      profileState: {
        profile: {
          id: seeded.profile.id,
          userId: seeded.userId,
        },
        snapshots: seeded.snapshots,
        missingFields: [],
      },
    });

    const strictResult = await runRecommendationEngineForUser({
      db: database.db,
      userId: seeded.userId,
      profileState: {
        profile: {
          id: seeded.profile.id,
          userId: seeded.userId,
        },
        snapshots: seeded.snapshots,
        missingFields: [],
      },
      scoringConfig: {
        tierThresholds: {
          safetyMin: 95,
          targetMin: 90,
        },
        outlookThresholds: {
          very_strong: 98,
          strong: 92,
          possible: 88,
          stretch: 80,
        },
      },
    });

    assert.equal(defaultResult.results.length, 1);
    assert.equal(strictResult.results.length, 1);
    assert.notEqual(
      defaultResult.results[0].tier,
      strictResult.results[0].tier
    );
    assert.notEqual(
      defaultResult.results[0].currentOutlook,
      strictResult.results[0].currentOutlook
    );
    assert.equal(
      strictResult.run.scoringConfigSnapshot.tierThresholds.safetyMin,
      95
    );
  } finally {
    await database.close();
  }
});

test("engine scores region-based location preferences through the extension", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const seeded = await seedProfileState(database.db, {
      userId: "user_region_pref",
      currentProfile: buildCurrentSnapshotProfile({
        preferredStates: [],
        preferredLocationPreferences: ["us_east_coast"],
      }),
      projectedProfile: buildProjectedSnapshotProfile({
        preferredStates: [],
        preferredLocationPreferences: ["us_east_coast"],
      }),
      projectedAssumptions: ["Keep academic momentum"],
    });

    const [eastCoastUniversity, westCoastUniversity] = await database.db
      .insert(universities)
      .values([
        buildUniversityInsert({
          schoolName: "East Coast Match",
          validationStatus: "publishable",
          admissionRateOverall: 0.42,
          satAverageOverall: 1290,
          annualCost: 52000,
          averageNetPriceUsd: 32000,
          programFitTags: ["computer_science", "engineering"],
          state: "MA",
        }),
        buildUniversityInsert({
          schoolName: "West Coast Miss",
          validationStatus: "publishable",
          admissionRateOverall: 0.42,
          satAverageOverall: 1290,
          annualCost: 52000,
          averageNetPriceUsd: 32000,
          programFitTags: ["computer_science", "engineering"],
          state: "CA",
        }),
      ])
      .returning();

    const result = await runRecommendationEngineForUser({
      db: database.db,
      userId: seeded.userId,
      profileState: {
        profile: {
          id: seeded.profile.id,
          userId: seeded.userId,
        },
        snapshots: seeded.snapshots,
        missingFields: [],
      },
    });

    assert.equal(result.results.length, 2);
    assert.equal(result.results[0]?.universityId, eastCoastUniversity.id);
    assert.equal(result.results[1]?.universityId, westCoastUniversity.id);
    assert.ok(result.results[0].currentScore > result.results[1].currentScore);
  } finally {
    await database.close();
  }
});

async function seedProfileState(
  db: Awaited<ReturnType<typeof createCatalogTestDatabase>>["db"],
  input: {
    userId: string;
    currentProfile: StudentProfileRecord;
    projectedProfile: StudentProfileRecord;
    projectedAssumptions: string[];
  }
) {
  await db.insert(users).values({
    id: input.userId,
    name: "Recommendation Runner",
    email: `${input.userId}@example.com`,
    emailVerified: true,
    image: null,
  });

  const [profile] = await db
    .insert(studentProfiles)
    .values({
      userId: input.userId,
      citizenshipCountry: input.currentProfile.citizenshipCountry,
      targetEntryTerm: input.currentProfile.targetEntryTerm,
      academic: input.currentProfile.academic,
      testing: input.currentProfile.testing,
      preferences: input.currentProfile.preferences,
      budget: input.currentProfile.budget,
      readiness: input.currentProfile.readiness,
    })
    .returning();

  const [currentSnapshot] = await db
    .insert(studentProfileSnapshots)
    .values({
      studentProfileId: profile.id,
      snapshotKind: "current",
      assumptions: [],
      profile: input.currentProfile,
    })
    .returning();

  const [projectedSnapshot] = await db
    .insert(studentProfileSnapshots)
    .values({
      studentProfileId: profile.id,
      snapshotKind: "projected",
      assumptions: input.projectedAssumptions,
      profile: input.projectedProfile,
    })
    .returning();

  return {
    userId: input.userId,
    profile,
    snapshots: {
      current: {
        id: currentSnapshot.id,
        assumptions: currentSnapshot.assumptions,
        profile: currentSnapshot.profile,
      },
      projected: {
        id: projectedSnapshot.id,
        assumptions: projectedSnapshot.assumptions,
        profile: projectedSnapshot.profile,
      },
    },
  };
}

function buildCurrentSnapshotProfile(input?: {
  classRankPercent?: number | null;
  preferredStates?: string[];
  preferredLocationPreferences?: StudentProfileRecord["preferences"]["preferredLocationPreferences"];
}) {
  return buildSnapshotProfile({
    currentGpa100: 91,
    projectedGpa100: 94,
    classRankPercent: input?.classRankPercent ?? 12,
    preferredStates: input?.preferredStates,
    preferredLocationPreferences: input?.preferredLocationPreferences,
  });
}

function buildProjectedSnapshotProfile(input?: {
  projectedGpa100?: number | null;
  preferredStates?: string[];
  preferredLocationPreferences?: StudentProfileRecord["preferences"]["preferredLocationPreferences"];
}) {
  return buildSnapshotProfile({
    currentGpa100: 91,
    projectedGpa100: input?.projectedGpa100 ?? 95,
    classRankPercent: 12,
    preferredStates: input?.preferredStates,
    preferredLocationPreferences: input?.preferredLocationPreferences,
  });
}

function buildSnapshotProfile(input: {
  currentGpa100: number | null;
  projectedGpa100: number | null;
  classRankPercent: number | null;
  preferredStates?: string[];
  preferredLocationPreferences?: StudentProfileRecord["preferences"]["preferredLocationPreferences"];
}): StudentProfileRecord {
  return {
    id: "snapshot_profile",
    userId: "snapshot_user",
    citizenshipCountry: "VN",
    targetEntryTerm: "fall_2027",
    academic: {
      currentGpa100: input.currentGpa100,
      projectedGpa100: input.projectedGpa100,
      curriculumStrength: "rigorous",
      classRankPercent: input.classRankPercent,
    },
    testing: {
      satTotal: 1420,
      actComposite: null,
      englishExamType: "ielts",
      englishExamScore: 7.5,
      willSubmitTests: true,
    },
    preferences: {
      intendedMajors: ["computer_science"],
      preferredStates: input.preferredStates ?? ["CA", "MA"],
      preferredLocationPreferences: input.preferredLocationPreferences ?? [],
      preferredCampusLocale: ["urban", "suburban"],
      preferredSchoolControl: ["public", "private_nonprofit"],
      preferredUndergraduateSize: "medium",
    },
    budget: {
      annualBudgetUsd: 55000,
      needsFinancialAid: true,
      needsMeritAid: true,
      budgetFlexibility: "medium",
    },
    readiness: {
      wantsEarlyRound: true,
      hasTeacherRecommendationsReady: true,
      hasCounselorDocumentsReady: false,
      hasEssayDraftsStarted: true,
    },
    createdAt: "2026-03-22T00:00:00.000Z",
    updatedAt: "2026-03-22T00:00:00.000Z",
  };
}

function buildUniversityInsert(input: {
  schoolName: string;
  validationStatus: "draft" | "publishable" | "rejected";
  admissionRateOverall: number;
  satAverageOverall: number;
  annualCost: number;
  averageNetPriceUsd: number;
  programFitTags: Array<"computer_science" | "engineering">;
  state?: string;
}) {
  return {
    schoolName: input.schoolName,
    city: "Boston",
    state: input.state ?? "MA",
    officialAdmissionsUrl: `https://${input.schoolName.toLowerCase().replace(/\s+/g, "-")}.example.edu/admissions`,
    applicationRounds: ["regular_decision"],
    deadlinesByRound: { regular_decision: "2026-01-15" },
    englishRequirements: {
      minimumIelts: 6.5,
      minimumToeflInternetBased: 90,
      waiverNotes: null,
    },
    testPolicy: "test_optional",
    requiredMaterials: ["transcript", "essay"],
    tuitionAnnualUsd: input.annualCost - 16000,
    estimatedCostOfAttendanceUsd: input.annualCost,
    livingCostEstimateUsd: 16000,
    scholarshipAvailabilityFlag: true,
    scholarshipNotes:
      "Merit scholarships available for international applicants.",
    recommendationInputs: {
      admissionRateOverall: input.admissionRateOverall,
      satAverageOverall: input.satAverageOverall,
      actMidpointCumulative: 31,
      undergraduateSize: 9000,
      averageNetPriceUsd: input.averageNetPriceUsd,
      schoolControl: "private_nonprofit" as const,
      campusLocale: "urban",
      internationalAidPolicy: "need_and_merit_available" as const,
      hasNeedBasedAid: true,
      hasMeritAid: true,
      programFitTags: input.programFitTags,
      programAdmissionModel: "direct_admit" as const,
      applicationStrategyTags: ["binding_early_decision"] as const,
      testingRequirements: {
        acceptedExams: ["sat", "act"] as const,
        minimumSatTotal: null,
        minimumActComposite: null,
        latestSatTestDateNote: "December SAT accepted.",
        latestActTestDateNote: "December ACT accepted.",
        superscorePolicy: "both" as const,
        writingEssayPolicy: "optional" as const,
        scoreReportingPolicy: "self_report_allowed" as const,
        middle50SatTotal: { low: 1280, high: 1490 },
        middle50ActComposite: { low: 29, high: 34 },
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
      internationalStudentConsiderations: ["need_based_aid_available"] as const,
      potentialFitTags: ["strong_merit_aid_signal"] as const,
      potentialRiskTags: [],
      actionableApplicationSteps: ["research_merit_aid_deadlines"] as const,
    },
    lastVerifiedAt: new Date("2026-03-22T00:00:00.000Z"),
    validationStatus: input.validationStatus,
    validationReasons: [],
  } as const;
}

function createDbWithFailingResultInsert(
  db: RecommendationEngineDb
): RecommendationEngineDb {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "transaction") {
        return Reflect.get(target, property, receiver);
      }

      return (callback: (tx: RecommendationEngineDb) => Promise<unknown>) =>
        target.transaction((tx) => callback(createFailingResultInsertTx(tx)));
    },
  }) as RecommendationEngineDb;
}

function createFailingResultInsertTx(
  tx: RecommendationEngineDb
): RecommendationEngineDb {
  return new Proxy(tx, {
    get(target, property, receiver) {
      if (property !== "insert") {
        return Reflect.get(target, property, receiver);
      }

      return (table: unknown) => {
        if (table === recommendationResults) {
          throw new Error("simulated result insert failure");
        }

        return target.insert(table as never);
      };
    },
  }) as RecommendationEngineDb;
}
