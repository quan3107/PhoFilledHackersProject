// Profile route for the authenticated student onboarding flow.
import { StudentOnboardingPageShell } from "@/lib/student-onboarding-page-shell";

export default function ProfilePage() {
  return <StudentOnboardingPageShell initialRoute="profile" />;
}
