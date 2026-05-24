// apps/student-onboarding/app/api/recommendations/runs/route.ts
// Authenticated recommendation-run endpoint for the current student profile.
// Orchestrates session lookup, readiness checks, and deterministic scoring.

import { NextResponse } from "next/server";

import { PublicApiError, jsonApiError } from "@/lib/api-errors";
import { requireApiSession } from "@/lib/api-session";
import { runRecommendationWorkflowForUser } from "@/lib/recommendation-run-workflow";

export const runtime = "nodejs";

export async function POST() {
  const sessionResult = await requireApiSession();

  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  try {
    const workflowResult = await runRecommendationWorkflowForUser(
      sessionResult.userId
    );

    if (!workflowResult.ok) {
      return NextResponse.json(
        {
          error: {
            code: workflowResult.code,
            message: workflowResult.message,
          },
          missingFields: workflowResult.missingFields,
          resolvedWithCaveatFields: workflowResult.resolvedWithCaveatFields,
        },
        { status: 400 }
      );
    }

    const schoolByUniversityId = new Map(
      workflowResult.candidateSchools.map((school) => [
        school.universityId,
        school,
      ])
    );

    return NextResponse.json({
      run: workflowResult.runResult.run,
      results: workflowResult.runResult.results.map((result) => ({
        ...result,
        school: schoolByUniversityId.get(result.universityId) ?? null,
      })),
    });
  } catch (error) {
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
      return jsonApiError(
        new PublicApiError(
          "dependency_unavailable",
          "Recommendations backend is not fully provisioned yet. The UI remains available, but recommendation runs are temporarily disabled.",
          503
        )
      );
    }

    return jsonApiError(error);
  }
}
