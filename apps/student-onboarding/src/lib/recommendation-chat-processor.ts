// apps/student-onboarding/src/lib/recommendation-chat-processor.ts
// Orchestrates one post-recommendation assistant turn.
// Reads local backend state, builds a bounded prompt, and returns one concise model reply.

import { createRecommendationChatOpenAiClient } from "./recommendation-chat-openai";
import {
  loadRecommendationChatContextForUser,
  type RecommendationChatContext,
} from "./recommendation-chat-context";

export interface RecommendationChatTranscriptMessage {
  role: "assistant" | "student";
  text: string;
}

export interface RecommendationChatTurnInput {
  userId: string;
  latestMessage: string | null;
  transcript: RecommendationChatTranscriptMessage[];
}

export interface RecommendationChatTurnResult {
  assistantMessage: string;
  suggestedReplies: string[];
}

const recommendationChatSystemPrompt = [
  "You are the post-recommendation assistant for the ETEST student onboarding app.",
  "Use only the provided backend context: the student's saved profile state, the latest successful recommendation run, and the saved university records inside that context.",
  "Do not use outside knowledge, web browsing, or unstated assumptions.",
  "If there is no user message yet, welcome the student, mention one or two top schools if available, explain what you can help with, and end with one clear question.",
  "Keep the answer concise and practical. Prefer short paragraphs or 1-4 short bullets.",
  "When asked about a school, use only schools present in the provided recommendation context.",
  "When asked about ETEST, profile, testing, budget, deadlines, or admissions fit, answer from the saved profile and school data only.",
  "If the context is insufficient, say so plainly and suggest the next local action.",
  "Do not invent rankings, policies, deadlines, scores, or costs.",
  "Return exactly one answer plus 0-3 short suggested replies.",
].join(" ");

export async function runRecommendationChatTurn(
  input: RecommendationChatTurnInput
): Promise<RecommendationChatTurnResult> {
  const transcript = normalizeTranscript(input.transcript, input.latestMessage);
  const context = await loadRecommendationChatContextForUser({
    userId: input.userId,
    latestMessage: input.latestMessage,
    transcript,
  });
  const client = createRecommendationChatOpenAiClient();
  const modelOutput = await client.generate({
    instructions: recommendationChatSystemPrompt,
    prompt: buildRecommendationChatPrompt({
      context,
      transcript,
      latestMessage: input.latestMessage,
    }),
  });

  return {
    assistantMessage: normalizeAssistantMessage(modelOutput.assistantMessage),
    suggestedReplies: normalizeSuggestedReplies(modelOutput.suggestedReplies),
  };
}

function buildRecommendationChatPrompt(input: {
  context: RecommendationChatContext;
  latestMessage: string | null;
  transcript: RecommendationChatTranscriptMessage[];
}) {
  return JSON.stringify(
    {
      mode: input.latestMessage ? "reply" : "welcome",
      latestUserMessage: input.latestMessage,
      transcript: input.transcript,
      profileState: {
        missingFields: input.context.profileState.missingFields,
        document: input.context.profileDocument,
      },
      latestRecommendationRun: input.context.latestRecommendationRun,
    },
    null,
    2
  );
}

function normalizeTranscript(
  transcript: RecommendationChatTranscriptMessage[],
  latestMessage: string | null
) {
  const cleaned = transcript
    .filter(
      (message) => message.role === "assistant" || message.role === "student"
    )
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
    }))
    .filter((message) => message.text.length > 0);

  const latestText = latestMessage?.trim() ?? "";
  if (!latestText) {
    return cleaned.slice(-12);
  }

  if (
    cleaned.length > 0 &&
    cleaned[cleaned.length - 1].role === "student" &&
    cleaned[cleaned.length - 1].text === latestText
  ) {
    return cleaned.slice(-12);
  }

  return [...cleaned, { role: "student" as const, text: latestText }].slice(
    -12
  );
}

function normalizeAssistantMessage(message: string) {
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Recommendation assistant returned an empty message.");
  }

  return trimmed;
}

function normalizeSuggestedReplies(replies: string[]) {
  return Array.from(
    new Set(
      replies
        .map((reply) => reply.trim())
        .filter(Boolean)
        .slice(0, 3)
    )
  );
}
