// packages/auth/src/index.ts
// Public export surface for the shared Better Auth package.
// Keeps the web app importing one canonical auth instance and helpers.

export { getAuth, getAuthDb, getAuthSecret } from "./auth.js";
export type { StudentLocationPreferenceKind } from "@etest/api-contracts";
export {
  buildStudentProfileDocumentFromState,
  evaluateMissingStudentProfileFields,
  evaluateRecommendationMissingFields,
  evaluateRecommendationRunReadinessFromDocument,
  evaluateRecommendationRunReadinessFromState,
  getDefaultStudentProfileInput,
  getStudentIntakeStateForUser,
  getStudentProfileStateForUser,
  saveStudentIntakeStateForUser,
  saveStudentProfileStateForUser,
  toRecommendationMissingFieldPaths,
  type StudentIntakeMessageInput,
  type StudentIntakeFieldStatusMap,
  type StudentIntakeFieldStatusRecord,
  type StudentIntakeFieldResolutionKind,
  type StudentIntakeExplicitFieldState,
  type StudentIntakeStateInput,
  type StudentIntakeStateRecord,
  type StudentProfileDocument,
  type StudentProfileInput,
  type StudentProfileMissingField,
  type StudentProfileReadinessEvaluation,
  type StudentProfileResolvedField,
  type StudentProfileSnapshotInput,
  type StudentProfileState,
} from "./student-profiles.js";
