// apps/student-onboarding/src/lib/intake-turn-processor.ts
// Server-side orchestration for one LLM-driven onboarding intake turn.
// Loads canonical state, calls OpenAI, persists validated updates, and returns the updated session.

import {
  buildStudentProfileDocumentFromState,
  evaluateRecommendationRunReadinessFromDocument,
  getStudentIntakeStateForUser,
  getStudentProfileStateForUser,
  saveStudentIntakeStateForUser,
  saveStudentIntakeTurnStateForUser,
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

function createMessage(
  role: "assistant" | "student",
  text: string,
  dependencies?: Pick<IntakeTurnDependencies, "now" | "createId">
) {
  return {
    id: dependencies?.createId() ?? crypto.randomUUID(),
    role,
    text,
    createdAt: (dependencies?.now() ?? new Date()).toISOString(),
  };
}

export interface IntakeModelClient {
  generate(input: {
    instructions: string;
    prompt: string;
  }): Promise<{ output: IntakeModelOutput; responseId: string | null }>;
}

export interface ProfileRepository {
  getStudentProfileStateForUser(userId: string): Promise<StudentProfileState>;
}

export interface IntakeRepository {
  getStudentIntakeStateForUser(
    userId: string
  ): Promise<StudentIntakeStateRecord | null>;
  saveStudentIntakeStateForUser(
    input: Parameters<typeof saveStudentIntakeStateForUser>[0]
  ): ReturnType<typeof saveStudentIntakeStateForUser>;
  saveStudentIntakeTurnStateForUser(
    input: Parameters<typeof saveStudentIntakeTurnStateForUser>[0]
  ): ReturnType<typeof saveStudentIntakeTurnStateForUser>;
}

export interface IntakeTurnDependencies {
  modelClient: IntakeModelClient;
  profileRepo: ProfileRepository;
  intakeRepo: IntakeRepository;
  now: () => Date;
  createId: () => string;
}

const defaultProfileRepo: ProfileRepository = {
  getStudentProfileStateForUser,
};

const defaultIntakeRepo: IntakeRepository = {
  getStudentIntakeStateForUser,
  saveStudentIntakeStateForUser,
  saveStudentIntakeTurnStateForUser,
};

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

type StudentProfileDocumentState = ReturnType<
  typeof buildStudentProfileDocumentFromState
>;

const fieldSatisfactionChecks: Record<
  IntakeFieldPath,
  (document: StudentProfileDocumentState) => boolean
> = {
  citizenshipCountry: (document) =>
    isKnownFreeTextValue(document.current.profile.citizenshipCountry),
  targetEntryTerm: (document) =>
    isKnownFreeTextValue(document.current.profile.targetEntryTerm),
  "academic.currentGpa100": (document) =>
    document.current.profile.academic.currentGpa100 !== null,
  "academic.projectedGpa100": (document) =>
    document.projected.profile.academic.projectedGpa100 !== null,
  "academic.curriculumStrength": (document) =>
    document.current.profile.academic.curriculumStrength !== "unknown",
  "academic.classRankPercent": (document) =>
    document.current.profile.academic.classRankPercent !== null,
  "testing.willSubmitTests": (document) =>
    document.current.profile.testing.willSubmitTests !== null,
  "testing.satTotal": (document) =>
    document.current.profile.testing.willSubmitTests === false ||
    document.current.profile.testing.satTotal !== null,
  "testing.actComposite": (document) =>
    document.current.profile.testing.willSubmitTests === false ||
    document.current.profile.testing.actComposite !== null,
  "testing.englishExamType": (document) =>
    document.current.profile.testing.willSubmitTests === false ||
    document.current.profile.testing.englishExamType !== "unknown",
  "testing.englishExamScore": (document) =>
    document.current.profile.testing.willSubmitTests === false ||
    document.current.profile.testing.englishExamType === "none" ||
    document.current.profile.testing.englishExamScore !== null,
  "preferences.intendedMajors": (document) =>
    document.current.profile.preferences.intendedMajors.length > 0,
  "preferences.preferredStates": (document) => hasPreferredLocation(document),
  "preferences.preferredLocationPreferences": (document) =>
    hasPreferredLocation(document),
  "preferences.preferredCampusLocale": (document) =>
    document.current.profile.preferences.preferredCampusLocale.length > 0,
  "preferences.preferredSchoolControl": (document) =>
    document.current.profile.preferences.preferredSchoolControl.length > 0,
  "preferences.preferredUndergraduateSize": (document) =>
    document.current.profile.preferences.preferredUndergraduateSize !==
    "unknown",
  "budget.annualBudgetUsd": (document) =>
    document.current.profile.budget.annualBudgetUsd !== null,
  "budget.needsFinancialAid": (document) =>
    document.current.profile.budget.needsFinancialAid !== null,
  "budget.needsMeritAid": (document) =>
    document.current.profile.budget.needsMeritAid !== null,
  "budget.budgetFlexibility": (document) =>
    document.current.profile.budget.budgetFlexibility !== "unknown",
  "readiness.wantsEarlyRound": (document) =>
    document.current.profile.readiness.wantsEarlyRound !== null,
  "readiness.hasTeacherRecommendationsReady": (document) =>
    document.current.profile.readiness.hasTeacherRecommendationsReady !== null,
  "readiness.hasCounselorDocumentsReady": (document) =>
    document.current.profile.readiness.hasCounselorDocumentsReady !== null,
  "readiness.hasEssayDraftsStarted": (document) =>
    document.current.profile.readiness.hasEssayDraftsStarted !== null,
  "projected.assumptions": (document) =>
    document.projected.assumptions.length > 0,
};

function hasPreferredLocation(document: StudentProfileDocumentState) {
  const current = document.current.profile;

  return (
    current.preferences.preferredStates.length > 0 ||
    current.preferences.preferredLocationPreferences.length > 0
  );
}

function isFieldSatisfied(
  document: StudentProfileDocumentState,
  path: IntakeFieldPath
) {
  return fieldSatisfactionChecks[path]?.(document) ?? false;
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

type DeterministicFieldUpdate = {
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
  resolution: "filled";
};

type DeterministicFieldParser = (
  message: string,
  fieldPath: IntakeFieldPath
) => DeterministicFieldUpdate | null;

function buildDeterministicFieldUpdate(input: {
  currentProfilePatch?: Record<string, unknown>;
  projectedProfilePatch?: Record<string, unknown>;
  projectedAssumptions?: string[] | null;
}): DeterministicFieldUpdate {
  return {
    currentProfilePatch: input.currentProfilePatch ?? {},
    projectedProfilePatch: input.projectedProfilePatch ?? {},
    projectedAssumptions: input.projectedAssumptions ?? null,
    resolution: "filled",
  };
}

function parseRootTextUpdate(
  message: string,
  fieldPath: IntakeFieldPath,
  parser: (message: string) => string | null
) {
  const value = parser(message);
  return value
    ? buildDeterministicFieldUpdate({
        currentProfilePatch: { [fieldPath]: value },
      })
    : null;
}

function parseCurrentSectionUpdate(
  message: string,
  section: string,
  leaf: string,
  parser: (message: string) => unknown
) {
  const value = parser(message);
  return value !== null
    ? buildDeterministicFieldUpdate({
        currentProfilePatch: { [section]: { [leaf]: value } },
      })
    : null;
}

function parseProjectedSectionUpdate(
  message: string,
  section: string,
  leaf: string,
  parser: (message: string) => unknown
) {
  const value = parser(message);
  return value !== null
    ? buildDeterministicFieldUpdate({
        projectedProfilePatch: { [section]: { [leaf]: value } },
      })
    : null;
}

function parseBooleanSectionUpdate(
  message: string,
  fieldPath: IntakeFieldPath
) {
  const value = parseBooleanAnswer(message);
  if (value === null) {
    return null;
  }

  const [section, leaf] = fieldPath.split(".");
  return buildDeterministicFieldUpdate({
    currentProfilePatch: { [section]: { [leaf]: value } },
  });
}

function parseLocationUpdate(message: string) {
  const values = parseLocationPreferences(message);
  if (
    values.preferredStates.length === 0 &&
    values.preferredLocationPreferences.length === 0
  ) {
    return null;
  }

  return buildDeterministicFieldUpdate({
    currentProfilePatch: {
      preferences: {
        preferredStates: values.preferredStates,
        preferredLocationPreferences: values.preferredLocationPreferences,
      },
    },
  });
}

const deterministicFieldParsers: Record<
  IntakeFieldPath,
  DeterministicFieldParser
> = {
  citizenshipCountry: (message, fieldPath) =>
    parseRootTextUpdate(message, fieldPath, parseCitizenshipCountry),
  targetEntryTerm: (message, fieldPath) =>
    parseRootTextUpdate(message, fieldPath, parseTargetEntryTerm),
  "academic.currentGpa100": (message) =>
    parseCurrentSectionUpdate(
      message,
      "academic",
      "currentGpa100",
      parseGpaToHundred
    ),
  "academic.projectedGpa100": (message) =>
    parseProjectedSectionUpdate(
      message,
      "academic",
      "projectedGpa100",
      parseGpaToHundred
    ),
  "academic.curriculumStrength": (message) =>
    parseCurrentSectionUpdate(
      message,
      "academic",
      "curriculumStrength",
      parseCurriculumStrength
    ),
  "academic.classRankPercent": (message) =>
    parseCurrentSectionUpdate(
      message,
      "academic",
      "classRankPercent",
      parseClassRankPercent
    ),
  "testing.willSubmitTests": parseBooleanSectionUpdate,
  "testing.satTotal": (message) => {
    const value = parseSat(message);
    return value !== null
      ? buildDeterministicFieldUpdate({
          currentProfilePatch: {
            testing: { satTotal: value, willSubmitTests: true },
          },
        })
      : null;
  },
  "testing.actComposite": (message) => {
    const value = parseAct(message);
    return value !== null
      ? buildDeterministicFieldUpdate({
          currentProfilePatch: {
            testing: { actComposite: value, willSubmitTests: true },
          },
        })
      : null;
  },
  "testing.englishExamType": (message) => {
    const value = parseEnglishExam(message);
    return value
      ? buildDeterministicFieldUpdate({
          currentProfilePatch: { testing: value },
        })
      : null;
  },
  "testing.englishExamScore": (message) => {
    const value = parseEnglishExam(message);
    return value
      ? buildDeterministicFieldUpdate({
          currentProfilePatch: { testing: value },
        })
      : null;
  },
  "preferences.intendedMajors": (message) =>
    parseCurrentSectionUpdate(
      message,
      "preferences",
      "intendedMajors",
      parseIntendedMajors
    ),
  "preferences.preferredStates": parseLocationUpdate,
  "preferences.preferredLocationPreferences": parseLocationUpdate,
  "preferences.preferredCampusLocale": (message) =>
    parseCurrentSectionUpdate(
      message,
      "preferences",
      "preferredCampusLocale",
      parseCampusLocale
    ),
  "preferences.preferredSchoolControl": (message) =>
    parseCurrentSectionUpdate(
      message,
      "preferences",
      "preferredSchoolControl",
      parseSchoolControl
    ),
  "preferences.preferredUndergraduateSize": (message) =>
    parseCurrentSectionUpdate(
      message,
      "preferences",
      "preferredUndergraduateSize",
      parsePreferredSize
    ),
  "budget.annualBudgetUsd": (message) =>
    parseCurrentSectionUpdate(
      message,
      "budget",
      "annualBudgetUsd",
      parseMoneyRange
    ),
  "budget.needsFinancialAid": parseBooleanSectionUpdate,
  "budget.needsMeritAid": parseBooleanSectionUpdate,
  "budget.budgetFlexibility": (message) =>
    parseCurrentSectionUpdate(
      message,
      "budget",
      "budgetFlexibility",
      parseBudgetFlexibility
    ),
  "readiness.wantsEarlyRound": parseBooleanSectionUpdate,
  "readiness.hasTeacherRecommendationsReady": parseBooleanSectionUpdate,
  "readiness.hasCounselorDocumentsReady": parseBooleanSectionUpdate,
  "readiness.hasEssayDraftsStarted": parseBooleanSectionUpdate,
  "projected.assumptions": (message) => {
    const values = parseProjectedAssumptions(message);
    return values
      ? buildDeterministicFieldUpdate({ projectedAssumptions: values })
      : null;
  },
};

function inferDeterministicFieldUpdate(input: {
  fieldPath: IntakeFieldPath | null;
  message: string | null;
}) {
  const message = input.message?.trim();
  if (!input.fieldPath || !message) {
    return null;
  }

  return (
    deterministicFieldParsers[input.fieldPath]?.(message, input.fieldPath) ??
    null
  );
}

type IntakeModelOutput = {
  assistantMessage: string;
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
  resolutions: Array<{
    path: string;
    status: "filled" | "unknown" | "declined" | "needs_clarification";
    note: string | null;
  }>;
};

function modelCoveredField(input: {
  activeFieldPath: IntakeFieldPath | null;
  output: IntakeModelOutput;
}) {
  if (!input.activeFieldPath) {
    return false;
  }

  return (
    input.output.resolutions.some(
      (resolution) => resolution.path === input.activeFieldPath
    ) ||
    getPatchValueForField({
      fieldPath: input.activeFieldPath,
      currentProfilePatch: input.output.currentProfilePatch,
      projectedProfilePatch: input.output.projectedProfilePatch,
      projectedAssumptions: input.output.projectedAssumptions,
    }) !== undefined
  );
}

function appendResolutionIfMissing(input: {
  output: IntakeModelOutput;
  activeFieldPath: IntakeFieldPath;
  status: "filled" | "unknown" | "declined";
  note: string;
}) {
  const hasResolution = input.output.resolutions.some(
    (resolution) => resolution.path === input.activeFieldPath
  );

  return hasResolution
    ? input.output.resolutions
    : [
        ...input.output.resolutions,
        {
          path: input.activeFieldPath,
          status: input.status,
          note: input.note,
        },
      ];
}

function buildEffectiveTurnUpdates(input: {
  output: IntakeModelOutput;
  activeFieldPath: IntakeFieldPath | null;
  explicitFieldIntent: "unknown" | "declined" | null;
  deterministicFieldUpdate: DeterministicFieldUpdate | null;
}) {
  const modelCoveredActiveField = modelCoveredField({
    activeFieldPath: input.activeFieldPath,
    output: input.output,
  });
  const effectiveCurrentProfilePatch = input.output.currentProfilePatch;
  const effectiveProjectedProfilePatch = input.output.projectedProfilePatch;
  const effectiveProjectedAssumptions = input.output.projectedAssumptions;

  if (
    input.deterministicFieldUpdate &&
    input.activeFieldPath &&
    !modelCoveredActiveField
  ) {
    const deterministicFieldUpdate = input.deterministicFieldUpdate;
    return {
      modelCoveredActiveField,
      fallbackResolutions: buildFallbackResolutions({
        ...input,
        shouldApplyDeterministicUpdate: true,
      }),
      effectiveCurrentProfilePatch: mergePatchObject(
        effectiveCurrentProfilePatch,
        deterministicFieldUpdate.currentProfilePatch
      ),
      effectiveProjectedProfilePatch: mergePatchObject(
        effectiveProjectedProfilePatch,
        deterministicFieldUpdate.projectedProfilePatch
      ),
      effectiveProjectedAssumptions:
        input.activeFieldPath === "projected.assumptions"
          ? deterministicFieldUpdate.projectedAssumptions
          : effectiveProjectedAssumptions,
    };
  }

  return {
    modelCoveredActiveField,
    fallbackResolutions: buildFallbackResolutions({
      ...input,
      shouldApplyDeterministicUpdate: false,
    }),
    effectiveCurrentProfilePatch,
    effectiveProjectedProfilePatch,
    effectiveProjectedAssumptions,
  };
}

function buildFallbackResolutions(input: {
  output: IntakeModelOutput;
  activeFieldPath: IntakeFieldPath | null;
  explicitFieldIntent: "unknown" | "declined" | null;
  deterministicFieldUpdate: DeterministicFieldUpdate | null;
  shouldApplyDeterministicUpdate: boolean;
}) {
  if (input.explicitFieldIntent && input.activeFieldPath) {
    return appendResolutionIfMissing({
      output: input.output,
      activeFieldPath: input.activeFieldPath,
      status: input.explicitFieldIntent,
      note: "Inferred directly from the student's explicit response.",
    });
  }

  if (
    input.shouldApplyDeterministicUpdate &&
    input.activeFieldPath &&
    input.deterministicFieldUpdate
  ) {
    return appendResolutionIfMissing({
      output: input.output,
      activeFieldPath: input.activeFieldPath,
      status: input.deterministicFieldUpdate.resolution,
      note: "Inferred deterministically from the student's direct answer.",
    });
  }

  return input.output.resolutions;
}

function buildAssistantText(input: {
  output: IntakeModelOutput;
  activeFieldPath: IntakeFieldPath | null;
  explicitFieldIntent: "unknown" | "declined" | null;
  deterministicFieldUpdate: DeterministicFieldUpdate | null;
  modelCoveredActiveField: boolean;
  effectiveCurrentProfilePatch: Record<string, unknown>;
  effectiveProjectedProfilePatch: Record<string, unknown>;
  effectiveProjectedAssumptions: string[] | null;
  nextOutstandingFields: string[];
}) {
  const nextOutstandingFieldPath =
    (input.nextOutstandingFields[0] as IntakeFieldPath | undefined) ?? null;

  if (input.explicitFieldIntent && input.activeFieldPath) {
    return buildExplicitIntentFollowUp({
      resolution: input.explicitFieldIntent,
      resolvedFieldPath: input.activeFieldPath,
      nextOutstandingFieldPath,
    }).trim();
  }

  if (
    input.deterministicFieldUpdate &&
    input.activeFieldPath &&
    !input.modelCoveredActiveField
  ) {
    return buildDeterministicFilledFollowUp({
      resolvedFieldPath: input.activeFieldPath,
      currentProfilePatch: input.effectiveCurrentProfilePatch,
      projectedProfilePatch: input.effectiveProjectedProfilePatch,
      projectedAssumptions: input.effectiveProjectedAssumptions,
      nextOutstandingFieldPath,
    }).trim();
  }

  return input.output.assistantMessage.trim();
}

async function persistTurnState(input: {
  userId: string;
  shouldApplyModelUpdates: boolean;
  profileState: StudentProfileState;
  nextDocument: ReturnType<typeof buildStudentProfileDocumentFromState>;
  intakeState: Parameters<typeof saveStudentIntakeStateForUser>[0];
  intakeRepo: IntakeRepository;
}) {
  if (!input.shouldApplyModelUpdates) {
    return {
      profileState: input.profileState,
      intakeState: await input.intakeRepo.saveStudentIntakeStateForUser(
        input.intakeState
      ),
    };
  }

  return input.intakeRepo.saveStudentIntakeTurnStateForUser({
    userId: input.userId,
    currentProfile: input.nextDocument.current.profile,
    projectedProfile: input.nextDocument.projected.profile,
    currentAssumptions: input.nextDocument.current.assumptions,
    projectedAssumptions: input.nextDocument.projected.assumptions,
    intakeState: input.intakeState,
  });
}

// eslint-disable-next-line complexity
export async function runIntakeTurn(
  input: {
    userId: string;
    message: string | null;
    locale: "en" | "vi";
  },
  dependencies?: Partial<IntakeTurnDependencies>
) {
  const profileRepo = dependencies?.profileRepo ?? defaultProfileRepo;
  const intakeRepo = dependencies?.intakeRepo ?? defaultIntakeRepo;
  const turnDependencies = {
    now: dependencies?.now ?? (() => new Date()),
    createId: dependencies?.createId ?? (() => crypto.randomUUID()),
  };
  const [profileState, existingIntakeState] = await Promise.all([
    profileRepo.getStudentProfileStateForUser(input.userId),
    intakeRepo.getStudentIntakeStateForUser(input.userId),
  ]);
  const document = buildStudentProfileDocumentFromState(profileState);
  const userMessage = input.message?.trim() || null;
  const nextUserMessage = userMessage
    ? createMessage("student", userMessage, turnDependencies)
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
  const client = dependencies?.modelClient ?? createIntakeOpenAiClient();

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
  const effectiveUpdates = buildEffectiveTurnUpdates({
    output,
    activeFieldPath,
    explicitFieldIntent,
    deterministicFieldUpdate,
  });
  const nextDocument = shouldApplyModelUpdates
    ? applyIntakeProfilePatches({
        document,
        currentProfilePatch: effectiveUpdates.effectiveCurrentProfilePatch,
        projectedProfilePatch: effectiveUpdates.effectiveProjectedProfilePatch,
        projectedAssumptions: effectiveUpdates.effectiveProjectedAssumptions,
      })
    : document;
  const nextFieldStatuses = shouldApplyModelUpdates
    ? mergeFieldStatuses({
        existing: currentStatuses,
        next: effectiveUpdates.fallbackResolutions,
        sourceMessageId: nextUserMessage?.id ?? null,
      })
    : currentStatuses;

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
  const assistantText = buildAssistantText({
    output,
    activeFieldPath,
    explicitFieldIntent,
    deterministicFieldUpdate,
    modelCoveredActiveField: effectiveUpdates.modelCoveredActiveField,
    effectiveCurrentProfilePatch: effectiveUpdates.effectiveCurrentProfilePatch,
    effectiveProjectedProfilePatch:
      effectiveUpdates.effectiveProjectedProfilePatch,
    effectiveProjectedAssumptions:
      effectiveUpdates.effectiveProjectedAssumptions,
    nextOutstandingFields,
  });
  if (!assistantText) {
    throw new Error(
      "OpenAI intake response did not include an assistant message."
    );
  }

  const assistantMessage = createMessage(
    "assistant",
    assistantText,
    turnDependencies
  );
  const intakeStateInput = {
    userId: input.userId,
    currentStepIndex: resolvedFieldCount,
    conversationDone: nextOutstandingFields.length === 0,
    previousResponseId: responseId,
    fieldStatuses: nextFieldStatuses,
    outstandingFields: nextOutstandingFields,
    progressCompletedCount: resolvedFieldCount,
    progressTotalCount: totalIntakeFieldCount,
    messages: [...transcript, assistantMessage],
  };
  const savedTurnState = await persistTurnState({
    userId: input.userId,
    shouldApplyModelUpdates,
    profileState,
    nextDocument,
    intakeState: intakeStateInput,
    intakeRepo,
  });

  const nextProfileState: StudentProfileState = {
    ...savedTurnState.profileState,
    missingFields: readiness.missingFields,
  };

  return {
    intakeState: savedTurnState.intakeState,
    profileState: nextProfileState,
    resolvedWithCaveatFields: readiness.resolvedWithCaveatFields,
  };
}
