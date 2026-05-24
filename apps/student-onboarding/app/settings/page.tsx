// Settings route for the authenticated student onboarding flow.
import { StudentOnboardingPageShell } from "@/lib/student-onboarding-page-shell";

export default function SettingsPage() {
  return <StudentOnboardingPageShell initialRoute="settings" />;
}
