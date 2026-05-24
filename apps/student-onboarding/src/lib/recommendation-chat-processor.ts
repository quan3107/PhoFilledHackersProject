// apps/student-onboarding/src/lib/recommendation-chat-processor.ts
// Orchestrates one post-recommendation assistant turn.
// Reads local backend state, builds a bounded prompt, and returns one concise model reply.

import { createRecommendationChatOpenAiClient } from "./recommendation-chat-openai";
import {
  loadRecommendationChatContextForUser,
  type RecommendationChatContext,
} from "./recommendation-chat-context";
import { getBackendDb, type BackendDb } from "@etest/backend-data";
import {
  recommendationChatMessages,
  recommendationChatSessions,
  recommendationRuns,
} from "@etest/db";
import { and, eq, max } from "drizzle-orm";

export interface RecommendationChatTranscriptMessage {
  id?: string;
  role: "assistant" | "student";
  text: string;
  createdAt?: string;
}

export interface RecommendationChatTurnInput {
  userId: string;
  recommendationRunId: string;
  latestMessage: string | null;
}

export interface RecommendationChatTurnResult {
  assistantMessage: string;
  suggestedReplies: string[];
  messages: RecommendationChatTranscriptMessage[];
}

export interface RecommendationChatModelClient {
  generate(input: {
    instructions: string;
    prompt: string;
  }): Promise<{ assistantMessage: string; suggestedReplies: string[] }>;
}

export interface RecommendationChatRepository {
  loadOrCreateSession(input: {
    userId: string;
    recommendationRunId: string;
    now: Date;
  }): Promise<{ id: string }>;
  appendMessage(input: {
    sessionId: string;
    role: "assistant" | "student";
    text: string;
    now: Date;
  }): Promise<void>;
  loadMessages(
    sessionId: string
  ): Promise<RecommendationChatTranscriptMessage[]>;
}

export interface RecommendationChatDependencies {
  modelClient: RecommendationChatModelClient;
  chatRepo: RecommendationChatRepository;
  loadContext: typeof loadRecommendationChatContextForUser;
  now: () => Date;
}

class DbRecommendationChatRepository implements RecommendationChatRepository {
  constructor(private readonly db: BackendDb) {}

  async loadOrCreateSession(input: {
    userId: string;
    recommendationRunId: string;
    now: Date;
  }) {
    const ownedRun = await this.db.query.recommendationRuns.findFirst({
      where: and(
        eq(recommendationRuns.id, input.recommendationRunId),
        eq(recommendationRuns.userId, input.userId),
        eq(recommendationRuns.runStatus, "succeeded")
      ),
      columns: { id: true },
    });

    if (!ownedRun) {
      throw new Error("Recommendation run was not found for this user.");
    }

    const existing = await this.db.query.recommendationChatSessions.findFirst({
      where: eq(
        recommendationChatSessions.recommendationRunId,
        input.recommendationRunId
      ),
      columns: { id: true },
    });

    if (existing) {
      return existing;
    }

    const [created] = await this.db
      .insert(recommendationChatSessions)
      .values({
        userId: input.userId,
        recommendationRunId: input.recommendationRunId,
        createdAt: input.now,
        updatedAt: input.now,
      })
      .returning({ id: recommendationChatSessions.id });

    return created;
  }

  async appendMessage(input: {
    sessionId: string;
    role: "assistant" | "student";
    text: string;
    now: Date;
  }) {
    const [rankRow] = await this.db
      .select({ maxRank: max(recommendationChatMessages.rankOrder) })
      .from(recommendationChatMessages)
      .where(
        eq(
          recommendationChatMessages.recommendationChatSessionId,
          input.sessionId
        )
      );
    const rankOrder = (rankRow?.maxRank ?? 0) + 1;

    await this.db.insert(recommendationChatMessages).values({
      recommendationChatSessionId: input.sessionId,
      role: input.role,
      text: input.text,
      rankOrder,
      createdAt: input.now,
    });

    await this.db
      .update(recommendationChatSessions)
      .set({ updatedAt: input.now })
      .where(eq(recommendationChatSessions.id, input.sessionId));
  }

  async loadMessages(sessionId: string) {
    const rows = await this.db.query.recommendationChatMessages.findMany({
      where: eq(
        recommendationChatMessages.recommendationChatSessionId,
        sessionId
      ),
      orderBy: (table, { asc }) => [asc(table.rankOrder)],
    });

    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.text,
      createdAt: row.createdAt.toISOString(),
    }));
  }
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
  input: RecommendationChatTurnInput,
  dependencies?: Partial<RecommendationChatDependencies>
): Promise<RecommendationChatTurnResult> {
  const chatRepo =
    dependencies?.chatRepo ??
    new DbRecommendationChatRepository(await getBackendDb());
  const now = dependencies?.now ?? (() => new Date());
  const client =
    dependencies?.modelClient ?? createRecommendationChatOpenAiClient();
  const loadContext =
    dependencies?.loadContext ?? loadRecommendationChatContextForUser;
  const session = await chatRepo.loadOrCreateSession({
    userId: input.userId,
    recommendationRunId: input.recommendationRunId,
    now: now(),
  });

  const latestMessage = input.latestMessage?.trim() || null;
  if (latestMessage) {
    await chatRepo.appendMessage({
      sessionId: session.id,
      role: "student",
      text: latestMessage,
      now: now(),
    });
  }

  const transcript = normalizeTranscript(
    await chatRepo.loadMessages(session.id)
  );
  const context = await loadContext({
    userId: input.userId,
    recommendationRunId: input.recommendationRunId,
    latestMessage,
    transcript,
  });
  const modelOutput = await client.generate({
    instructions: recommendationChatSystemPrompt,
    prompt: buildRecommendationChatPrompt({
      context,
      transcript,
      latestMessage,
    }),
  });
  const assistantMessage = normalizeAssistantMessage(
    modelOutput.assistantMessage
  );
  await chatRepo.appendMessage({
    sessionId: session.id,
    role: "assistant",
    text: assistantMessage,
    now: now(),
  });

  return {
    assistantMessage,
    suggestedReplies: normalizeSuggestedReplies(modelOutput.suggestedReplies),
    messages: await chatRepo.loadMessages(session.id),
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
  transcript: RecommendationChatTranscriptMessage[]
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
  return cleaned.slice(-12);
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
