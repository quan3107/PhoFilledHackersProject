// apps/student-onboarding/app/api/profile/intake/turn/route.ts
// LLM-driven intake turn endpoint for the authenticated student workspace.
// Validates one user turn, updates canonical profile state, and returns the refreshed session payload.

import { NextResponse } from "next/server";

import { jsonApiError } from "@/lib/api-errors";
import { requireApiSession } from "@/lib/api-session";
import { runIntakeTurn } from "@/lib/intake-turn-processor";

export const runtime = "nodejs";

function parseBody(value: unknown): {
  locale: "en" | "vi";
  message: string | null;
} {
  if (!value || typeof value !== "object") {
    return { locale: "en" as const, message: null };
  }

  const record = value as Record<string, unknown>;
  return {
    locale: record.locale === "vi" ? "vi" : "en",
    message: typeof record.message === "string" ? record.message : null,
  };
}

export async function POST(request: Request) {
  const sessionResult = await requireApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const body = parseBody((await request.json().catch(() => null)) as unknown);

  try {
    const result = await runIntakeTurn({
      userId: sessionResult.userId,
      locale: body.locale,
      message: body.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    return jsonApiError(error);
  }
}
