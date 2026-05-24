// apps/student-onboarding/app/api/profile/route.ts
// Internal profile persistence endpoint for the authenticated student.
// Reads and writes the canonical student profile plus snapshot assumptions.

import {
  getStudentProfileStateForUser,
  saveStudentProfileStateForUser,
  type StudentProfileInput,
} from "@etest/auth";
import {
  profilePutRequestSchema,
  type ProfilePutRequest,
} from "@etest/api-contracts";
import { NextResponse } from "next/server";
import { PublicApiError, jsonApiError } from "@/lib/api-errors";
import { requireApiSession } from "@/lib/api-session";
import { getRequestId, logApiError } from "@/lib/observability";

function toAuthProfileInput(
  profile: ProfilePutRequest["currentProfile"]
): StudentProfileInput {
  return profile as unknown as StudentProfileInput;
}

export async function GET() {
  const sessionResult = await requireApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const profileState = await getStudentProfileStateForUser(
    sessionResult.userId
  );

  return NextResponse.json(profileState);
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request);
  const sessionResult = await requireApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const body = await request.json().catch(() => null);
  const parsed = profilePutRequestSchema.safeParse(body);

  if (!parsed.success) {
    logApiError(
      {
        requestId,
        operationId: requestId,
        userId: sessionResult.userId,
        publicErrorCode: "invalid_request",
      },
      parsed.error
    );
    return NextResponse.json(
      {
        error: {
          code: "invalid_request",
          message: "Profile payload is invalid.",
        },
      },
      { status: 400 }
    );
  }

  let profileState;
  try {
    profileState = await saveStudentProfileStateForUser({
      userId: sessionResult.userId,
      currentProfile: toAuthProfileInput(parsed.data.currentProfile),
      projectedProfile: toAuthProfileInput(parsed.data.projectedProfile),
      currentAssumptions: parsed.data.currentAssumptions,
      projectedAssumptions: parsed.data.projectedAssumptions,
    });
  } catch (error) {
    return jsonApiError(
      error instanceof PublicApiError
        ? error
        : new PublicApiError(
            "dependency_unavailable",
            "Profile persistence is temporarily unavailable.",
            503
          ),
      {
        requestId,
        operationId: requestId,
        userId: sessionResult.userId,
        internalError: error,
      }
    );
  }

  return NextResponse.json(profileState);
}
