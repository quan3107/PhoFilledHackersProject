// apps/student-onboarding/app/api/recommendations/chat/route.ts
// Authenticated post-recommendation assistant endpoint.
// Accepts the latest user message and answers from server-owned chat history.

import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/api-errors";
import { requireApiSession } from "@/lib/api-session";
import { runRecommendationChatTurn } from "@/lib/recommendation-chat-processor";

export const runtime = "nodejs";

interface RecommendationChatRequestBody {
  recommendationRunId?: unknown;
  message?: unknown;
}

function parseBody(value: unknown) {
  const record =
    value && typeof value === "object"
      ? (value as RecommendationChatRequestBody)
      : {};

  return {
    recommendationRunId:
      typeof record.recommendationRunId === "string" &&
      record.recommendationRunId.trim()
        ? record.recommendationRunId.trim()
        : null,
    message:
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : null,
  };
}

export async function POST(request: Request) {
  const sessionResult = await requireApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const body = parseBody(await request.json().catch(() => null));
  if (!body.recommendationRunId) {
    return NextResponse.json(
      {
        error: {
          code: "validation_failed",
          message: "recommendationRunId is required.",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await runRecommendationChatTurn({
      userId: sessionResult.userId,
      recommendationRunId: body.recommendationRunId,
      latestMessage: body.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonApiError(error);
  }
}
