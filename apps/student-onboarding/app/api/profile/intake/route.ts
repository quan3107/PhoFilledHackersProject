// apps/student-onboarding/app/api/profile/intake/route.ts
// Canonical intake-chat endpoint for the authenticated student workspace.
// Reads the persisted intake transcript; turns are the only canonical write path.

import { getStudentIntakeStateForUser } from "@etest/auth";
import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-session";

export async function GET() {
  const sessionResult = await requireApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const intakeState = await getStudentIntakeStateForUser(sessionResult.userId);
  return NextResponse.json(intakeState);
}

export async function PUT() {
  return NextResponse.json(
    {
      error: {
        code: "invalid_request",
        message: "Intake state is updated by submitting intake turns.",
      },
    },
    { status: 405 }
  );
}
