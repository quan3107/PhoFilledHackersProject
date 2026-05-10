// apps/student-onboarding/src/lib/intake-turn-processor.ts
// Server-side orchestration for one LLM-driven onboarding intake turn.
// Loads canonical state, calls OpenAI, persists validated updates, and returns the updated session.

import {
  buildStudentProfileDocumentFromState,
  evaluateRecommendationRunReadinessFromDocument,
  getStudentIntakeStateForUser,
  getStudentProfileStateForUser,
  saveStudentIntakeStateForUser,
  saveStudentProfileStateForUser,
  type StudentIntakeFieldStatusMap,
  type StudentIntakeStateRecord,
  type StudentProfileState,
} from "@etest/auth";

import {
  intakeFieldDefinitions,
  intakeFieldDefinitionByPath,
  intakeFieldPaths,
  totalIntakeFieldCount,
  type IntakeFieldPath,
} from "@/lib/intake-fields";
import { parseLocationPreferences } from "@/lib/location-preferences";
import { createIntakeOpenAiClient } from "@/lib/intake-openai";
import { applyIntakeProfilePatches } from "@/lib/intake-profile-patch";

function createMessage(role: "assistant" | "student", text: string) {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    createdAt: new Date().toISOString(),
  };
}

function isResolvedStatus(resolution: string | undefined) {
  return (
    resolution === "filled" ||
    resolution === "unknown" ||
    resolution === "declined"
  );
}

function isKnownFreeTextValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    normalized !== "unknown" &&
    normalized !== "declined"
  );
}

function classifyExplicitFieldIntent(message: string | null) {
  if (!message) {
    return null;
  }

  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (
    normalized.includes("prefer not to answer") ||
    normalized.includes("decline to answer") ||
    normalized.includes("decline") ||
    normalized.includes("rather not say") ||
    normalized.includes("don't want to answer") ||
    normalized.includes("do not want to answer")
  ) {
    return "declined" as const;
  }

  if (
    normalized.includes("i don't know") ||
    normalized.includes("i dont know") ||
    normalized.includes("not sure") ||
    normalized.includes("unsure") ||
    normalized === "unknown"
  ) {
    return "unknown" as const;
  }

  return null;
}

const fieldQuestionHints: Partial<Record<IntakeFieldPath, string[]>> = {
  citizenshipCountry: ["citizenship", "citizen", "country"],
  targetEntryTerm: [
    "target entry term",
    "entry term",
    "fall",
    "spring",
    "term",
  ],
  "academic.currentGpa100": ["current gpa", "gpa", "4.0 scale", "100 scale"],
  "academic.projectedGpa100": ["projected gpa", "future gpa"],
  "academic.curriculumStrength": [
    "curriculum",
    "course rigor",
    "rigor",
    "ib",
    "ap",
    "a-level",
  ],
  "academic.classRankPercent": ["class rank", "percentile", "top"],
  "testing.willSubmitTests": [
    "submit tests",
    "test submission",
    "submit scores",
  ],
  "testing.satTotal": ["sat"],
  "testing.actComposite": ["act"],
  "testing.englishExamType": ["english exam", "ielts", "toefl", "duolingo"],
  "testing.englishExamScore": ["english score", "ielts", "toefl", "duolingo"],
  "preferences.intendedMajors": ["major", "majors", "study"],
  "preferences.preferredStates": ["state", "states"],
  "preferences.preferredLocationPreferences": [
    "location",
    "region",
    "east coast",
    "west coast",
  ],
  "preferences.preferredCampusLocale": [
    "campus locale",
    "urban",
    "suburban",
    "rural",
  ],
  "preferences.preferredSchoolControl": ["public", "private"],
  "preferences.preferredUndergraduateSize": [
    "school size",
    "undergraduate size",
    "small",
    "medium",
    "large",
  ],
  "budget.annualBudgetUsd": ["budget", "annual budget", "usd"],
  "budget.needsFinancialAid": ["financial aid", "need aid"],
  "budget.needsMeritAid": ["merit aid", "scholarship"],
  "budget.budgetFlexibility": ["budget flexibility", "flexibility"],
  "readiness.wantsEarlyRound": [
    "early round",
    "early decision",
    "early action",
  ],
  "readiness.hasTeacherRecommendationsReady": ["teacher recommendation"],
  "readiness.hasCounselorDocumentsReady": ["counselor", "school documents"],
  "readiness.hasEssayDraftsStarted": ["essay", "drafts"],
  "projected.assumptions": [
    "assumption",
    "assumptions",
    "improve",
    "projection",
  ],
};

function findActiveFieldFromTranscript(input: {
  transcript: StudentIntakeStateRecord["messages"];
  outstandingFields: string[];
}) {
  const lastAssistantMessage = [...input.transcript]
    .reverse()
    .find((message) => message.role === "assistant")
    ?.text.toLowerCase();

  if (!lastAssistantMessage) {
    return (input.outstandingFields[0] as IntakeFieldPath | undefined) ?? null;
  }

  let bestMatch: { path: IntakeFieldPath; score: number } | null = null;

  for (const fieldPath of input.outstandingFields as IntakeFieldPath[]) {
    const definition = intakeFieldDefinitionByPath.get(fieldPath);
    if (!definition) {
      continue;
    }

    let score = 0;
    const label = definition.label.toLowerCase();
    if (lastAssistantMessage.includes(label)) {
      score += 3;
    }

    for (const hint of fieldQuestionHints[fieldPath] ?? []) {
      if (lastAssistantMessage.includes(hint.toLowerCase())) {
        score += 2;
      }
    }

    if (score === 0) {
      continue;
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { path: fieldPath, score };
    }
  }

  return (
    bestMatch?.path ??
    (input.outstandingFields[0] as IntakeFieldPath | undefined) ??
    null
  );
}

function isFieldSatisfied(
  document: ReturnType<typeof buildStudentProfileDocumentFromState>,
  path: IntakeFieldPath
) {
  const current = document.current.profile;
  const projected = document.projected.profile;

  switch (path) {
    case "citizenshipCountry":
      return isKnownFreeTextValue(current.citizenshipCountry);
    case "targetEntryTerm":
      return isKnownFreeTextValue(current.targetEntryTerm);
    case "academic.currentGpa100":
      return current.academic.currentGpa100 !== null;
    case "academic.projectedGpa100":
      return projected.academic.projectedGpa100 !== null;
    case "academic.curriculumStrength":
      return current.academic.curriculumStrength !== "unknown";
    case "academic.classRankPercent":
      return current.academic.classRankPercent !== null;
    case "testing.willSubmitTests":
      return current.testing.willSubmitTests !== null;
    case "testing.satTotal":
      return (
        current.testing.willSubmitTests === false ||
        current.testing.satTotal !== null
      );
    case "testing.actComposite":
      return (
        current.testing.willSubmitTests === false ||
        current.testing.actComposite !== null
      );
    case "testing.englishExamType":
      return (
        current.testing.willSubmitTests === false ||
        current.testing.englishExamType !== "unknown"
      );
    case "testing.englishExamScore":
      return (
        current.testing.willSubmitTests === false ||
        current.testing.englishExamType === "none" ||
        current.testing.englishExamScore !== null
      );
    case "preferences.intendedMajors":
      return current.preferences.intendedMajors.length > 0;
    case "preferences.preferredStates":
      return (
        current.preferences.preferredStates.length > 0 ||
        current.preferences.preferredLocationPreferences.length > 0
      );
    case "preferences.preferredLocationPreferences":
      return (
        current.preferences.preferredLocationPreferences.length > 0 ||
        current.preferences.preferredStates.length > 0
      );
    case "preferences.preferredCampusLocale":
      return current.preferences.preferredCampusLocale.length > 0;
    case "preferences.preferredSchoolControl":
      return current.preferences.preferredSchoolControl.length > 0;
    case "preferences.preferredUndergraduateSize":
      return current.preferences.preferredUndergraduateSize !== "unknown";
    case "budget.annualBudgetUsd":
      return current.budget.annualBudgetUsd !== null;
    case "budget.needsFinancialAid":
      return current.budget.needsFinancialAid !== null;
    case "budget.needsMeritAid":
      return current.budget.needsMeritAid !== null;
    case "budget.budgetFlexibility":
      return current.budget.budgetFlexibility !== "unknown";
    case "readiness.wantsEarlyRound":
      return current.readiness.wantsEarlyRound !== null;
    case "readiness.hasTeacherRecommendationsReady":
      return current.readiness.hasTeacherRecommendationsReady !== null;
    case "readiness.hasCounselorDocumentsReady":
      return current.readiness.hasCounselorDocumentsReady !== null;
    case "readiness.hasEssayDraftsStarted":
      return current.readiness.hasEssayDraftsStarted !== null;
    case "projected.assumptions":
      return document.projected.assumptions.length > 0;
    default:
      return false;
  }
}

function computeOutstandingFields(
  document: ReturnType<typeof buildStudentProfileDocumentFromState>,
  fieldStatuses: StudentIntakeFieldStatusMap
) {
  return intakeFieldDefinitions
    .filter((field) => {
      const status = fieldStatuses[field.path];
      if (isResolvedStatus(status?.resolution)) {
        return false;
      }

      return !isFieldSatisfied(document, field.path);
    })
    .sort((left, right) => left.priority - right.priority)
    .map((field) => field.path);
}

function buildPrompt(input: {
  latestUserMessage: string | null;
  locale: "en" | "vi";
  transcript: StudentIntakeStateRecord["messages"];
  document: ReturnType<typeof buildStudentProfileDocumentFromState>;
  fieldStatuses: StudentIntakeFieldStatusMap;
  outstandingFields: string[];
}) {
  return JSON.stringify(
    {
      task: "Continue the student onboarding conversation and extract structured profile updates.",
      rules: [
        "Ask one focused question at a time.",
        "Prefer recommendation-critical fields before lower-priority fields.",
        "If the user clearly says they do not know, mark the relevant field unknown.",
        "If the user clearly refuses, mark the relevant field declined.",
        "Do not ask again for a field already marked unknown or declined unless the user volunteers new information.",
        "Infer safe canonical values when the answer clearly maps to them.",
        "When the user refuses or does not know a meaningful field, briefly explain the impact and benefit of that field.",
        "If the latest user message clearly answers the current field, acknowledge it briefly and move to the next unresolved field instead of asking for confirmation.",
        "Do not restate or reconfirm a value that was just clearly provided unless the answer is genuinely ambiguous.",
        "When a field has been captured or intentionally unresolved, the assistantMessage should end with the next single question, not another confirmation request.",
        "Keep assistantMessage concise: one short acknowledgement, one short impact note only when useful, then one next question.",
      ],
      responseLanguage: input.locale === "vi" ? "Vietnamese" : "English",
      latestUserMessage: input.latestUserMessage,
      transcript: input.transcript.slice(-12),
      currentProfile: input.document.current.profile,
      projectedProfile: input.document.projected.profile,
      projectedAssumptions: input.document.projected.assumptions,
      fieldStatuses: input.fieldStatuses,
      outstandingFields: input.outstandingFields,
      fieldRegistry: intakeFieldDefinitions.map((field) => ({
        path: field.path,
        label: field.label,
        priority: field.priority,
        recommendationCritical: field.recommendationCritical,
        whyItMatters: field.whyItMatters,
        answerHint: field.answerHint,
      })),
    },
    null,
    2
  );
}

function mergeFieldStatuses(input: {
  existing: StudentIntakeFieldStatusMap;
  next: Array<{
    path: string;
    status: "filled" | "unknown" | "declined" | "needs_clarification";
    note: string | null;
  }>;
  sourceMessageId: string | null;
}) {
  const merged: StudentIntakeFieldStatusMap = { ...input.existing };

  for (const resolution of input.next) {
    if (!intakeFieldPaths.includes(resolution.path as IntakeFieldPath)) {
      continue;
    }

    merged[resolution.path] = {
      resolution: resolution.status,
      note: resolution.note,
      sourceMessageId: input.sourceMessageId,
    };
  }

  return merged;
}

function buildExplicitIntentFollowUp(input: {
  resolution: "unknown" | "declined";
  resolvedFieldPath: IntakeFieldPath;
  nextOutstandingFieldPath: IntakeFieldPath | null;
}) {
  const resolvedField = intakeFieldDefinitionByPath.get(
    input.resolvedFieldPath
  );
  const nextField = input.nextOutstandingFieldPath
    ? intakeFieldDefinitionByPath.get(input.nextOutstandingFieldPath)
    : null;
  const resolutionLabel =
    input.resolution === "declined" ? "declined" : "unknown";

  if (!resolvedField) {
    return nextField
      ? `Understood. I'll mark that as ${resolutionLabel}. Next, please share your ${nextField.label.toLowerCase()}. ${nextField.answerHint}`
      : `Understood. I'll mark that as ${resolutionLabel} and continue with the profile using the information you have provided.`;
  }

  if (!nextField) {
    return `Understood. I'll mark ${resolvedField.label.toLowerCase()} as ${resolutionLabel}. We can continue with the rest of your profile based on the information already provided.`;
  }

  return `Understood. I'll mark ${resolvedField.label.toLowerCase()} as ${resolutionLabel}. ${resolvedField.whyItMatters} Next, please share your ${nextField.label.toLowerCase()}. ${nextField.answerHint}`;
}

function formatDeterministicValueSummary(input: {
  fieldPath: IntakeFieldPath;
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
}) {
  const value = getPatchValueForField({
    fieldPath: input.fieldPath,
    currentProfilePatch: input.currentProfilePatch,
    projectedProfilePatch: input.projectedProfilePatch,
    projectedAssumptions: input.projectedAssumptions,
  });

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object") {
    const entries = Object.values(value as Record<string, unknown>).filter(
      (entry) => entry !== null && entry !== undefined && entry !== ""
    );
    return entries.length > 0 ? entries.join(" ") : null;
  }

  return null;
}

function buildDeterministicFilledFollowUp(input: {
  resolvedFieldPath: IntakeFieldPath;
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
  nextOutstandingFieldPath: IntakeFieldPath | null;
}) {
  const resolvedField = intakeFieldDefinitionByPath.get(
    input.resolvedFieldPath
  );
  const nextField = input.nextOutstandingFieldPath
    ? intakeFieldDefinitionByPath.get(input.nextOutstandingFieldPath)
    : null;
  const valueSummary = formatDeterministicValueSummary({
    fieldPath: input.resolvedFieldPath,
    currentProfilePatch: input.currentProfilePatch,
    projectedProfilePatch: input.projectedProfilePatch,
    projectedAssumptions: input.projectedAssumptions,
  });

  if (!resolvedField) {
    return nextField
      ? `Thanks. Next, please share your ${nextField.label.toLowerCase()}. ${nextField.answerHint}`
      : "Thanks. I've recorded that and will continue with the rest of your profile.";
  }

  const acknowledgement = valueSummary
    ? `${resolvedField.label} noted: ${valueSummary}.`
    : `${resolvedField.label} noted.`;

  if (!nextField) {
    return `${acknowledgement} I'll continue with the rest of your profile from here.`;
  }

  return `${acknowledgement} Next, please share your ${nextField.label.toLowerCase()}. ${nextField.answerHint}`;
}

function parseBooleanAnswer(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/^(yes|yep|yeah|true|ready|will|submit|of course)\b/.test(normalized)) {
    return true;
  }

  if (
    /^(no|nope|false|not yet|won't|will not|don't|do not)\b/.test(normalized)
  ) {
    return false;
  }

  return null;
}

function parseTargetEntryTerm(message: string) {
  const match = message.match(/\b(fall|spring|summer|winter)\s+(20\d{2})\b/i);
  return match
    ? `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()} ${match[2]}`
    : null;
}

function parseGpaToHundred(message: string) {
  const match = message.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) {
    return null;
  }

  return raw <= 5
    ? Math.round(raw * 25)
    : Math.round(raw <= 10 ? raw * 10 : raw);
}

function parseMoneyRange(message: string) {
  const cleaned = message.replaceAll(",", "");
  const matches = Array.from(cleaned.matchAll(/\d+(?:\.\d+)?/g)).map((match) =>
    Number(match[0])
  );

  if (!matches.length || matches.some((value) => !Number.isFinite(value))) {
    return null;
  }

  const normalized = matches.map((value) =>
    /\b(k|thousand)\b/i.test(cleaned) ? value * 1000 : value
  );
  return Math.round(
    normalized.reduce((sum, value) => sum + value, 0) / normalized.length
  );
}

function parseCurriculumStrength(message: string) {
  const lower = message.trim().toLowerCase();
  if (!lower) {
    return null;
  }

  if (lower.includes("most rigorous")) {
    return "most_rigorous";
  }

  if (
    lower.includes("rigorous") ||
    lower.includes("ib") ||
    lower.includes("ap") ||
    lower.includes("a-level")
  ) {
    return "rigorous";
  }

  if (
    lower.includes("baseline") ||
    lower.includes("standard") ||
    lower.includes("regular")
  ) {
    return "baseline";
  }

  return null;
}

function parseClassRankPercent(message: string) {
  const topMatch = message.match(/top\s+(\d+(?:\.\d+)?)\s*%/i);
  if (topMatch) {
    return Number(topMatch[1]);
  }

  const plainMatch = message.match(/(\d+(?:\.\d+)?)\s*%/);
  if (plainMatch) {
    return Number(plainMatch[1]);
  }

  return null;
}

function parseSat(message: string) {
  const match = message.match(/\b(\d{3,4})\b/);
  return match ? Number(match[1]) : null;
}

function parseAct(message: string) {
  const match = message.match(/\b(\d{1,2})\b/);
  return match ? Number(match[1]) : null;
}

function parseEnglishExam(message: string) {
  const lower = message.toLowerCase();
  const scoreMatch = message.match(/(\d+(?:\.\d+)?)/);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;

  if (lower.includes("ielts")) {
    return { englishExamType: "ielts", englishExamScore: score };
  }
  if (lower.includes("toefl")) {
    return { englishExamType: "toefl", englishExamScore: score };
  }
  if (lower.includes("duolingo")) {
    return { englishExamType: "duolingo", englishExamScore: score };
  }
  if (lower.includes("none") || lower.includes("no exam")) {
    return { englishExamType: "none", englishExamScore: null };
  }

  return null;
}

function parseIntendedMajors(message: string) {
  const majors = message
    .split(/,|\/|\band\b/gi)
    .map((entry) => entry.trim())
    .filter(Boolean);

  return majors.length > 0 ? majors : null;
}

function parseSchoolControl(message: string) {
  const lower = message.toLowerCase();
  const values = [
    ...(lower.includes("public") ? ["public" as const] : []),
    ...(lower.includes("private") ? ["private_nonprofit" as const] : []),
  ];
  return values.length > 0 ? values : null;
}

function parseCampusLocale(message: string) {
  const lower = message.toLowerCase();
  const values = ["urban", "suburban", "rural"].filter((entry) =>
    lower.includes(entry)
  );
  return values.length > 0 ? values : null;
}

function parsePreferredSize(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("small")) return "small";
  if (lower.includes("medium")) return "medium";
  if (lower.includes("large")) return "large";
  return null;
}

function parseBudgetFlexibility(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("low")) return "low";
  if (lower.includes("medium")) return "medium";
  if (lower.includes("high")) return "high";
  return null;
}

function parseProjectedAssumptions(message: string) {
  const values = message
    .split(/,|\band\b/gi)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return values.length > 0 ? values : null;
}

function parseCitizenshipCountry(message: string) {
  const cleaned = message
    .replace(/^i am (a|an)\s+/i, "")
    .replace(/\bcitizen\b/gi, "")
    .replace(/\bcitizenship\b/gi, "")
    .replace(/\bfrom\b/gi, "")
    .trim();

  if (!cleaned || /\d/.test(cleaned)) {
    return null;
  }

  return cleaned
    .split(/\s+/)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getPatchValueForField(input: {
  fieldPath: IntakeFieldPath;
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
}) {
  if (input.fieldPath === "projected.assumptions") {
    return input.projectedAssumptions;
  }

  const [section, leaf] = input.fieldPath.split(".");
  if (!leaf) {
    return input.currentProfilePatch[input.fieldPath];
  }

  const patchSource =
    section === "academic" ||
    section === "testing" ||
    section === "preferences" ||
    section === "budget" ||
    section === "readiness"
      ? input.currentProfilePatch[section]
      : null;

  return patchSource && typeof patchSource === "object"
    ? (patchSource as Record<string, unknown>)[leaf]
    : undefined;
}

function mergePatchObject(
  base: Record<string, unknown>,
  addition: Record<string, unknown>
) {
  const merged = { ...base };

  for (const [key, value] of Object.entries(addition)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      merged[key] &&
      typeof merged[key] === "object" &&
      !Array.isArray(merged[key])
    ) {
      merged[key] = mergePatchObject(
        merged[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

function inferDeterministicFieldUpdate(input: {
  fieldPath: IntakeFieldPath | null;
  message: string | null;
}) {
  if (!input.fieldPath || !input.message) {
    return null;
  }

  const message = input.message.trim();
  if (!message) {
    return null;
  }

  switch (input.fieldPath) {
    case "citizenshipCountry": {
      const value = parseCitizenshipCountry(message);
      return value
        ? {
            currentProfilePatch: { citizenshipCountry: value },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "targetEntryTerm": {
      const value = parseTargetEntryTerm(message);
      return value
        ? {
            currentProfilePatch: { targetEntryTerm: value },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "academic.currentGpa100": {
      const value = parseGpaToHundred(message);
      return value !== null
        ? {
            currentProfilePatch: { academic: { currentGpa100: value } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "academic.projectedGpa100": {
      const value = parseGpaToHundred(message);
      return value !== null
        ? {
            currentProfilePatch: {},
            projectedProfilePatch: { academic: { projectedGpa100: value } },
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "academic.curriculumStrength": {
      const value = parseCurriculumStrength(message);
      return value
        ? {
            currentProfilePatch: { academic: { curriculumStrength: value } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "academic.classRankPercent": {
      const value = parseClassRankPercent(message);
      return value !== null
        ? {
            currentProfilePatch: { academic: { classRankPercent: value } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "testing.willSubmitTests": {
      const value = parseBooleanAnswer(message);
      return value !== null
        ? {
            currentProfilePatch: { testing: { willSubmitTests: value } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "testing.satTotal": {
      const value = parseSat(message);
      return value !== null
        ? {
            currentProfilePatch: {
              testing: { satTotal: value, willSubmitTests: true },
            },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "testing.actComposite": {
      const value = parseAct(message);
      return value !== null
        ? {
            currentProfilePatch: {
              testing: { actComposite: value, willSubmitTests: true },
            },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "testing.englishExamType":
    case "testing.englishExamScore": {
      const value = parseEnglishExam(message);
      return value
        ? {
            currentProfilePatch: { testing: value },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "preferences.intendedMajors": {
      const values = parseIntendedMajors(message);
      return values
        ? {
            currentProfilePatch: { preferences: { intendedMajors: values } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "preferences.preferredStates":
    case "preferences.preferredLocationPreferences": {
      const values = parseLocationPreferences(message);
      if (
        values.preferredStates.length === 0 &&
        values.preferredLocationPreferences.length === 0
      ) {
        return null;
      }

      return {
        currentProfilePatch: {
          preferences: {
            preferredStates: values.preferredStates,
            preferredLocationPreferences: values.preferredLocationPreferences,
          },
        },
        projectedProfilePatch: {},
        projectedAssumptions: null,
        resolution: "filled" as const,
      };
    }
    case "preferences.preferredCampusLocale": {
      const values = parseCampusLocale(message);
      return values
        ? {
            currentProfilePatch: {
              preferences: { preferredCampusLocale: values },
            },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "preferences.preferredSchoolControl": {
      const values = parseSchoolControl(message);
      return values
        ? {
            currentProfilePatch: {
              preferences: { preferredSchoolControl: values },
            },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "preferences.preferredUndergraduateSize": {
      const value = parsePreferredSize(message);
      return value
        ? {
            currentProfilePatch: {
              preferences: { preferredUndergraduateSize: value },
            },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "budget.annualBudgetUsd": {
      const value = parseMoneyRange(message);
      return value !== null
        ? {
            currentProfilePatch: { budget: { annualBudgetUsd: value } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "budget.needsFinancialAid":
    case "budget.needsMeritAid":
    case "readiness.wantsEarlyRound":
    case "readiness.hasTeacherRecommendationsReady":
    case "readiness.hasCounselorDocumentsReady":
    case "readiness.hasEssayDraftsStarted": {
      const value = parseBooleanAnswer(message);
      if (value === null) {
        return null;
      }

      const section = input.fieldPath.split(".")[0];
      const leaf = input.fieldPath.split(".")[1];
      return {
        currentProfilePatch: { [section]: { [leaf]: value } },
        projectedProfilePatch: {},
        projectedAssumptions: null,
        resolution: "filled" as const,
      };
    }
    case "budget.budgetFlexibility": {
      const value = parseBudgetFlexibility(message);
      return value
        ? {
            currentProfilePatch: { budget: { budgetFlexibility: value } },
            projectedProfilePatch: {},
            projectedAssumptions: null,
            resolution: "filled" as const,
          }
        : null;
    }
    case "projected.assumptions": {
      const values = parseProjectedAssumptions(message);
      return values
        ? {
            currentProfilePatch: {},
            projectedProfilePatch: {},
            projectedAssumptions: values,
            resolution: "filled" as const,
          }
        : null;
    }
    default:
      return null;
  }
}

export async function runIntakeTurn(input: {
  userId: string;
  message: string | null;
  locale: "en" | "vi";
}) {
  const [profileState, existingIntakeState] = await Promise.all([
    getStudentProfileStateForUser(input.userId),
    getStudentIntakeStateForUser(input.userId),
  ]);
  const document = buildStudentProfileDocumentFromState(profileState);
  const userMessage = input.message?.trim() || null;
  const nextUserMessage = userMessage
    ? createMessage("student", userMessage)
    : null;
  const transcript = [
    ...(existingIntakeState?.messages ?? []),
    ...(nextUserMessage ? [nextUserMessage] : []),
  ];
  const currentStatuses = existingIntakeState?.fieldStatuses ?? {};
  const outstandingFields = computeOutstandingFields(document, currentStatuses);
  const activeFieldPath = findActiveFieldFromTranscript({
    transcript,
    outstandingFields,
  });
  const client = createIntakeOpenAiClient();

  const { output, responseId } = await client.generate({
    instructions:
      "You are ETEST Compass, a concise admissions onboarding assistant. Produce only structured JSON that matches the supplied schema. Use null for unknown or declined profile values in patches. Never write placeholder strings like 'unknown', 'declined', or 'prefer not to answer' into free-text profile fields. When the student clearly answered the active field, do not ask them to confirm the same value again; acknowledge it once and ask the next best question.",
    prompt: buildPrompt({
      latestUserMessage: userMessage,
      locale: input.locale,
      transcript,
      document,
      fieldStatuses: currentStatuses,
      outstandingFields,
    }),
  });

  const shouldApplyModelUpdates = userMessage !== null;
  const explicitFieldIntent =
    shouldApplyModelUpdates && activeFieldPath
      ? classifyExplicitFieldIntent(userMessage)
      : null;
  const deterministicFieldUpdate =
    shouldApplyModelUpdates && !explicitFieldIntent
      ? inferDeterministicFieldUpdate({
          fieldPath: activeFieldPath,
          message: userMessage,
        })
      : null;
  const modelCoveredActiveField =
    activeFieldPath !== null &&
    (output.resolutions.some(
      (resolution) => resolution.path === activeFieldPath
    ) ||
      getPatchValueForField({
        fieldPath: activeFieldPath,
        currentProfilePatch: output.currentProfilePatch,
        projectedProfilePatch: output.projectedProfilePatch,
        projectedAssumptions: output.projectedAssumptions,
      }) !== undefined);
  const fallbackResolutions =
    explicitFieldIntent && activeFieldPath
      ? output.resolutions.some(
          (resolution) => resolution.path === activeFieldPath
        )
        ? output.resolutions
        : [
            ...output.resolutions,
            {
              path: activeFieldPath,
              status: explicitFieldIntent,
              note: "Inferred directly from the student's explicit response.",
            },
          ]
      : deterministicFieldUpdate && activeFieldPath && !modelCoveredActiveField
        ? [
            ...output.resolutions,
            {
              path: activeFieldPath,
              status: deterministicFieldUpdate.resolution,
              note: "Inferred deterministically from the student's direct answer.",
            },
          ]
        : output.resolutions;
  const effectiveCurrentProfilePatch =
    deterministicFieldUpdate && activeFieldPath && !modelCoveredActiveField
      ? mergePatchObject(
          output.currentProfilePatch,
          deterministicFieldUpdate.currentProfilePatch
        )
      : output.currentProfilePatch;
  const effectiveProjectedProfilePatch =
    deterministicFieldUpdate && activeFieldPath && !modelCoveredActiveField
      ? mergePatchObject(
          output.projectedProfilePatch,
          deterministicFieldUpdate.projectedProfilePatch
        )
      : output.projectedProfilePatch;
  const effectiveProjectedAssumptions =
    deterministicFieldUpdate &&
    activeFieldPath === "projected.assumptions" &&
    !modelCoveredActiveField
      ? deterministicFieldUpdate.projectedAssumptions
      : output.projectedAssumptions;
  const nextDocument = shouldApplyModelUpdates
    ? applyIntakeProfilePatches({
        document,
        currentProfilePatch: effectiveCurrentProfilePatch,
        projectedProfilePatch: effectiveProjectedProfilePatch,
        projectedAssumptions: effectiveProjectedAssumptions,
      })
    : document;
  const nextFieldStatuses = shouldApplyModelUpdates
    ? mergeFieldStatuses({
        existing: currentStatuses,
        next: fallbackResolutions,
        sourceMessageId: nextUserMessage?.id ?? null,
      })
    : currentStatuses;

  const savedProfileState = shouldApplyModelUpdates
    ? await saveStudentProfileStateForUser({
        userId: input.userId,
        currentProfile: nextDocument.current.profile,
        projectedProfile: nextDocument.projected.profile,
        currentAssumptions: nextDocument.current.assumptions,
        projectedAssumptions: nextDocument.projected.assumptions,
      })
    : profileState;

  const readiness = evaluateRecommendationRunReadinessFromDocument(
    nextDocument,
    {
      fieldStatuses: nextFieldStatuses,
    }
  );
  const nextOutstandingFields = computeOutstandingFields(
    nextDocument,
    nextFieldStatuses
  );
  const resolvedFieldCount =
    totalIntakeFieldCount - nextOutstandingFields.length;
  const assistantText =
    explicitFieldIntent && activeFieldPath
      ? buildExplicitIntentFollowUp({
          resolution: explicitFieldIntent,
          resolvedFieldPath: activeFieldPath,
          nextOutstandingFieldPath:
            (nextOutstandingFields[0] as IntakeFieldPath | undefined) ?? null,
        }).trim()
      : deterministicFieldUpdate && activeFieldPath && !modelCoveredActiveField
        ? buildDeterministicFilledFollowUp({
            resolvedFieldPath: activeFieldPath,
            currentProfilePatch: effectiveCurrentProfilePatch,
            projectedProfilePatch: effectiveProjectedProfilePatch,
            projectedAssumptions: effectiveProjectedAssumptions,
            nextOutstandingFieldPath:
              (nextOutstandingFields[0] as IntakeFieldPath | undefined) ?? null,
          }).trim()
        : output.assistantMessage.trim();
  if (!assistantText) {
    throw new Error(
      "OpenAI intake response did not include an assistant message."
    );
  }

  const assistantMessage = createMessage("assistant", assistantText);
  const savedIntakeState = await saveStudentIntakeStateForUser({
    userId: input.userId,
    currentStepIndex: resolvedFieldCount,
    conversationDone: nextOutstandingFields.length === 0,
    previousResponseId: responseId,
    fieldStatuses: nextFieldStatuses,
    outstandingFields: nextOutstandingFields,
    progressCompletedCount: resolvedFieldCount,
    progressTotalCount: totalIntakeFieldCount,
    messages: [...transcript, assistantMessage],
  });

  const nextProfileState: StudentProfileState = {
    ...savedProfileState,
    missingFields: readiness.missingFields,
  };

  return {
    intakeState: savedIntakeState,
    profileState: nextProfileState,
    resolvedWithCaveatFields: readiness.resolvedWithCaveatFields,
  };
}
