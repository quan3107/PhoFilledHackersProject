import assert from "node:assert/strict";
import { test } from "node:test";

import { createRecommendationChatOpenAiClient } from "./recommendation-chat-openai";

const okOpenAiBody = (text: string) => ({
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text }],
    },
  ],
});

test("recommendation chat client rejects malformed model output", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  const client = createRecommendationChatOpenAiClient(async () => {
    return new Response(
      JSON.stringify(
        okOpenAiBody(
          JSON.stringify({ assistantMessage: "", suggestedReplies: [] })
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

test("recommendation chat client retries transient provider failures", async () => {
  process.env.OPENAI_API_KEY = "test-key";
  let calls = 0;
  const client = createRecommendationChatOpenAiClient(async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ error: { message: "busy" } }), {
        status: 429,
      });
    }

    return new Response(
      JSON.stringify(
        okOpenAiBody(
          JSON.stringify({
            assistantMessage: "Here is a grounded answer.",
            suggestedReplies: ["Compare my top two"],
          })
        )
      ),
      { status: 200 }
    );
  });

  const result = await client.generate({
    instructions: "test",
    prompt: "test",
  });

  assert.equal(calls, 2);
  assert.equal(result.assistantMessage, "Here is a grounded answer.");
});
