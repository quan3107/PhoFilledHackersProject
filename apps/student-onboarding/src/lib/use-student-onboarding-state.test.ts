import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyStudentProfileDocument } from "./student-profile";
import { updateStudentProfileSnapshot } from "./use-student-onboarding-state";

test("updateStudentProfileSnapshot updates projected GPA without changing current GPA", () => {
  const document = createEmptyStudentProfileDocument();
  document.current.profile.academic.currentGpa100 = 88;
  document.projected.profile.academic.projectedGpa100 = 90;

  const updated = updateStudentProfileSnapshot(
    document,
    "projected",
    (profile) => ({
      ...profile,
      academic: {
        ...profile.academic,
        projectedGpa100: 96,
      },
    })
  );

  assert.equal(updated.current.profile.academic.currentGpa100, 88);
  assert.equal(updated.projected.profile.academic.projectedGpa100, 96);
  assert.equal(document.projected.profile.academic.projectedGpa100, 90);
});
