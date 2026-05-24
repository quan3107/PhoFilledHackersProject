import assert from "node:assert/strict";
import { test } from "node:test";

import { profilePutRequestSchema } from "../src/http.js";

const validProfile = {
  citizenshipCountry: "Vietnam",
  targetEntryTerm: "Fall 2027",
  academic: {
    currentGpa100: 92,
    projectedGpa100: 95,
    curriculumStrength: "rigorous",
    classRankPercent: 10,
  },
  testing: {
    satTotal: 1450,
    actComposite: null,
    englishExamType: "ielts",
    englishExamScore: 7.5,
    willSubmitTests: true,
  },
  preferences: {
    intendedMajors: ["Computer Science"],
    preferredStates: ["CA"],
    preferredLocationPreferences: ["international"],
    preferredCampusLocale: ["urban"],
    preferredSchoolControl: ["private_nonprofit"],
    preferredUndergraduateSize: "medium",
  },
  budget: {
    annualBudgetUsd: 40000,
    needsFinancialAid: true,
    needsMeritAid: true,
    budgetFlexibility: "medium",
  },
  readiness: {
    wantsEarlyRound: true,
    hasTeacherRecommendationsReady: false,
    hasCounselorDocumentsReady: null,
    hasEssayDraftsStarted: true,
  },
};

test("profile PUT rejects out-of-range GPA and incomplete projected profile", () => {
  const result = profilePutRequestSchema.safeParse({
    currentProfile: {
      ...validProfile,
      academic: {
        ...validProfile.academic,
        currentGpa100: 101,
      },
    },
    projectedProfile: {
      ...validProfile,
      testing: undefined,
    },
    currentAssumptions: ["Current academic record is verified."],
    projectedAssumptions: ["SAT retake improves testing profile."],
  });

  assert.equal(result.success, false);
});

test("profile PUT accepts complete profile documents and bounded assumptions", () => {
  const result = profilePutRequestSchema.safeParse({
    currentProfile: validProfile,
    projectedProfile: validProfile,
    currentAssumptions: ["Current profile is student reported."],
    projectedAssumptions: ["Projected GPA assumes current trend continues."],
  });

  assert.equal(result.success, true);
});
