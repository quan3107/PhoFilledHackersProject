import assert from "node:assert/strict";
import { test } from "node:test";

import {
  applicationRounds,
  budgetFits,
  catalogRequiredFields,
  confidenceLevels,
  deadlinePressures,
  intakeFieldPaths,
  recommendationOutlooks,
  recommendationTiers,
  testPolicies,
  universitySourceKinds,
} from "../src/index.js";

test("exports canonical contract enum values", () => {
  assert.deepEqual(applicationRounds, [
    "early_action",
    "early_decision",
    "regular_decision",
    "rolling_admission",
    "priority",
  ]);
  assert.ok(testPolicies.includes("test_optional"));
  assert.ok(universitySourceKinds.includes("official_admissions"));
  assert.ok(catalogRequiredFields.includes("testPolicy"));
  assert.ok(recommendationTiers.includes("target"));
  assert.ok(recommendationOutlooks.includes("possible"));
  assert.ok(budgetFits.includes("comfortable"));
  assert.ok(deadlinePressures.includes("medium"));
  assert.ok(confidenceLevels.includes("high"));
  assert.ok(intakeFieldPaths.includes("academic.currentGpa100"));
});
