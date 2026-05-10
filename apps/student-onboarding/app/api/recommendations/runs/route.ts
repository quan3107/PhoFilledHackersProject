// apps/student-onboarding/app/api/recommendations/runs/route.ts
// Authenticated recommendation-run endpoint for the current student profile.
// Orchestrates session lookup, readiness checks, and deterministic scoring.

import {
  evaluateRecommendationRunReadinessFromState,
  getAuthDb,
  getStudentIntakeStateForUser,
  getStudentProfileStateForUser,
} from "@etest/auth";
import {
  RecommendationEngineInputError,
  listRecommendationCandidateSchools,
  runRecommendationEngineForUser,
} from "@etest/catalog";
import { NextResponse } from "next/server";

import { getOptionalServerSession } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function POST() {
  const session = await getOptionalServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [authDb, profileState, intakeState] = await Promise.all([
    getAuthDb(),
    getStudentProfileStateForUser(session.user.id),
    getStudentIntakeStateForUser(session.user.id),
  ]);
  const readiness = evaluateRecommendationRunReadinessFromState(profileState, {
    fieldStatuses: intakeState?.fieldStatuses,
  });
  const resolvedProfileState = {
    ...profileState,
    missingFields: readiness.missingFields,
  };

  try {
    const runResult = await runRecommendationEngineForUser({
      db: authDb,
      userId: session.user.id,
      profileState: resolvedProfileState,
    });
    const candidateSchools = await listRecommendationCandidateSchools(authDb);
    const schoolByUniversityId = new Map(
      candidateSchools.map((school) => [school.universityId, school])
    );

    return NextResponse.json({
      run: runResult.run,
      results: runResult.results.map((result) => ({
        ...result,
        school: schoolByUniversityId.get(result.universityId) ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof RecommendationEngineInputError) {
      return NextResponse.json(
        {
          error: error.message,
          missingFields: error.missingFields,
          resolvedWithCaveatFields: readiness.resolvedWithCaveatFields,
        },
        { status: 400 }
      );
    }

    const databaseError =
      typeof error === "object" && error !== null
        ? {
            code:
              "code" in error && typeof error.code === "string"
                ? error.code
                : null,
            message:
              "message" in error && typeof error.message === "string"
                ? error.message
                : "Recommendation backend is unavailable.",
          }
        : {
            code: null,
            message: "Recommendation backend is unavailable.",
          };

    if (
      databaseError.code === "42703" ||
      databaseError.message.includes("scoring_config_snapshot")
    ) {
      return NextResponse.json(
        {
          error:
            "Recommendations backend is not fully provisioned yet. The UI remains available, but recommendation runs are temporarily disabled.",
        },
        { status: 503 }
      );
    }

    throw error;
  }
}
