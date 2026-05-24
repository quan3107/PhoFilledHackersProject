import assert from "node:assert/strict";
import test from "node:test";

import { buildRecommendationFailureView } from "./use-recommendation-run";

test("buildRecommendationFailureView includes missing fields in the recommendation preview", () => {
  const view = buildRecommendationFailureView("Profile is incomplete.", [
    {
      snapshotKind: "projected",
      path: "academic.projectedGpa100",
      message: "Projected GPA is required.",
    },
  ]);

  assert.equal(view.title, "Recommendations unavailable");
  assert.equal(view.summary, "Profile is incomplete.");
  assert.equal(view.items[0]?.label, "projected / academic.projectedGpa100");
  assert.match(view.rawPreview, /Projected GPA is required/);
});
