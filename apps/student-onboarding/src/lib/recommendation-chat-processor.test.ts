import assert from "node:assert/strict";
import { test } from "node:test";

import {
  runRecommendationChatTurn,
  type RecommendationChatRepository,
} from "./recommendation-chat-processor";

class FakeChatRepo implements RecommendationChatRepository {
  messages: Awaited<ReturnType<RecommendationChatRepository["loadMessages"]>> =
    [];

  async loadOrCreateSession() {
    return { id: "session-1" };
  }

  async appendMessage(input: {
    role: "assistant" | "student";
    text: string;
    now: Date;
  }) {
    this.messages.push({
      id: `message-${this.messages.length + 1}`,
      role: input.role,
      text: input.text,
      createdAt: input.now.toISOString(),
    });
  }

  async loadMessages() {
    return this.messages;
  }
}

test("recommendation chat turn persists canonical student and assistant messages", async () => {
  const repo = new FakeChatRepo();

  const result = await runRecommendationChatTurn(
    {
      userId: "user-1",
      recommendationRunId: "run-1",
      latestMessage: "Can you compare the top schools?",
    },
    {
      chatRepo: repo,
      now: () => new Date("2026-05-24T00:00:00.000Z"),
      async loadContext() {
        return {
          profileState: {
            document: null,
            missingFields: [],
            resolvedWithCaveatFields: [],
          },
          profileDocument: {
            current: { assumptions: [], profile: {} },
            projected: { assumptions: [], profile: {} },
          },
          latestRecommendationRun: null,
        } as never;
      },
      modelClient: {
        async generate(input) {
          const prompt = JSON.parse(input.prompt) as {
            transcript: Array<{ role: string; text: string }>;
          };
          assert.deepEqual(prompt.transcript, [
            {
              role: "student",
              text: "Can you compare the top schools?",
            },
          ]);

          return {
            assistantMessage: "Use the saved recommendation context.",
            suggestedReplies: ["What should I do next?"],
          };
        },
      },
    }
  );

  assert.deepEqual(
    result.messages.map((message) => [message.role, message.text]),
    [
      ["student", "Can you compare the top schools?"],
      ["assistant", "Use the saved recommendation context."],
    ]
  );
  assert.deepEqual(result.suggestedReplies, ["What should I do next?"]);
});

test("recommendation chat turn surfaces persistence failures", async () => {
  await assert.rejects(
    () =>
      runRecommendationChatTurn(
        {
          userId: "user-1",
          recommendationRunId: "run-1",
          latestMessage: "Hello",
        },
        {
          chatRepo: {
            async loadOrCreateSession() {
              throw new Error("database unavailable");
            },
            async appendMessage() {},
            async loadMessages() {
              return [];
            },
          },
          now: () => new Date("2026-05-24T00:00:00.000Z"),
          async loadContext() {
            throw new Error("unused");
          },
          modelClient: {
            async generate() {
              return { assistantMessage: "unused", suggestedReplies: [] };
            },
          },
        }
      ),
    /database unavailable/
  );
});
