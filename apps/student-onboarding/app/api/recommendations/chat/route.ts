// apps/student-onboarding/app/api/recommendations/chat/route.ts
// Authenticated post-recommendation assistant endpoint.
// Accepts the latest user message plus transcript and answers from local backend data only.

import { NextResponse } from "next/server";

import { getOptionalServerSession } from "@/lib/auth-session";
import {
  runRecommendationChatTurn,
  type RecommendationChatTranscriptMessage,
} from "@/lib/recommendation-chat-processor";

export const runtime = "nodejs";

interface RecommendationChatRequestBody {
  message?: unknown;
  messages?: unknown;
}

function parseTranscript(
  value: unknown
): RecommendationChatTranscriptMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      if (record.role !== "assistant" && record.role !== "student") {
        return null;
      }

      return {
        role: record.role as "assistant" | "student",
        text: typeof record.text === "string" ? record.text : "",
      };
    })
    .filter((entry): entry is RecommendationChatTranscriptMessage =>
      Boolean(entry)
    );
}

function parseBody(value: unknown) {
  const record =
    value && typeof value === "object"
      ? (value as RecommendationChatRequestBody)
      : {};

  return {
    message:
      typeof record.message === "string" && record.message.trim()
        ? record.message.trim()
        : null,
    messages: parseTranscript(record.messages),
  };
}

export async function POST(request: Request) {
  const session = await getOptionalServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseBody(await request.json().catch(() => null));

  try {
    const result = await runRecommendationChatTurn({
      userId: session.user.id,
      latestMessage: body.message,
      transcript: body.messages,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to answer the recommendation question.",
      },
      { status: 500 }
    );
  }
}
