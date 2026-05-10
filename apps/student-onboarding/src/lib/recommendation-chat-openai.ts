// apps/student-onboarding/src/lib/recommendation-chat-openai.ts
// OpenAI wrapper for the post-recommendation assistant.
// Keeps the response shape strict and scoped to one assistant reply plus optional suggestions.

export interface RecommendationChatModelOutput {
  assistantMessage: string;
  suggestedReplies: string[];
}

interface OpenAiResponseBody {
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  } | null;
}

const recommendationChatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assistantMessage", "suggestedReplies"],
  properties: {
    assistantMessage: { type: "string" },
    suggestedReplies: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
  },
} as const;

function readOutputText(body: OpenAiResponseBody) {
  for (const item of body.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }

  return null;
}

export function createRecommendationChatOpenAiClient(
  fetchImpl: typeof fetch = fetch
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return {
    async generate(input: {
      instructions: string;
      prompt: string;
    }): Promise<RecommendationChatModelOutput> {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model:
            process.env.RECOMMENDATION_CHAT_OPENAI_MODEL?.trim() ||
            process.env.ONBOARDING_OPENAI_MODEL?.trim() ||
            "gpt-5.4-nano",
          reasoning: {
            effort:
              process.env.RECOMMENDATION_CHAT_OPENAI_REASONING_EFFORT?.trim() ||
              process.env.ONBOARDING_OPENAI_REASONING_EFFORT?.trim() ||
              "medium",
          },
          store: false,
          instructions: input.instructions,
          input: input.prompt,
          text: {
            format: {
              type: "json_schema",
              name: "student_recommendation_chat_turn",
              schema: recommendationChatSchema,
              strict: true,
            },
          },
        }),
      });

      const body = (await response
        .json()
        .catch(() => null)) as OpenAiResponseBody | null;
      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "Recommendation chat request failed."
        );
      }

      const text = body ? readOutputText(body) : null;
      if (!text) {
        throw new Error(
          "Recommendation chat response did not include JSON output text."
        );
      }

      return JSON.parse(text) as RecommendationChatModelOutput;
    },
  };
}
