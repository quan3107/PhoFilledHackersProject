import {
  getStudentIntakeStateForUser,
  getStudentProfileStateForUser,
} from "@etest/auth";

import { StudentOnboardingExperience } from "@/components/student-onboarding/student-onboarding-experience";
import { requireServerSession } from "@/lib/auth-session";
import type { StudentOnboardingRoute } from "@/lib/student-onboarding";
import { buildStudentProfileDocumentFromState } from "@/lib/student-profile";

export async function loadStudentOnboardingShell(
  initialRoute: StudentOnboardingRoute
) {
  const session = await requireServerSession();
  const [profileState, intakeState] = await Promise.all([
    getStudentProfileStateForUser(session.user.id),
    getStudentIntakeStateForUser(session.user.id),
  ]);

  return {
    initialRoute,
    viewer: {
      name: session.user.name ?? "Student",
      email: session.user.email ?? "",
    },
    initialDocument: buildStudentProfileDocumentFromState(profileState),
    initialIntakeState: intakeState,
  };
}

export async function StudentOnboardingPageShell({
  initialRoute,
}: Readonly<{
  initialRoute: StudentOnboardingRoute;
}>) {
  const props = await loadStudentOnboardingShell(initialRoute);

  return <StudentOnboardingExperience {...props} />;
}
