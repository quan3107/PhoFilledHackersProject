// Home route for the canonical student onboarding app.
import { StudentOnboardingPageShell } from "@/lib/student-onboarding-page-shell";

export default function HomePage() {
  return <StudentOnboardingPageShell initialRoute="chat" />;
}
