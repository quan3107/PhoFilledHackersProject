// packages/db/tests/atomic-persistence-schema.test.ts
// Confirms recommendation run/result writes remain transactional at the schema layer.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import {
  recommendationResults,
  recommendationRuns,
  studentProfileSnapshots,
  studentProfiles,
  users,
} from "../src/index.js";
import { createCatalogTestDatabase } from "../src/testing/pglite.js";

test("recommendation run and result inserts roll back as one unit", async () => {
  const database = await createCatalogTestDatabase();

  try {
    const userId = "atomic_db_user";
    await database.db.insert(users).values({
      id: userId,
      name: "Atomic DB Student",
      email: "atomic-db@example.com",
      emailVerified: true,
      image: null,
    });
    const [profile] = await database.db
      .insert(studentProfiles)
      .values({
        userId,
        citizenshipCountry: "VN",
        targetEntryTerm: "Fall 2027",
        academic: {
          currentGpa100: 91,
          projectedGpa100: 94,
          curriculumStrength: "rigorous",
          classRankPercent: 12,
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
          preferredStates: ["CA"],
          preferredLocationPreferences: [],
          preferredCampusLocale: ["urban"],
          preferredSchoolControl: ["private_nonprofit"],
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
      })
      .returning();
    const [snapshot] = await database.db
      .insert(studentProfileSnapshots)
      .values({
        studentProfileId: profile.id,
        snapshotKind: "current",
        assumptions: [],
        profile: {
          ...profile,
          createdAt: profile.createdAt.toISOString(),
          updatedAt: profile.updatedAt.toISOString(),
        },
      })
      .returning();

    await assert.rejects(
      database.db.transaction(async (tx) => {
        await tx.insert(recommendationRuns).values({
          id: randomUUID(),
          userId,
          studentProfileId: profile.id,
          currentSnapshotId: snapshot.id,
          projectedSnapshotId: null,
          runStatus: "pending",
          scoringConfigSnapshot: {
            admissionFit: {
              defaultScore: 12,
              scoreByMinGap: [],
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
              classRankBands: [],
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
          },
          missingProfileFields: [],
          candidateSchoolCount: 0,
        });

        throw new Error("simulated recommendation transaction failure");
      }),
      /simulated recommendation transaction failure/
    );

    assert.equal(
      (await database.db.select().from(recommendationRuns)).length,
      0
    );
    assert.equal(
      (await database.db.select().from(recommendationResults)).length,
      0
    );
  } finally {
    await database.close();
  }
});
