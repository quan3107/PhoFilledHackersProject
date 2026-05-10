// apps/student-onboarding/src/lib/location-preferences.test.ts
// Regression coverage for the canonical location-preference labels and parser.
// Verifies the UI mapping stays aligned with the backend enum and round-trips cleanly.

import assert from "node:assert/strict";
import test from "node:test";

import { studentLocationPreferenceKinds } from "@etest/db";

import {
  formatLocationPreferences,
  locationPreferenceLabels,
  parseLocationPreferences,
} from "./location-preferences.js";

test("location preference labels stay aligned with the backend enum", () => {
  assert.deepEqual(
    Object.keys(locationPreferenceLabels),
    studentLocationPreferenceKinds
  );
});

test("location preferences parse and format round-trip through the shared helper", () => {
  const parsed = parseLocationPreferences(
    "US - East Coast, CA, UK, No preference"
  );

  assert.deepEqual(parsed.preferredStates, ["CA"]);
  assert.deepEqual(parsed.preferredLocationPreferences, [
    "us_east_coast",
    "uk",
    "no_preference",
  ]);
  assert.equal(
    formatLocationPreferences(parsed),
    "US - East Coast, UK, No preference"
  );
});
