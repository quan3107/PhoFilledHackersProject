// apps/student-onboarding/src/components/student-onboarding/student-onboarding-experience.tsx
// Figma-first authenticated student experience for the canonical onboarding app.
// Keeps the Make-derived split-screen flow as the primary UI while syncing supported data to the backend profile document.
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import {
  buildStudentOnboardingSummary,
  cloneStudentProfileDocument,
  normalizeRecommendationData,
  syncProjectedBase,
  type StudentOnboardingRecommendationView,
  type StudentOnboardingRoute,
} from "@/lib/student-onboarding";
import {
  formatLocationPreferences,
  parseLocationPreferences,
} from "@/lib/location-preferences";
import {
  buildStudentProfileDocumentFromState,
  type StudentProfile,
  type StudentProfileDocument,
  type StudentProfileMissingField,
} from "@/lib/student-profile";
import {
  initialProfileDraft,
  requiredProfileFields,
  type Locale,
  type ProfileField,
  type StudentProfileDraft,
  type ThemeMode,
} from "@/lib/onboarding-data";
import { ChatAssistant, type ChatAssistantState } from "./chat-assistant";
import { GlobalHeader } from "./global-header";
import { LiveProfile } from "./live-profile";

const StudentOnboardingProfilePanel = dynamic(
  () =>
    import("./student-onboarding-profile-panel").then((module) => ({
      default: module.StudentOnboardingProfilePanel,
    })),
  { ssr: false }
);

const StudentOnboardingResultsPanel = dynamic(
  () =>
    import("./student-onboarding-results-panel").then((module) => ({
      default: module.StudentOnboardingResultsPanel,
    })),
  { ssr: false }
);

const StudentOnboardingReviewPanel = dynamic(
  () =>
    import("./student-onboarding-review-panel").then((module) => ({
      default: module.StudentOnboardingReviewPanel,
    })),
  { ssr: false }
);

const StudentOnboardingSettingsPanel = dynamic(
  () =>
    import("./student-onboarding-review-panel").then((module) => ({
      default: module.StudentOnboardingSettingsPanel,
    })),
  { ssr: false }
);

type Viewer = Readonly<{ name: string; email: string }>;
type SaveResult = { ok: true } | { ok: false; error: string };
type RunResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: string;
      missingFields?: StudentProfileMissingField[];
    };

type Props = Readonly<{
  viewer: Viewer;
  initialDocument: StudentProfileDocument;
  initialIntakeState?: ChatAssistantState | null;
  initialRoute?: StudentOnboardingRoute;
  onSave?: (payload: {
    name: string;
    document: StudentProfileDocument;
  }) => Promise<SaveResult>;
  onRunRecommendations?: () => Promise<RunResult>;
  onLogout?: () => Promise<void> | void;
}>;

type ChatTurnResponse = {
  intakeState: ChatAssistantState;
  profileState: Parameters<typeof buildStudentProfileDocumentFromState>[0];
};

type RecommendationChatMessage = {
  id: string;
  role: "assistant" | "student";
  text: string;
  createdAt: string;
};

type RecommendationChatTurnResponse = {
  assistantMessage: string;
  suggestedReplies: string[];
};

const emptyDraft = (): StudentProfileDraft => ({ ...initialProfileDraft });

function parseMoneyRange(value: string): number | null {
  const cleaned = value.replaceAll(",", "");
  const matches = Array.from(cleaned.matchAll(/\d+(?:\.\d+)?/g)).map((match) =>
    Number(match[0])
  );

  if (
    !matches.length ||
    matches.some((valuePart) => !Number.isFinite(valuePart))
  ) {
    return null;
  }

  const normalized = matches.map((valuePart) =>
    /\b(k|thousand)\b/i.test(cleaned) ? valuePart * 1000 : valuePart
  );
  const total = normalized.reduce((sum, valuePart) => sum + valuePart, 0);
  return Math.round(total / normalized.length);
}

function parseGpaToHundred(value: string): number | null {
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const raw = Number(match[1]);
  if (!Number.isFinite(raw)) return null;
  return raw <= 5
    ? Math.round(raw * 25)
    : Math.round(raw <= 10 ? raw * 10 : raw);
}

function parseSat(value: string): number | null {
  const match = value.match(/\b(\d{3,4})\b/);
  return match ? Number(match[1]) : null;
}

function parseAct(value: string): number | null {
  const match = value.match(/\b(\d{1,2})\b/);
  return match ? Number(match[1]) : null;
}

function parseEnglishExam(
  value: string
): Pick<StudentProfile["testing"], "englishExamType" | "englishExamScore"> {
  const lower = value.toLowerCase();
  const scoreMatch = value.match(/(\d+(?:\.\d+)?)/);
  const englishExamScore = scoreMatch ? Number(scoreMatch[1]) : null;

  if (lower.includes("ielts")) {
    return { englishExamType: "ielts", englishExamScore };
  }
  if (lower.includes("toefl")) {
    return { englishExamType: "toefl", englishExamScore };
  }
  if (lower.includes("duolingo")) {
    return { englishExamType: "duolingo", englishExamScore };
  }
  if (lower.includes("not") || lower.includes("none")) {
    return { englishExamType: "none", englishExamScore: null };
  }
  return { englishExamType: "unknown", englishExamScore };
}

function draftFromDocument(
  document: StudentProfileDocument,
  viewerName: string
): StudentProfileDraft {
  const current = document.current.profile;
  const satDisplay = current.testing.satTotal
    ? `SAT ${current.testing.satTotal}`
    : "";
  const actDisplay = current.testing.actComposite
    ? `ACT ${current.testing.actComposite}`
    : "";
  const englishDisplay =
    current.testing.englishExamType === "unknown"
      ? ""
      : `${current.testing.englishExamType.toUpperCase()}${
          current.testing.englishExamScore === null
            ? ""
            : ` ${current.testing.englishExamScore}`
        }`;

  return {
    fullName: viewerName,
    grade: "",
    graduationYear: "",
    curriculum:
      current.academic.curriculumStrength === "unknown"
        ? ""
        : current.academic.curriculumStrength.replaceAll("_", " "),
    gpa:
      current.academic.currentGpa100 === null
        ? ""
        : `${(current.academic.currentGpa100 / 25).toFixed(1)}/4.0`,
    ielts: englishDisplay,
    sat: satDisplay || actDisplay,
    intendedMajors: current.preferences.intendedMajors.join(", "),
    extracurriculars: "",
    wantsEarlyRound:
      current.readiness.wantsEarlyRound === null
        ? ""
        : current.readiness.wantsEarlyRound
          ? "Yes - planning early"
          : "No - regular rounds",
    teacherRecommendationsReady:
      current.readiness.hasTeacherRecommendationsReady === null
        ? ""
        : current.readiness.hasTeacherRecommendationsReady
          ? "Yes"
          : "No",
    counselorDocumentsReady:
      current.readiness.hasCounselorDocumentsReady === null
        ? ""
        : current.readiness.hasCounselorDocumentsReady
          ? "Yes"
          : "No",
    essayDraftsStarted:
      current.readiness.hasEssayDraftsStarted === null
        ? ""
        : current.readiness.hasEssayDraftsStarted
          ? "Yes"
          : "No",
    annualBudget:
      current.budget.annualBudgetUsd === null
        ? ""
        : new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          }).format(current.budget.annualBudgetUsd),
    scholarshipNeed:
      current.budget.needsFinancialAid === null
        ? ""
        : current.budget.needsFinancialAid
          ? "Essential - can't attend without it"
          : "Not needed",
    geographyPreferences:
      current.preferences.preferredLocationPreferences.length > 0
        ? formatLocationPreferences({
            preferredStates: current.preferences.preferredStates,
            preferredLocationPreferences:
              current.preferences.preferredLocationPreferences,
          })
        : current.preferences.preferredStates.join(", "),
    campusSize:
      current.preferences.preferredUndergraduateSize === "unknown"
        ? ""
        : current.preferences.preferredUndergraduateSize === "small"
          ? "Small (under 5,000)"
          : current.preferences.preferredUndergraduateSize === "medium"
            ? "Medium (5,000-15,000)"
            : "Large (15,000+)",
  };
}

function applyDraftFieldToDocument(
  document: StudentProfileDocument,
  field: ProfileField,
  value: string
): StudentProfileDocument {
  const next = cloneStudentProfileDocument(document);
  const current = next.current.profile;
  const projected = next.projected.profile;
  const trimmed = value.trim();

  if (field === "curriculum") {
    const lower = trimmed.toLowerCase();
    const curriculumStrength = lower.includes("most")
      ? "most_rigorous"
      : lower.includes("rigorous") ||
          lower.includes("ib") ||
          lower.includes("ap") ||
          lower.includes("a-level")
        ? "rigorous"
        : lower
          ? "baseline"
          : "unknown";
    current.academic.curriculumStrength = curriculumStrength;
  }

  if (field === "gpa") {
    current.academic.currentGpa100 = parseGpaToHundred(trimmed);
  }

  if (field === "ielts") {
    const parsed = parseEnglishExam(trimmed);
    current.testing.englishExamType = parsed.englishExamType;
    current.testing.englishExamScore = parsed.englishExamScore;
  }

  if (field === "sat") {
    const lower = trimmed.toLowerCase();
    current.testing.satTotal = lower.includes("sat")
      ? parseSat(trimmed)
      : current.testing.satTotal;
    current.testing.actComposite = lower.includes("act")
      ? parseAct(trimmed)
      : current.testing.actComposite;
    current.testing.willSubmitTests = trimmed ? true : null;
  }

  if (field === "intendedMajors") {
    current.preferences.intendedMajors = trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (field === "annualBudget") {
    current.budget.annualBudgetUsd = parseMoneyRange(trimmed);
  }

  if (field === "scholarshipNeed") {
    current.budget.needsFinancialAid = trimmed
      ? !trimmed.toLowerCase().includes("not needed")
      : null;
    current.budget.needsMeritAid = trimmed
      ? !trimmed.toLowerCase().includes("not needed")
      : null;
  }

  if (field === "geographyPreferences") {
    const locationPreferences = parseLocationPreferences(trimmed);
    current.preferences.preferredStates = locationPreferences.preferredStates;
    current.preferences.preferredLocationPreferences =
      locationPreferences.preferredLocationPreferences;
  }

  if (field === "campusSize") {
    const lower = trimmed.toLowerCase();
    current.preferences.preferredUndergraduateSize = lower.includes("small")
      ? "small"
      : lower.includes("medium")
        ? "medium"
        : lower.includes("large")
          ? "large"
          : "unknown";
  }

  if (field === "wantsEarlyRound") {
    current.readiness.wantsEarlyRound = trimmed
      ? trimmed.toLowerCase().includes("yes")
      : null;
  }

  if (field === "teacherRecommendationsReady") {
    current.readiness.hasTeacherRecommendationsReady = trimmed
      ? trimmed.toLowerCase() === "yes"
      : null;
  }

  if (field === "counselorDocumentsReady") {
    current.readiness.hasCounselorDocumentsReady = trimmed
      ? trimmed.toLowerCase() === "yes"
      : null;
  }

  if (field === "essayDraftsStarted") {
    current.readiness.hasEssayDraftsStarted = trimmed
      ? trimmed.toLowerCase() === "yes"
      : null;
  }

  projected.academic.projectedGpa100 = current.academic.projectedGpa100;
  syncProjectedBase(next);
  return next;
}

export function StudentOnboardingExperience({
  viewer,
  initialDocument,
  initialIntakeState = null,
  initialRoute = "chat",
  onSave,
  onRunRecommendations,
  onLogout,
}: Props) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [activeRoute, setActiveRoute] =
    useState<StudentOnboardingRoute>(initialRoute);
  const [viewerName, setViewerName] = useState(viewer.name);
  const [draftProfile, setDraftProfile] = useState<StudentProfileDraft>(() =>
    draftFromDocument(initialDocument, viewer.name)
  );
  const [recentlyUpdated, setRecentlyUpdated] = useState<ProfileField | null>(
    null
  );
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(
    requiredProfileFields.length
  );
  const [document, setDocument] = useState(() =>
    cloneStudentProfileDocument(initialDocument)
  );
  const [intakeState, setIntakeState] = useState<ChatAssistantState | null>(
    initialIntakeState
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runningRecommendations, setRunningRecommendations] = useState(false);
  const [recommendationView, setRecommendationView] =
    useState<StudentOnboardingRecommendationView | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const missingFields = useMemo(() => {
    return requiredProfileFields.filter((field) => !draftProfile[field].trim());
  }, [draftProfile]);

  const backendSummary = useMemo(
    () => buildStudentOnboardingSummary(document),
    [document]
  );

  const filledCount = useMemo(
    () =>
      Object.values(draftProfile).filter((value) => value.trim().length > 0)
        .length,
    [draftProfile]
  );
  const totalCount = Object.keys(draftProfile).length;
  const isComplete = missingFields.length === 0;

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  function applyDraftField(field: ProfileField, value: string) {
    setDraftProfile((existing) => ({ ...existing, [field]: value }));
    setDocument((existing) =>
      applyDraftFieldToDocument(existing, field, value)
    );
    setRecentlyUpdated(field);
    setDirty(true);
    setSaveMessage(null);
  }

  function applyCurrentDraftUpdater(
    updater: (profile: StudentProfileDraft) => StudentProfileDraft
  ) {
    setDraftProfile((existing) => {
      const next = updater(existing);
      let mapped = cloneStudentProfileDocument(document);
      (Object.keys(next) as ProfileField[]).forEach((field) => {
        mapped = applyDraftFieldToDocument(mapped, field, next[field]);
      });
      setDocument(mapped);
      return next;
    });
    setDirty(true);
    setSaveMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    const payload = {
      name: viewerName,
      document,
    };

    const saveResult = onSave
      ? await onSave(payload)
      : await defaultSave(payload);

    setSaving(false);
    if (!saveResult.ok) {
      setSaveError(saveResult.error);
      return;
    }

    setDirty(false);
    setSaveMessage("Saved to the canonical profile and snapshot tables.");
  }

  async function handleRunRecommendations() {
    setRunningRecommendations(true);
    setSaveError(null);

    const runResult = onRunRecommendations
      ? await onRunRecommendations()
      : await defaultRunRecommendations();

    setRunningRecommendations(false);
    setActiveRoute("results");

    if (!runResult.ok) {
      setRecommendationView({
        title: "Recommendations unavailable",
        summary: runResult.error,
        items: (runResult.missingFields ?? []).slice(0, 8).map((field) => ({
          label: `${field.snapshotKind} / ${field.path}`,
          value: field.message,
          tone: "warning",
        })),
        rawPreview: JSON.stringify(
          {
            error: runResult.error,
            missingFields: runResult.missingFields ?? [],
          },
          null,
          2
        ),
      });
      return;
    }

    setRecommendationView(normalizeRecommendationData(runResult.data));
  }

  async function handleLogout() {
    if (onLogout) {
      await onLogout();
    } else {
      await authClient.signOut();
    }
    router.replace("/login");
  }

  async function handleChatTurn(message: string | null) {
    const result = await defaultSubmitIntakeTurn(message, locale);
    const nextDocument = buildStudentProfileDocumentFromState(
      result.profileState
    );

    setIntakeState(result.intakeState);
    setDocument(nextDocument);
    setDraftProfile(draftFromDocument(nextDocument, viewerName));
    setDirty(false);
    setSaveError(null);

    return result.intakeState;
  }

  async function handleRecommendationChatTurn(
    message: string | null,
    messages: RecommendationChatMessage[]
  ) {
    return defaultSubmitRecommendationChatTurn(message, messages);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <GlobalHeader
        locale={locale}
        onLocaleChange={setLocale}
        theme={theme}
        onThemeChange={setTheme}
        viewer={{ name: viewerName, email: viewer.email }}
        onLogout={handleLogout}
        onNavigateProfile={() => {
          setActiveRoute("profile");
          router.push("/profile");
        }}
        onNavigateSettings={() => {
          setActiveRoute("settings");
          router.push("/settings");
        }}
      />

      {activeRoute === "chat" ? (
        <>
          <div
            className={`${isMobileViewport ? "hidden" : "flex"} min-h-0 flex-1`}
          >
            <div className="w-[40%] min-w-[360px] border-r border-border">
              {!isMobileViewport ? (
                <ChatAssistant
                  locale={locale}
                  userName={viewerName}
                  initialState={intakeState}
                  onSubmitTurn={handleChatTurn}
                  onProgressChange={(current, total) => {
                    setProgressCurrent(current);
                    setProgressTotal(total);
                  }}
                  onFinished={() => undefined}
                />
              ) : null}
            </div>
            <div className="relative flex-1">
              <LiveProfile
                locale={locale}
                profile={draftProfile}
                recentlyUpdated={recentlyUpdated}
                filledCount={filledCount}
                totalCount={totalCount}
                isComplete={isComplete}
                onGenerate={handleRunRecommendations}
              />
            </div>
          </div>

          <div
            className={`${isMobileViewport ? "flex" : "hidden"} relative min-h-0 flex-1 flex-col`}
          >
            {isMobileViewport ? (
              <ChatAssistant
                locale={locale}
                userName={viewerName}
                initialState={intakeState}
                onSubmitTurn={handleChatTurn}
                onProgressChange={(current, total) => {
                  setProgressCurrent(current);
                  setProgressTotal(total);
                }}
                onFinished={() => undefined}
              />
            ) : null}

            <div className="fixed bottom-5 right-5 z-40 rounded-full bg-primary px-4 py-3 text-xs text-primary-foreground shadow-lg">
              {progressCurrent}/{progressTotal}
            </div>
          </div>
        </>
      ) : null}

      {activeRoute === "profile" ? (
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <StudentOnboardingProfilePanel
              document={{
                current: {
                  profile: draftProfile,
                  assumptions: document.current.assumptions,
                },
                projected: {
                  profile: draftProfile,
                  assumptions: document.projected.assumptions,
                },
              }}
              missingFields={missingFields.map((field) => ({
                snapshotKind: "current" as const,
                path: field,
                message: `${field} is required.`,
              }))}
              onChangeCurrent={applyCurrentDraftUpdater}
              onChangeProjected={applyCurrentDraftUpdater}
              onChangeCurrentAssumptions={(values) =>
                setDocument((existing) => ({
                  ...cloneStudentProfileDocument(existing),
                  current: { ...existing.current, assumptions: values },
                }))
              }
              onChangeProjectedAssumptions={(values) =>
                setDocument((existing) => ({
                  ...cloneStudentProfileDocument(existing),
                  projected: { ...existing.projected, assumptions: values },
                }))
              }
            />
          </div>
        </div>
      ) : null}

      {activeRoute === "results" ? (
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <StudentOnboardingResultsPanel
              recommendationView={
                recommendationView
                  ? {
                      title: recommendationView.title,
                      summary: recommendationView.summary,
                      items: recommendationView.items,
                      rawPreview: recommendationView.rawPreview,
                    }
                  : null
              }
              summary={{
                completion: backendSummary.completion,
                missingCount: backendSummary.missingCount,
                currentMissingCount: backendSummary.currentMissingCount,
                projectedMissingCount: backendSummary.projectedMissingCount,
                currentHighlights: [],
                projectedHighlights: [],
                nextSteps: backendSummary.nextSteps,
              }}
              missingFields={[]}
              runningRecommendations={runningRecommendations}
              onRunRecommendations={handleRunRecommendations}
              onGoToReview={() => setActiveRoute("review")}
              recommendationChatSessionKey={
                recommendationView?.rawPreview ??
                recommendationView?.summary ??
                "recommendation-chat"
              }
              onSubmitRecommendationChatTurn={handleRecommendationChatTurn}
            />
          </div>
        </div>
      ) : null}

      {activeRoute === "review" ? (
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <StudentOnboardingReviewPanel
              summary={{
                completion: backendSummary.completion,
                missingCount: backendSummary.missingCount,
                currentMissingCount: backendSummary.currentMissingCount,
                projectedMissingCount: backendSummary.projectedMissingCount,
                currentHighlights: [],
                projectedHighlights: [],
                nextSteps: backendSummary.nextSteps,
              }}
              missingFields={[]}
              dirty={dirty}
              saving={saving}
              saveMessage={saveMessage}
              saveError={saveError}
              onSave={handleSave}
              onRunRecommendations={handleRunRecommendations}
            />
          </div>
        </div>
      ) : null}

      {activeRoute === "settings" ? (
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <StudentOnboardingSettingsPanel
              viewerName={viewerName}
              viewerEmail={viewer.email}
              onViewerNameChange={setViewerName}
              onLogout={handleLogout}
              onGoToProfile={() => {
                setActiveRoute("profile");
                router.push("/profile");
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

async function defaultSave(payload: {
  name: string;
  document: StudentProfileDocument;
}): Promise<SaveResult> {
  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      currentProfile: payload.document.current.profile,
      projectedProfile: payload.document.projected.profile,
      currentAssumptions: payload.document.current.assumptions,
      projectedAssumptions: payload.document.projected.assumptions,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      error: body?.error ?? "Unable to save the profile draft.",
    };
  }

  if (payload.name.trim()) {
    await authClient.updateUser({ name: payload.name.trim() } as never);
  }

  return { ok: true };
}

async function defaultRunRecommendations(): Promise<RunResult> {
  const response = await fetch("/api/recommendations/runs", { method: "POST" });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    missingFields?: StudentProfileMissingField[];
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      error: body?.error ?? "Unable to run recommendations.",
      missingFields: body?.missingFields,
    };
  }

  return { ok: true, data: body };
}

async function defaultSubmitIntakeTurn(
  message: string | null,
  locale: Locale
): Promise<ChatTurnResponse> {
  const response = await fetch("/api/profile/intake/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, locale }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    intakeState?: ChatAssistantState;
    profileState?: ChatTurnResponse["profileState"];
  } | null;

  if (!response.ok || !body?.intakeState || !body.profileState) {
    throw new Error(
      body?.error ?? "Unable to continue the onboarding conversation."
    );
  }

  return {
    intakeState: body.intakeState,
    profileState: body.profileState,
  };
}

async function defaultSubmitRecommendationChatTurn(
  message: string | null,
  messages: RecommendationChatMessage[]
): Promise<RecommendationChatTurnResponse> {
  const response = await fetch("/api/recommendations/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, messages }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    assistantMessage?: string;
    suggestedReplies?: string[];
  } | null;

  if (!response.ok || typeof body?.assistantMessage !== "string") {
    throw new Error(
      body?.error ?? "Unable to continue the recommendations conversation."
    );
  }

  return {
    assistantMessage: body.assistantMessage,
    suggestedReplies: Array.isArray(body.suggestedReplies)
      ? body.suggestedReplies.filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0
        )
      : [],
  };
}
