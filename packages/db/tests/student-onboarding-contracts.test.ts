// packages/db/tests/student-onboarding-contracts.test.ts
// Contract guards for shared onboarding constants and live workspace copy.
// Fails fast if location-preference metadata drifts or placeholder copy returns.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  studentLocationPreferenceKinds,
  studentLocationPreferenceLabels,
  studentLocationPreferenceStateGroups,
} from "../src/index.js";

test("location preference labels stay in sync with the canonical enum", () => {
  assert.deepEqual(
    Object.keys(studentLocationPreferenceLabels).sort(),
    [...studentLocationPreferenceKinds].sort()
  );

  for (const [kind, states] of Object.entries(
    studentLocationPreferenceStateGroups
  )) {
    assert.ok(
      studentLocationPreferenceKinds.includes(
        kind as (typeof studentLocationPreferenceKinds)[number]
      )
    );
    assert.ok(states.every((state) => /^[A-Z]{2}$/.test(state)));
  }
});

test("live student-onboarding workspace copy stays free of placeholder and counselor-only stubs", async () => {
  const files = await Promise.all([
    readFile(
      new URL(
        "../../../apps/student-onboarding/src/components/student-onboarding/student-onboarding-review-panel.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../../../apps/student-onboarding/src/components/student-onboarding/student-onboarding-review-panels.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../../../apps/student-onboarding/src/components/student-onboarding/student-onboarding-experience.tsx",
        import.meta.url
      ),
      "utf8"
    ),
    readFile(
      new URL(
        "../../../apps/student-onboarding/src/components/student-onboarding/student-onboarding-profile-panel.tsx",
        import.meta.url
      ),
      "utf8"
    ),
  ]);

  const combined = files.join("\n");
  const bannedPhrases = [
    "stubbed empty state",
    "route layer",
    "placeholder view",
    "without introducing a second backend",
    "alumni handoff",
    "review queue",
    "counselor handoff",
  ];

  for (const phrase of bannedPhrases) {
    assert.equal(
      combined.includes(phrase),
      false,
      `Found banned onboarding copy: ${phrase}`
    );
  }
});
