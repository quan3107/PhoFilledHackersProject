// apps/student-onboarding/src/components/student-onboarding/student-onboarding-experience.tsx
// Figma-first authenticated student experience for the canonical onboarding app.
// Keeps the Make-derived split-screen flow as the primary UI while syncing supported data to the backend profile document.
"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { type StudentOnboardingRoute } from "@/lib/student-onboarding";
import { formatLocationPreferences } from "@/lib/location-preferences";
import {
  buildStudentProfileDocumentFromState,
  type StudentProfileDocument,
} from "@/lib/student-profile";
import {
  requiredProfileFields,
  type Locale,
  type ProfileField,
  type StudentProfileDraft,
  type ThemeMode,
} from "@/lib/onboarding-data";
import {
  useProfilePersistence,
  type SaveProfileHandler,
} from "@/lib/use-profile-persistence";
import {
  useRecommendationRun,
  type RunRecommendationsHandler,
} from "@/lib/use-recommendation-run";
import { useStudentOnboardingState } from "@/lib/use-student-onboarding-state";
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

type Props = Readonly<{
  viewer: Viewer;
  initialDocument: StudentProfileDocument;
  initialIntakeState?: ChatAssistantState | null;
  initialRoute?: StudentOnboardingRoute;
  onSave?: SaveProfileHandler;
  onRunRecommendations?: RunRecommendationsHandler;
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
  const activeRoute = initialRoute;
  const [viewerName, setViewerName] = useState(viewer.name);
  const [recentlyUpdated] = useState<ProfileField | null>(null);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(
    requiredProfileFields.length
  );
  const {
    document,
    dirty,
    missingFields,
    replaceDocument,
    setDirty,
    summary,
    updateSnapshotAssumptions,
    updateSnapshotProfile,
  } = useStudentOnboardingState(initialDocument);
  const [intakeState, setIntakeState] = useState<ChatAssistantState | null>(
    initialIntakeState
  );
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const draftProfile = useMemo(
    () => draftFromDocument(document, viewerName),
    [document, viewerName]
  );

  const {
    handleSave,
    saveError,
    saveMessage,
    saving,
    setSaveError,
    setSaveMessage,
  } = useProfilePersistence({
    document,
    viewerName,
    onSave,
    onSaved: () => setDirty(false),
  });

  const {
    handleRunRecommendations,
    recommendationError,
    recommendationView,
    runningRecommendations,
  } = useRecommendationRun({
    onRunRecommendations,
    onRouteResults: () => router.push("/results"),
  });

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

  function clearPersistenceStatus() {
    setSaveMessage(null);
    setSaveError(null);
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
    setIntakeError(null);

    try {
      const result = await defaultSubmitIntakeTurn(message, locale);
      const nextDocument = buildStudentProfileDocumentFromState(
        result.profileState
      );

      setIntakeState(result.intakeState);
      replaceDocument(nextDocument);
      setDirty(false);
      setSaveError(null);

      return result.intakeState;
    } catch (error) {
      const messageText =
        error instanceof Error
          ? error.message
          : "Unable to continue the onboarding conversation.";
      setIntakeError(messageText);
      throw new Error(messageText);
    }
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
        onNavigateProfile={() => router.push("/profile")}
        onNavigateSettings={() => router.push("/settings")}
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
              {recommendationError ? (
                <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                  {recommendationError}
                </div>
              ) : null}
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
            {intakeError ? (
              <div className="fixed bottom-20 left-5 right-5 z-40 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                {intakeError}
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {activeRoute === "profile" ? (
        <div className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <StudentOnboardingProfilePanel
              document={document}
              missingFields={missingFields}
              onChangeCurrent={(updater) => {
                updateSnapshotProfile("current", updater);
                clearPersistenceStatus();
              }}
              onChangeProjected={(updater) => {
                updateSnapshotProfile("projected", updater);
                clearPersistenceStatus();
              }}
              onChangeCurrentAssumptions={(values) => {
                updateSnapshotAssumptions("current", values);
                clearPersistenceStatus();
              }}
              onChangeProjectedAssumptions={(values) => {
                updateSnapshotAssumptions("projected", values);
                clearPersistenceStatus();
              }}
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
                completion: summary.completion,
                missingCount: summary.missingCount,
                currentMissingCount: summary.currentMissingCount,
                projectedMissingCount: summary.projectedMissingCount,
                currentHighlights: summary.currentHighlights,
                projectedHighlights: summary.projectedHighlights,
                nextSteps: summary.nextSteps,
              }}
              missingFields={missingFields}
              recommendationError={recommendationError}
              runningRecommendations={runningRecommendations}
              onRunRecommendations={handleRunRecommendations}
              onGoToReview={() => router.push("/review")}
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
                completion: summary.completion,
                missingCount: summary.missingCount,
                currentMissingCount: summary.currentMissingCount,
                projectedMissingCount: summary.projectedMissingCount,
                currentHighlights: summary.currentHighlights,
                projectedHighlights: summary.projectedHighlights,
                nextSteps: summary.nextSteps,
              }}
              missingFields={missingFields}
              dirty={dirty}
              saving={saving}
              saveMessage={saveMessage}
              saveError={saveError}
              recommendationError={recommendationError}
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
              onViewerNameChange={(name) => {
                setViewerName(name);
                clearPersistenceStatus();
              }}
              onLogout={handleLogout}
              onGoToProfile={() => router.push("/profile")}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
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
