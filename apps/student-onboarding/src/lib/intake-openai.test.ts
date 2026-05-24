import assert from "node:assert/strict";
import { test } from "node:test";

import { createIntakeOpenAiClient } from "./intake-openai";

const openAiBody = (text: string) => ({
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text }],
    },
  ],
});

test("intake client rejects parseable but invalid model output", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const client = createIntakeOpenAiClient(async () => {
    return new Response(
      JSON.stringify(
        openAiBody(
          JSON.stringify({
            assistantMessage: "",
            currentProfilePatch: {},
            projectedProfilePatch: {},
            projectedAssumptions: [],
            resolutions: [],
          })
        )
      ),
      { status: 200 }
    );
  });

  await assert.rejects(
    () => client.generate({ instructions: "test", prompt: "test" }),
    /model_output_invalid/
  );
});
