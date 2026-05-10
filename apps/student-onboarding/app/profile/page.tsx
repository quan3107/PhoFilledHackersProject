// apps/student-onboarding/app/profile/page.tsx
// Profile route for the authenticated student onboarding flow.
// Uses the same canonical profile snapshot as the home route.

import { getStudentProfileStateForUser } from "@etest/auth";
import { requireAuthSession } from "@/lib/auth-session";
import { buildStudentProfileDocumentFromState } from "@/lib/student-profile";
import { StudentOnboardingExperience } from "@/components/student-onboarding/student-onboarding-experience";

export default async function ProfilePage() {
  const session = await requireAuthSession();
  const initialState = await getStudentProfileStateForUser(session.user.id);
  const initialDocument = buildStudentProfileDocumentFromState(initialState);

  return (
    <StudentOnboardingExperience
      viewer={{
        name: session.user.name || "Student",
        email: session.user.email,
      }}
      initialDocument={initialDocument}
      initialRoute="profile"
    />
  );
}
