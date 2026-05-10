// packages/db/tests/location-preferences-sync.test.ts
// Guard coverage for the UI-facing location preference mapping.
// Ensures the onboarding label map stays aligned with the canonical backend enum.

import assert from "node:assert/strict";
import test from "node:test";

import {
  studentLocationPreferenceKinds,
  studentLocationPreferenceLabels,
} from "../src/index.js";

test("student onboarding location labels stay in sync with the backend enum", () => {
  assert.deepEqual(
    Object.keys(studentLocationPreferenceLabels).sort(),
    [...studentLocationPreferenceKinds].sort()
  );
});
