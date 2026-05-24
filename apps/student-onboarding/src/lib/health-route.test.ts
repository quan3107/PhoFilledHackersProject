import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "../../app/api/health/route";

test("health endpoint returns service status with an ISO timestamp", async () => {
  const response = await GET();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "student-onboarding");
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});
