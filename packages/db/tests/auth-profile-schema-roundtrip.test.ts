// packages/db/tests/auth-profile-schema-roundtrip.test.ts
// Integration coverage for the auth and student-profile schema slice.
// Verifies Better Auth tables and profile snapshots round-trip through the checked-in migration.

import assert from "node:assert/strict";
import test from "node:test";

import { eq, and } from "drizzle-orm";

import {
  accounts,
  sessions,
  studentIntakeSessions,
  studentProfiles,
  studentProfileSnapshots,
  users,
} from "../src/index.js";
import { createCatalogTestDatabase } from "../src/testing/pglite.js";

test("auth rows and student profile snapshots round-trip through the schema", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(users).values({
      id: "user_1",
      name: "Minh Anh",
      email: "minh.anh@example.com",
      emailVerified: true,
      image: null,
    });

    await database.db.insert(accounts).values({
      id: "account_1",
      accountId: "minh.anh@example.com",
      providerId: "credential",
      userId: "user_1",
      password: "hashed-password",
    });

    await database.db.insert(sessions).values({
      id: "session_1",
      expiresAt: new Date("2026-04-21T00:00:00.000Z"),
      token: "token_1",
      userId: "user_1",
      ipAddress: "127.0.0.1",
      userAgent: "node:test",
    });

    const [insertedProfile] = await database.db
      .insert(studentProfiles)
      .values({
        userId: "user_1",
        citizenshipCountry: "VN",
        targetEntryTerm: "fall_2027",
        academic: {
          currentGpa100: 91,
          projectedGpa100: 94,
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

    const snapshotProfile = {
      id: insertedProfile.id,
      userId: insertedProfile.userId,
      citizenshipCountry: insertedProfile.citizenshipCountry,
      targetEntryTerm: insertedProfile.targetEntryTerm,
      academic: insertedProfile.academic,
      testing: insertedProfile.testing,
      preferences: insertedProfile.preferences,
      budget: insertedProfile.budget,
      readiness: insertedProfile.readiness,
      createdAt: insertedProfile.createdAt.toISOString(),
      updatedAt: insertedProfile.updatedAt.toISOString(),
    };

    await database.db.insert(studentProfileSnapshots).values([
      {
        studentProfileId: insertedProfile.id,
        snapshotKind: "current",
        assumptions: [],
        profile: snapshotProfile,
      },
      {
        studentProfileId: insertedProfile.id,
        snapshotKind: "projected",
        assumptions: ["Raise GPA to 94", "Complete counselor documents"],
        profile: snapshotProfile,
      },
    ]);

    await database.db.insert(studentIntakeSessions).values({
      userId: "user_1",
      currentStepIndex: 3,
      conversationDone: false,
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          text: "Nice to meet you! What grade are you currently in?",
          createdAt: "2026-03-22T00:00:00.000Z",
        },
        {
          id: "student-1",
          role: "student",
          text: "Grade 11",
          createdAt: "2026-03-22T00:00:10.000Z",
        },
      ],
    });

    const storedProfile = await database.db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, insertedProfile.id),
      with: {
        user: true,
        snapshots: true,
      },
    });

    assert.ok(storedProfile);
    assert.equal(storedProfile.user.email, "minh.anh@example.com");
    assert.equal(storedProfile.testing.englishExamType, "ielts");
    assert.deepEqual(storedProfile.preferences.preferredLocationPreferences, [
      "us_west_coast",
      "us_east_coast",
    ]);
    assert.equal(
      storedProfile.preferences.preferredUndergraduateSize,
      "medium"
    );
    assert.equal(storedProfile.snapshots.length, 2);

    const projectedSnapshot = storedProfile.snapshots.find(
      (snapshot) => snapshot.snapshotKind === "projected"
    );

    assert.ok(projectedSnapshot);
    assert.deepEqual(storedProfile.preferences.preferredLocationPreferences, [
      "us_west_coast",
      "us_east_coast",
    ]);
    assert.deepEqual(storedProfile.readiness, {
      wantsEarlyRound: true,
      hasTeacherRecommendationsReady: false,
      hasCounselorDocumentsReady: false,
      hasEssayDraftsStarted: true,
    });
    assert.deepEqual(projectedSnapshot.assumptions, [
      "Raise GPA to 94",
      "Complete counselor documents",
    ]);
    assert.deepEqual(
      projectedSnapshot.profile.preferences.preferredLocationPreferences,
      ["us_west_coast", "us_east_coast"]
    );
    assert.equal(
      projectedSnapshot.profile.readiness.hasEssayDraftsStarted,
      true
    );
    assert.equal(projectedSnapshot.profile.targetEntryTerm, "fall_2027");

    const reloadedCurrentProfile = {
      ...snapshotProfile,
      targetEntryTerm: "fall_2028",
      academic: {
        ...snapshotProfile.academic,
        currentGpa100: 95,
        projectedGpa100: 97,
      },
      testing: {
        ...snapshotProfile.testing,
        satTotal: 1520,
      },
      preferences: {
        ...snapshotProfile.preferences,
        intendedMajors: ["computer_science", "economics"],
        preferredStates: ["NY"],
        preferredLocationPreferences: ["us_east_coast"],
      },
      budget: {
        ...snapshotProfile.budget,
        annualBudgetUsd: 62000,
      },
      readiness: {
        wantsEarlyRound: false,
        hasTeacherRecommendationsReady: true,
        hasCounselorDocumentsReady: true,
        hasEssayDraftsStarted: true,
      },
    };
    const reloadedProjectedProfile = {
      ...reloadedCurrentProfile,
      academic: {
        ...reloadedCurrentProfile.academic,
        projectedGpa100: 99,
      },
    };

    await database.db
      .update(studentProfiles)
      .set({
        targetEntryTerm: reloadedCurrentProfile.targetEntryTerm,
        academic: reloadedCurrentProfile.academic,
        testing: reloadedCurrentProfile.testing,
        preferences: reloadedCurrentProfile.preferences,
        budget: reloadedCurrentProfile.budget,
        readiness: reloadedCurrentProfile.readiness,
      })
      .where(eq(studentProfiles.id, insertedProfile.id));

    await database.db
      .update(studentProfileSnapshots)
      .set({
        assumptions: ["Retook SAT", "Expanded school list"],
        profile: reloadedCurrentProfile,
      })
      .where(
        and(
          eq(studentProfileSnapshots.studentProfileId, insertedProfile.id),
          eq(studentProfileSnapshots.snapshotKind, "current")
        )
      );

    await database.db
      .update(studentProfileSnapshots)
      .set({
        assumptions: ["Reach 99 GPA", "Finalize essays early"],
        profile: reloadedProjectedProfile,
      })
      .where(
        and(
          eq(studentProfileSnapshots.studentProfileId, insertedProfile.id),
          eq(studentProfileSnapshots.snapshotKind, "projected")
        )
      );

    const reloadedProfile = await database.db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, insertedProfile.id),
      with: {
        snapshots: true,
      },
    });

    assert.ok(reloadedProfile);
    assert.equal(reloadedProfile.targetEntryTerm, "fall_2028");
    assert.equal(reloadedProfile.academic.currentGpa100, 95);
    assert.equal(reloadedProfile.testing.satTotal, 1520);
    assert.deepEqual(reloadedProfile.preferences.preferredStates, ["NY"]);
    assert.deepEqual(reloadedProfile.preferences.preferredLocationPreferences, [
      "us_east_coast",
    ]);
    assert.equal(reloadedProfile.snapshots.length, 2);

    const reloadedCurrentSnapshot = reloadedProfile.snapshots.find(
      (snapshot) => snapshot.snapshotKind === "current"
    );
    const reloadedProjectedSnapshot = reloadedProfile.snapshots.find(
      (snapshot) => snapshot.snapshotKind === "projected"
    );

    assert.ok(reloadedCurrentSnapshot);
    assert.ok(reloadedProjectedSnapshot);
    assert.deepEqual(reloadedCurrentSnapshot.profile, reloadedCurrentProfile);
    assert.deepEqual(reloadedCurrentSnapshot.assumptions, [
      "Retook SAT",
      "Expanded school list",
    ]);
    assert.deepEqual(
      reloadedProjectedSnapshot.profile,
      reloadedProjectedProfile
    );
    assert.deepEqual(reloadedProjectedSnapshot.assumptions, [
      "Reach 99 GPA",
      "Finalize essays early",
    ]);

    const storedIntake =
      await database.db.query.studentIntakeSessions.findFirst({
        where: eq(studentIntakeSessions.userId, "user_1"),
      });

    assert.ok(storedIntake);
    assert.equal(storedIntake.currentStepIndex, 3);
    assert.equal(storedIntake.messages.length, 2);
    assert.equal(storedIntake.messages[0]?.role, "assistant");
  } finally {
    await database.close();
  }
});

test("student profile sentinel values and caveat assumptions persist without normalization", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(users).values({
      id: "user_2",
      name: "Ngoc Anh",
      email: "ngoc.anh@example.com",
      emailVerified: true,
      image: null,
    });

    const [insertedProfile] = await database.db
      .insert(studentProfiles)
      .values({
        userId: "user_2",
        citizenshipCountry: "VN",
        targetEntryTerm: "fall_2028",
        academic: {
          currentGpa100: null,
          projectedGpa100: null,
          curriculumStrength: "unknown",
          classRankPercent: null,
        },
        testing: {
          satTotal: null,
          actComposite: null,
          englishExamType: "unknown",
          englishExamScore: null,
          willSubmitTests: null,
        },
        preferences: {
          intendedMajors: [],
          preferredStates: [],
          preferredLocationPreferences: [],
          preferredCampusLocale: [],
          preferredSchoolControl: [],
          preferredUndergraduateSize: "unknown",
        },
        budget: {
          annualBudgetUsd: null,
          needsFinancialAid: null,
          needsMeritAid: null,
          budgetFlexibility: "unknown",
        },
        readiness: {
          wantsEarlyRound: null,
          hasTeacherRecommendationsReady: null,
          hasCounselorDocumentsReady: null,
          hasEssayDraftsStarted: null,
        },
      })
      .returning();

    const snapshotProfile = {
      id: insertedProfile.id,
      userId: insertedProfile.userId,
      citizenshipCountry: insertedProfile.citizenshipCountry,
      targetEntryTerm: insertedProfile.targetEntryTerm,
      academic: insertedProfile.academic,
      testing: insertedProfile.testing,
      preferences: insertedProfile.preferences,
      budget: insertedProfile.budget,
      readiness: insertedProfile.readiness,
      createdAt: insertedProfile.createdAt.toISOString(),
      updatedAt: insertedProfile.updatedAt.toISOString(),
    };

    await database.db.insert(studentProfileSnapshots).values([
      {
        studentProfileId: insertedProfile.id,
        snapshotKind: "current",
        assumptions: [
          "Student explicitly declined to estimate budget.",
          "Treat unreadiness as intentional and revisit later.",
        ],
        profile: snapshotProfile,
      },
      {
        studentProfileId: insertedProfile.id,
        snapshotKind: "projected",
        assumptions: [
          "Projected state stays caveated until the student answers.",
        ],
        profile: snapshotProfile,
      },
    ]);

    const storedProfile = await database.db.query.studentProfiles.findFirst({
      where: eq(studentProfiles.id, insertedProfile.id),
      with: {
        snapshots: true,
      },
    });

    assert.ok(storedProfile);
    assert.equal(storedProfile?.academic.curriculumStrength, "unknown");
    assert.equal(storedProfile?.testing.englishExamType, "unknown");
    assert.equal(
      storedProfile?.preferences.preferredUndergraduateSize,
      "unknown"
    );
    assert.equal(storedProfile?.budget.budgetFlexibility, "unknown");
    assert.deepEqual(storedProfile?.readiness, {
      wantsEarlyRound: null,
      hasTeacherRecommendationsReady: null,
      hasCounselorDocumentsReady: null,
      hasEssayDraftsStarted: null,
    });
    assert.deepEqual(storedProfile?.snapshots[0]?.assumptions, [
      "Student explicitly declined to estimate budget.",
      "Treat unreadiness as intentional and revisit later.",
    ]);
  } finally {
    await database.close();
  }
});
