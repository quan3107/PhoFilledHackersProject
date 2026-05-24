// Route and panel workspace for the student onboarding experience.
// Owns tab switching and delegates the actual panels to smaller leaf components.
"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

import { GlobalHeader, type Viewer } from "./global-header";
import {
  StudentOnboardingChatPanel,
  StudentOnboardingProfilePanel,
} from "./student-onboarding-panels";
import {
  StudentOnboardingResultsPanel,
  StudentOnboardingReviewPanel,
  StudentOnboardingSettingsPanel,
} from "./student-onboarding-review-panels";
import type {
  StudentOnboardingRecommendationView,
  StudentOnboardingRoute,
  StudentOnboardingSummary,
} from "@/lib/student-onboarding";
import type {
  StudentProfile,
  StudentProfileDocument,
  StudentProfileMissingField,
} from "@/lib/student-profile";
import type { Locale, ThemeMode } from "./student-onboarding-model";

type Props = Readonly<{
  locale: Locale;
  setLocale: (value: Locale) => void;
  theme: ThemeMode;
  setTheme: (value: ThemeMode) => void;
  viewer: Viewer;
  onLogout: () => void;
  initialRoute: StudentOnboardingRoute;
  saving: boolean;
  dirty: boolean;
  saveMessage: string | null;
  saveError: string | null;
  runningRecommendations: boolean;
  recommendationView: StudentOnboardingRecommendationView | null;
  summary: StudentOnboardingSummary;
  missingFields: StudentProfileMissingField[];
  profileDocument: StudentProfileDocument;
  chatMessages: Array<
    Readonly<{ id: string; role: "assistant" | "student"; text: string }>
  >;
  chatDraft: string;
  setChatDraft: (value: string) => void;
  onSendChat: () => void;
  onQuickAction: (value: string) => void;
  onViewerNameChange: (value: string) => void;
  onChangeCurrent: (
    updater: (profile: StudentProfile) => StudentProfile
  ) => void;
  onChangeProjected: (
    updater: (profile: StudentProfile) => StudentProfile
  ) => void;
  onChangeCurrentAssumptions: (value: string[]) => void;
  onChangeProjectedAssumptions: (value: string[]) => void;
  onSave: () => void;
  onRunRecommendations: () => void;
}>;

export function StudentOnboardingWorkspace({
  locale,
  setLocale,
  theme,
  setTheme,
  viewer,
  onLogout,
  initialRoute,
  saving,
  dirty,
  saveMessage,
  saveError,
  runningRecommendations,
  recommendationView,
  summary,
  missingFields,
  profileDocument,
  chatMessages,
  chatDraft,
  setChatDraft,
  onSendChat,
  onQuickAction,
  onViewerNameChange,
  onChangeCurrent,
  onChangeProjected,
  onChangeCurrentAssumptions,
  onChangeProjectedAssumptions,
  onSave,
  onRunRecommendations,
}: Props) {
  const [activeRoute, setActiveRoute] =
    useState<StudentOnboardingRoute>(initialRoute);

  return (
    <div className="flex min-h-screen flex-col">
      <GlobalHeader
        locale={locale}
        onLocaleChange={setLocale}
        theme={theme}
        onThemeChange={setTheme}
        viewer={viewer}
        onLogout={onLogout}
      />

      <div className="border-b border-border bg-card/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "chat", label: "Chat" },
              { key: "profile", label: "Profile" },
              { key: "results", label: "Results" },
              { key: "review", label: "Review" },
              { key: "settings", label: "Settings" },
            ] as Array<{ key: StudentOnboardingRoute; label: string }>
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveRoute(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeRoute === tab.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-white text-muted-foreground hover:border-primary hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
          {saving ? (
            <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs text-muted-foreground">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Saving locally
            </span>
          ) : null}
        </div>
      </div>

      <main className="flex-1 p-4 md:p-6">
        <div className="mx-auto max-w-7xl">
          {activeRoute === "chat" ? (
            <StudentOnboardingChatPanel
              viewerName={viewer.name}
              viewerEmail={viewer.email}
              document={profileDocument}
              summary={summary}
              messages={chatMessages}
              draft={chatDraft}
              missingFields={missingFields}
              onDraftChange={setChatDraft}
              onSend={onSendChat}
              onQuickAction={onQuickAction}
              onViewerNameChange={onViewerNameChange}
            />
          ) : null}

          {activeRoute === "profile" ? (
            <StudentOnboardingProfilePanel
              document={profileDocument}
              missingFields={missingFields}
              onChangeCurrent={onChangeCurrent}
              onChangeProjected={onChangeProjected}
              onChangeCurrentAssumptions={onChangeCurrentAssumptions}
              onChangeProjectedAssumptions={onChangeProjectedAssumptions}
            />
          ) : null}

          {activeRoute === "results" ? (
            <StudentOnboardingResultsPanel
              recommendationView={recommendationView}
              summary={summary}
              missingFields={missingFields}
              runningRecommendations={runningRecommendations}
              onRunRecommendations={onRunRecommendations}
              onGoToReview={() => setActiveRoute("review")}
            />
          ) : null}

          {activeRoute === "review" ? (
            <StudentOnboardingReviewPanel
              summary={summary}
              missingFields={missingFields}
              dirty={dirty}
              saving={saving}
              saveMessage={saveMessage}
              saveError={saveError}
              onSave={onSave}
              onRunRecommendations={onRunRecommendations}
            />
          ) : null}

          {activeRoute === "settings" ? (
            <StudentOnboardingSettingsPanel
              viewerName={viewer.name}
              viewerEmail={viewer.email}
              onViewerNameChange={onViewerNameChange}
              onLogout={onLogout}
              onGoToProfile={() => setActiveRoute("profile")}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
