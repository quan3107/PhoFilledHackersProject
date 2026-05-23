import {
  evaluateRecommendationRunReadinessFromState,
  getStudentIntakeStateForUser,
  getStudentProfileStateForUser,
} from "@etest/auth";
import { getBackendDb } from "@etest/backend-data";
import {
  RecommendationEngineInputError,
  listRecommendationCandidateSchools,
  runRecommendationEngineForUser,
} from "@etest/catalog";

export async function runRecommendationWorkflowForUser(userId: string) {
  const db = await getBackendDb();
  const [profileState, intakeState] = await Promise.all([
    getStudentProfileStateForUser(userId),
    getStudentIntakeStateForUser(userId),
  ]);
  const readiness = evaluateRecommendationRunReadinessFromState(profileState, {
    fieldStatuses: intakeState?.fieldStatuses,
  });

  try {
    const runResult = await runRecommendationEngineForUser({
      db,
      userId,
      profileState: {
        ...profileState,
        missingFields: readiness.missingFields,
      },
    });
    const candidateSchools = await listRecommendationCandidateSchools(db);

    return {
      ok: true as const,
      runResult,
      candidateSchools,
      resolvedWithCaveatFields: readiness.resolvedWithCaveatFields,
    };
  } catch (error) {
    if (error instanceof RecommendationEngineInputError) {
      return {
        ok: false as const,
        code: "recommendation_not_ready" as const,
        message: error.message,
        missingFields: error.missingFields,
        resolvedWithCaveatFields: readiness.resolvedWithCaveatFields,
      };
    }

    throw error;
  }
}
