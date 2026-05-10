// apps/student-onboarding/app/settings/page.tsx
// Settings route for the authenticated student onboarding flow.
// Reuses the shared client experience with the settings tab selected.
import { getStudentProfileStateForUser } from "@etest/auth";
import { requireAuthSession } from "@/lib/auth-session";
import { buildStudentProfileDocumentFromState } from "@/lib/student-profile";
import { StudentOnboardingExperience } from "@/components/student-onboarding/student-onboarding-experience";

export default async function SettingsPage() {
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
      initialRoute="settings"
    />
  );
}
