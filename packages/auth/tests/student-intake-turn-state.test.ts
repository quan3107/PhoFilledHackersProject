// packages/auth/tests/student-intake-turn-state.test.ts
// Verifies profile and intake persistence can be composed as one transaction.

import assert from "node:assert/strict";
import test from "node:test";

import {
  studentIntakeSessions,
  studentProfileSnapshots,
  studentProfiles,
  users,
  type StudentProfileRecord,
} from "@etest/db";

import { createCatalogTestDatabase } from "../../db/src/testing/pglite.js";
import {
  saveStudentIntakeStateForUserWithDb,
  saveStudentProfileStateForUserWithDb,
  type StudentProfileInput,
} from "../src/student-profiles.js";

test("profile and intake turn state roll back together when intake persistence fails", async () => {
  const database = await createCatalogTestDatabase();

  try {
    await database.db.insert(users).values({
      id: "atomic_user",
      name: "Atomic Student",
      email: "atomic@example.com",
      emailVerified: true,
      image: null,
    });

    await assert.rejects(
      database.db.transaction(async (tx) => {
        await saveStudentProfileStateForUserWithDb(tx, {
          userId: "atomic_user",
          currentProfile: buildProfileInput(),
          projectedProfile: buildProfileInput({
            academic: {
              ...buildProfileInput().academic,
              projectedGpa100: 96,
            },
          }),
          currentAssumptions: ["Current baseline"],
          projectedAssumptions: ["Raise GPA"],
        });

        await saveStudentIntakeStateForUserWithDb(tx, {
          userId: "missing_user",
          currentStepIndex: 1,
          conversationDone: false,
          messages: [
            {
              id: "message_1",
              role: "assistant",
              text: "Tell me your GPA.",
              createdAt: "2026-03-22T00:00:00.000Z",
            },
          ],
        });
      }),
      /violates foreign key constraint|FOREIGN KEY constraint failed|Failed query/i
    );

    const storedProfiles = await database.db.select().from(studentProfiles);
    const storedSnapshots = await database.db
      .select()
      .from(studentProfileSnapshots);
    const storedIntakeSessions = await database.db
      .select()
      .from(studentIntakeSessions);

    assert.equal(storedProfiles.length, 0);
    assert.equal(storedSnapshots.length, 0);
    assert.equal(storedIntakeSessions.length, 0);
  } finally {
    await database.close();
  }
});

function buildProfileInput(
  overrides: Partial<StudentProfileRecord> = {}
): StudentProfileInput {
  return {
    citizenshipCountry: overrides.citizenshipCountry ?? "VN",
    targetEntryTerm: overrides.targetEntryTerm ?? "Fall 2027",
    academic: overrides.academic ?? {
      currentGpa100: 91,
      projectedGpa100: 94,
      curriculumStrength: "rigorous",
      classRankPercent: 12,
    },
    testing: overrides.testing ?? {
      satTotal: 1420,
      actComposite: null,
      englishExamType: "ielts",
      englishExamScore: 7.5,
      willSubmitTests: true,
    },
    preferences: overrides.preferences ?? {
      intendedMajors: ["computer_science"],
      preferredStates: ["CA", "MA"],
      preferredLocationPreferences: [],
      preferredCampusLocale: ["urban"],
      preferredSchoolControl: ["private_nonprofit"],
      preferredUndergraduateSize: "medium",
    },
    budget: overrides.budget ?? {
      annualBudgetUsd: 55000,
      needsFinancialAid: true,
      needsMeritAid: true,
      budgetFlexibility: "medium",
    },
    readiness: overrides.readiness ?? {
      wantsEarlyRound: true,
      hasTeacherRecommendationsReady: true,
      hasCounselorDocumentsReady: false,
      hasEssayDraftsStarted: true,
    },
  };
}
