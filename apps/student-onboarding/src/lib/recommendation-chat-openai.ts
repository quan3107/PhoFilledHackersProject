// apps/student-onboarding/src/lib/recommendation-chat-openai.ts
// OpenAI wrapper for the post-recommendation assistant.
// Keeps the response shape strict and scoped to one assistant reply plus optional suggestions.

import {
  recommendationChatModelOutputSchema,
  type RecommendationChatModelOutput,
} from "@etest/api-contracts";

export type { RecommendationChatModelOutput };

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

const providerTimeoutMs = 30_000;
const retryableStatuses = new Set([429, 500, 502, 503, 504]);

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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRetryableNetworkError(error: unknown) {
  return error instanceof TypeError || isAbortError(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), providerTimeoutMs);

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit
) {
  const backoffs = [150, 400];
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= backoffs.length; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetchImpl, url, init);
      if (
        !retryableStatuses.has(response.status) ||
        attempt === backoffs.length
      ) {
        return response;
      }
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt === backoffs.length) {
        throw error;
      }
      lastError = error;
    }

    await sleep(backoffs[attempt]);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Recommendation chat request failed.");
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
      const response = await fetchWithRetry(
        fetchImpl,
        "https://api.openai.com/v1/responses",
        {
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
        }
      );

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

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new Error(
          "model_output_invalid: Recommendation chat output was not valid JSON."
        );
      }

      const parsed = recommendationChatModelOutputSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new Error(
          "model_output_invalid: Recommendation chat output failed validation."
        );
      }

      return parsed.data;
    },
  };
}
