// apps/student-onboarding/app/api/profile/intake/route.ts
// Canonical intake-chat endpoint for the authenticated student workspace.
// Reads and writes the persisted intake transcript so the backend owns chat state.

import {
  getStudentIntakeStateForUser,
  saveStudentIntakeStateForUser,
  type StudentIntakeFieldStatusMap,
  type StudentIntakeMessageInput,
} from "@etest/auth";
import { NextResponse } from "next/server";

import { getOptionalServerSession } from "@/lib/auth-session";

type IntakeRoutePayload = {
  currentStepIndex: number;
  conversationDone: boolean;
  messages: StudentIntakeMessageInput[];
  previousResponseId?: string | null;
  fieldStatuses?: StudentIntakeFieldStatusMap;
  outstandingFields?: string[];
  progressCompletedCount?: number;
  progressTotalCount?: number;
};

function isIntakePayload(value: unknown): value is IntakeRoutePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.currentStepIndex === "number" &&
    typeof record.conversationDone === "boolean" &&
    Array.isArray(record.messages)
  );
}

export async function GET() {
  const session = await getOptionalServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const intakeState = await getStudentIntakeStateForUser(session.user.id);
  return NextResponse.json(intakeState);
}

export async function PUT(request: Request) {
  const session = await getOptionalServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isIntakePayload(body)) {
    return NextResponse.json(
      { error: "Invalid intake payload." },
      { status: 400 }
    );
  }

  const intakeState = await saveStudentIntakeStateForUser({
    userId: session.user.id,
    currentStepIndex: body.currentStepIndex,
    conversationDone: body.conversationDone,
    previousResponseId: body.previousResponseId,
    fieldStatuses: body.fieldStatuses,
    outstandingFields: body.outstandingFields,
    progressCompletedCount: body.progressCompletedCount,
    progressTotalCount: body.progressTotalCount,
    messages: body.messages,
  });

  return NextResponse.json(intakeState);
}
