// apps/student-onboarding/app/api/profile/intake/turn/route.ts
// LLM-driven intake turn endpoint for the authenticated student workspace.
// Validates one user turn, updates canonical profile state, and returns the refreshed session payload.

import { NextResponse } from "next/server";

import { getOptionalServerSession } from "@/lib/auth-session";
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
  const session = await getOptionalServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = parseBody((await request.json().catch(() => null)) as unknown);

  try {
    const result = await runIntakeTurn({
      userId: session.user.id,
      locale: body.locale,
      message: body.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to continue the onboarding conversation.",
      },
      { status: 500 }
    );
  }
}
