// Entry wrapper for the standalone student onboarding app.
// Keeps the route import stable while delegating to the new Figma-aligned experience.
"use client";

import { StudentOnboardingExperience } from "./student-onboarding-experience";
import { createEmptyStudentProfileDocument } from "@/lib/student-profile";

export function StudentOnboardingApp() {
  return (
    <StudentOnboardingExperience
      viewer={{ name: "Student", email: "" }}
      initialDocument={createEmptyStudentProfileDocument()}
      initialIntakeState={{
        conversationDone: false,
        progressCompletedCount: 0,
        progressTotalCount: 26,
        messages: [
          {
            id: "qa-smoke-welcome",
            role: "assistant",
            text: "Welcome to the QA smoke route.",
            createdAt: new Date(0).toISOString(),
          },
        ],
      }}
    />
  );
}
