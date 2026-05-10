// Local document model for the student onboarding experience.
// Keeps the component layer self-contained without introducing new app lib files.

import {
  initialProfileDraft,
  requiredProfileFields,
  type ProfileField,
  type StudentProfileDraft,
} from "@/lib/onboarding-data";

export type Locale = "en" | "vi";
export type ThemeMode = "light" | "dark" | "system";
export type StudentOnboardingRoute =
  | "chat"
  | "profile"
  | "results"
  | "review"
  | "settings";

export interface Viewer {
  name: string;
  email: string;
}

export interface StudentOnboardingSnapshot {
  profile: StudentProfileDraft;
  assumptions: string[];
}

export interface StudentOnboardingDocument {
  current: StudentOnboardingSnapshot;
  projected: StudentOnboardingSnapshot;
}

export interface StudentOnboardingSummaryItem {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "success";
}

export interface StudentOnboardingSummary {
  completion: number;
  missingCount: number;
  currentMissingCount: number;
  projectedMissingCount: number;
  currentHighlights: StudentOnboardingSummaryItem[];
  projectedHighlights: StudentOnboardingSummaryItem[];
  nextSteps: string[];
}

export interface StudentOnboardingRecommendationView {
  title: string;
  summary: string;
  items: StudentOnboardingSummaryItem[];
  rawPreview: string;
}

export interface StudentOnboardingMissingField {
  snapshotKind: "current" | "projected";
  path: string;
  message: string;
}

export const cloneProfile = (
  profile: StudentProfileDraft
): StudentProfileDraft => ({
  ...profile,
});

export const cloneDocument = (
  document: StudentOnboardingDocument
): StudentOnboardingDocument => ({
  current: {
    profile: cloneProfile(document.current.profile),
    assumptions: [...document.current.assumptions],
  },
  projected: {
    profile: cloneProfile(document.projected.profile),
    assumptions: [...document.projected.assumptions],
  },
});

export const createEmptyDocument = (
  viewerName = ""
): StudentOnboardingDocument => ({
  current: {
    profile: { ...initialProfileDraft, fullName: viewerName },
    assumptions: [],
  },
  projected: {
    profile: { ...initialProfileDraft, fullName: viewerName },
    assumptions: [],
  },
});

export const syncProjectedBase = (document: StudentOnboardingDocument) => {
  document.projected.profile = {
    ...cloneProfile(document.current.profile),
    fullName:
      document.projected.profile.fullName || document.current.profile.fullName,
  };
};

const fieldLabel: Record<ProfileField, string> = {
  fullName: "Student Name",
  grade: "Grade Level",
  graduationYear: "Graduation Year",
  curriculum: "Curriculum",
  gpa: "GPA",
  ielts: "IELTS/TOEFL",
  sat: "SAT/ACT",
  intendedMajors: "Intended Major(s)",
  extracurriculars: "Extracurriculars",
  wantsEarlyRound: "Wants Early Round",
  teacherRecommendationsReady: "Has Teacher Recommendations Ready",
  counselorDocumentsReady: "Has Counselor Documents Ready",
  essayDraftsStarted: "Has Essay Drafts Started",
  annualBudget: "Annual Budget",
  scholarshipNeed: "Scholarship Need",
  geographyPreferences: "Location Preference",
  campusSize: "Campus Size",
};

const isMissing = (value: string) => value.trim().length === 0;

export const getMissingFields = (
  snapshot: StudentOnboardingSnapshot,
  snapshotKind: "current" | "projected"
) => {
  const missing: StudentOnboardingMissingField[] = [];

  requiredProfileFields.forEach((field) => {
    if (isMissing(snapshot.profile[field])) {
      missing.push({
        snapshotKind,
        path: field,
        message: `${fieldLabel[field]} is required.`,
      });
    }
  });

  if (snapshotKind === "projected" && snapshot.assumptions.length === 0) {
    missing.push({
      snapshotKind,
      path: "assumptions",
      message: "Add at least one projected-state assumption.",
    });
  }

  return missing;
};

export const buildSummary = (
  document: StudentOnboardingDocument
): StudentOnboardingSummary => {
  const currentMissing = getMissingFields(document.current, "current");
  const projectedMissing = getMissingFields(document.projected, "projected");
  const totalChecks = requiredProfileFields.length;
  const filled = requiredProfileFields.filter(
    (field) => !isMissing(document.current.profile[field])
  ).length;
  const completion = Math.round((filled / totalChecks) * 100);

  return {
    completion,
    missingCount: currentMissing.length + projectedMissing.length,
    currentMissingCount: currentMissing.length,
    projectedMissingCount: projectedMissing.length,
    currentHighlights: [
      { label: "Name", value: document.current.profile.fullName || "Not set" },
      {
        label: "Major",
        value: document.current.profile.intendedMajors || "Not set",
      },
      {
        label: "Budget",
        value: document.current.profile.annualBudget || "Not set",
      },
    ],
    projectedHighlights: [
      {
        label: "Projected GPA",
        value: document.projected.profile.gpa || "Not set",
      },
      {
        label: "Location",
        value: document.projected.profile.geographyPreferences || "Not set",
      },
      {
        label: "Readiness",
        value: document.projected.profile.essayDraftsStarted || "Not set",
      },
    ],
    nextSteps: currentMissing.slice(0, 4).map((field) => field.message),
  };
};

const normalize = (value: string) => value.trim().replace(/\s+/g, " ");

export const applyChatPrompt = (
  prompt: string,
  document: StudentOnboardingDocument,
  viewerName: string
) => {
  const next = cloneDocument(document);
  const lower = prompt.toLowerCase();
  const changes: string[] = [];
  let nextViewerName = viewerName;

  const updateCurrentAndProjected = (
    key: keyof StudentProfileDraft,
    value: string
  ) => {
    next.current.profile[key] = value;
    next.projected.profile[key] = value;
  };

  const nameMatch = prompt.match(
    /\b(?:my name is|i am|i'm|call me)\s+([A-Za-z][A-Za-z.'\-]*(?:\s+[A-Za-z][A-Za-z.'\-]*)*)/i
  );
  if (nameMatch?.[1]) {
    nextViewerName = normalize(nameMatch[1]);
    updateCurrentAndProjected("fullName", nextViewerName);
    changes.push(`Updated the display name to ${nextViewerName}.`);
  }

  const gradeMatch = prompt.match(/\bgrade\s*(9|10|11|12|\d{1,2})\b/i);
  if (gradeMatch?.[1]) {
    const grade = `Grade ${gradeMatch[1]}`;
    updateCurrentAndProjected("grade", grade);
    changes.push(`Set grade level to ${grade}.`);
  }

  const yearMatch = prompt.match(/\b(202[6-9])\b/);
  if (yearMatch?.[1]) {
    updateCurrentAndProjected("graduationYear", yearMatch[1]);
    changes.push(`Set graduation year to ${yearMatch[1]}.`);
  }

  const majorMatch = prompt.match(
    /\b(?:major(?:ing)? in|majors?:|interested in)\s+([^.;\n]+)/i
  );
  if (majorMatch?.[1]) {
    const major = normalize(majorMatch[1]);
    updateCurrentAndProjected("intendedMajors", major);
    changes.push(`Updated intended majors to ${major}.`);
  }

  const budgetMatch = prompt.match(/\$?\s*([0-9][0-9,]*)(?:\s*(k|thousand))?/i);
  if (budgetMatch?.[1]) {
    const amount = normalize(budgetMatch[1]).replaceAll(",", "");
    const suffix = budgetMatch[2] ? "k" : "";
    const budget = `$${amount}${suffix}`;
    updateCurrentAndProjected("annualBudget", budget);
    changes.push(`Set annual budget to ${budget}.`);
  }

  if (lower.includes("financial aid") || lower.includes("scholarship")) {
    updateCurrentAndProjected(
      "scholarshipNeed",
      lower.includes("essential")
        ? "Essential - can't attend without it"
        : "Important but not critical"
    );
    changes.push("Updated scholarship preferences.");
  }

  if (lower.includes("essay")) {
    updateCurrentAndProjected(
      "essayDraftsStarted",
      lower.includes("not started") ? "No" : "Yes"
    );
    changes.push("Updated essay readiness.");
  }

  if (lower.includes("recommendation")) {
    updateCurrentAndProjected(
      "teacherRecommendationsReady",
      lower.includes("not yet") ? "No" : "Yes"
    );
    changes.push("Updated recommendation readiness.");
  }

  if (lower.includes("counselor")) {
    updateCurrentAndProjected(
      "counselorDocumentsReady",
      lower.includes("not yet") ? "No" : "Yes"
    );
    changes.push("Updated counselor document readiness.");
  }

  if (lower.includes("early round") || lower.includes("early")) {
    updateCurrentAndProjected(
      "wantsEarlyRound",
      lower.includes("no") ? "No - regular rounds" : "Yes - planning early"
    );
    changes.push("Updated early-round plan.");
  }

  if (lower.includes("east coast")) {
    updateCurrentAndProjected("geographyPreferences", "US - East Coast");
    changes.push("Updated location preference.");
  }

  if (lower.includes("small")) {
    updateCurrentAndProjected("campusSize", "Small (under 5,000)");
    changes.push("Updated campus size preference.");
  }

  syncProjectedBase(next);

  return {
    document: next,
    viewerName: nextViewerName,
    assistantReply:
      changes.length > 0
        ? `Updated ${changes.length} field${changes.length === 1 ? "" : "s"} in your profile.`
        : "I captured that note, but it did not match a tracked field yet.",
    changes,
  };
};
