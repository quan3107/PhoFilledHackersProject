// apps/student-onboarding/src/components/student-onboarding/student-onboarding-review-panels.tsx
// Results, review, and lightweight settings panes for the onboarding flow.
// Keeps save, recommendation, and session actions visible without adding API calls.

"use client";

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LogOut,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Pill, SectionCard } from "@/components/dashboard/primitives";
import {
  type StudentOnboardingRecommendationView,
  type StudentOnboardingSummary,
} from "@/lib/student-onboarding";
import { type StudentProfileMissingField } from "@/lib/student-profile";

type ResultsPanelProps = Readonly<{
  recommendationView: StudentOnboardingRecommendationView | null;
  summary: StudentOnboardingSummary;
  missingFields: StudentProfileMissingField[];
  runningRecommendations: boolean;
  onRunRecommendations: () => void;
  onGoToReview: () => void;
}>;

type ReviewPanelProps = Readonly<{
  summary: StudentOnboardingSummary;
  missingFields: StudentProfileMissingField[];
  dirty: boolean;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
  onSave: () => void;
  onRunRecommendations: () => void;
}>;

type SettingsPanelProps = Readonly<{
  viewerName: string;
  viewerEmail: string;
  onViewerNameChange: (value: string) => void;
  onLogout?: () => void;
  onGoToProfile: () => void;
}>;

export function StudentOnboardingResultsPanel({
  recommendationView,
  summary,
  missingFields,
  runningRecommendations,
  onRunRecommendations,
  onGoToReview,
}: ResultsPanelProps) {
  const visibleItems = recommendationView?.items ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <SectionCard title="Recommendations" icon={Sparkles}>
        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-border bg-surface-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {recommendationView?.title ?? "No recommendation run yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recommendationView?.summary ??
                    "Run recommendations to populate the shortlist and reasoning surface."}
                </p>
              </div>
              <button
                type="button"
                onClick={onRunRecommendations}
                disabled={runningRecommendations}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${runningRecommendations ? "animate-spin" : ""}`}
                />
                {runningRecommendations ? "Running" : "Run"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ResultStat label="Ready" value={`${summary.completion}%`} />
              <ResultStat
                label="Missing fields"
                value={String(summary.missingCount)}
              />
              <ResultStat
                label="Visible items"
                value={String(visibleItems.length)}
              />
            </div>
          </div>

          {visibleItems.length ? (
            <div className="space-y-3">
              {visibleItems.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1.35rem] border border-border bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {item.value}
                      </p>
                    </div>
                    {item.tone ? (
                      <Pill className={itemToneClass(item.tone)}>
                        {item.tone}
                      </Pill>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-border bg-white/80 p-5 text-sm text-muted-foreground">
              Run recommendations after the backend saves a profile to populate
              the shortlist and reasoning surface.
            </div>
          )}

          {recommendationView?.rawPreview ? (
            <pre className="max-h-[18rem] overflow-auto rounded-[1.35rem] border border-border bg-surface-soft p-4 text-[12px] leading-6 text-muted-foreground">
              {recommendationView.rawPreview}
            </pre>
          ) : null}
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Gate checks" icon={CheckCircle2}>
          <div className="space-y-2">
            {missingFields.slice(0, 7).map((field) => (
              <FieldRow
                key={`${field.snapshotKind}-${field.path}`}
                field={field}
              />
            ))}
            {missingFields.length === 0 ? (
              <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                All tracked onboarding fields are present.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Next actions" icon={ArrowRight}>
          <div className="space-y-3">
            <ActionButton
              label="Review the draft profile"
              description="Check the current and projected snapshots before saving."
              onClick={onGoToReview}
            />
            <ActionButton
              label="Run recommendations"
              description="Generate the shortlist from the current draft."
              onClick={onRunRecommendations}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function StudentOnboardingReviewPanel({
  summary,
  missingFields,
  dirty,
  saving,
  saveMessage,
  saveError,
  onSave,
  onRunRecommendations,
}: ReviewPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="Review and save" icon={Save}>
        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-border bg-surface-soft p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  {dirty ? "Draft has unsaved changes" : "Draft is in sync"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {saveMessage ??
                    "Save once the profile is ready, then move into recommendations."}
                </p>
              </div>
              <Pill
                className={
                  dirty
                    ? "bg-warning text-warning-foreground"
                    : "bg-success/10 text-success"
                }
              >
                {summary.completion}% ready
              </Pill>
            </div>
            {saveError ? (
              <div className="mt-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {saveError}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <ResultStat label="Missing" value={String(summary.missingCount)} />
            <ResultStat
              label="Current gaps"
              value={String(summary.currentMissingCount)}
            />
            <ResultStat
              label="Projected gaps"
              value={String(summary.projectedMissingCount)}
            />
          </div>

          <div className="rounded-[1.35rem] border border-border bg-white p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Critical missing fields
            </p>
            <div className="mt-3 space-y-2">
              {missingFields.slice(0, 6).map((field) => (
                <FieldRow
                  key={`${field.snapshotKind}-${field.path}`}
                  field={field}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={onRunRecommendations}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary"
            >
              <Sparkles className="h-4 w-4" />
              Review recommendations
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Assumptions and notes" icon={AlertTriangle}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This surface reflects the canonical profile, intake, and
              recommendation state owned by the backend.
            </p>
            <p>
              Use the save action to persist the current canonical document
              before generating recommendations.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Readiness summary" icon={CheckCircle2}>
          <div className="space-y-2">
            {summary.nextSteps.length ? (
              summary.nextSteps.map((step) => (
                <FieldRow
                  key={step}
                  field={{
                    snapshotKind: "current",
                    path: "next-step",
                    message: step,
                  }}
                />
              ))
            ) : (
              <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                No blocking gaps are left in the visible onboarding surface.
              </p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function StudentOnboardingSettingsPanel({
  viewerName,
  viewerEmail,
  onViewerNameChange,
  onLogout,
  onGoToProfile,
}: SettingsPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="Settings" icon={Settings2}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name">
              <input
                value={viewerName}
                onChange={(event) => onViewerNameChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary"
              />
            </Field>
            <Field label="Email">
              <input
                value={viewerEmail}
                readOnly
                className="h-11 w-full rounded-xl border border-border bg-muted px-3.5 text-sm text-muted-foreground outline-none"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoCard
              title="Canonical profile"
              description="The backend owns the saved student profile and snapshot records."
            />
            <InfoCard
              title="Intake transcript"
              description="The chat transcript can be restored from the persisted intake session."
            />
            <InfoCard
              title="Recommendation runs"
              description="Recommendation history is owned by the canonical API and catalog tables."
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGoToProfile}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
            >
              <UserRound className="h-4 w-4" />
              Back to profile
            </button>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Session summary" icon={UserRound}>
          <div className="space-y-3">
            <ResultStat label="Authenticated viewer" value="Yes" />
            <ResultStat label="Current workspace" value="Student onboarding" />
            <ResultStat label="Persistence" value="Backend canonical" />
          </div>
        </SectionCard>

        <SectionCard title="Backend-owned notes" icon={AlertTriangle}>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>This pane now documents the backend-backed surfaces only.</p>
            <p>
              This workspace only exposes profile, intake, and recommendation
              surfaces with real backend dependencies.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactNode;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ResultStat({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-2xl border border-border bg-surface-soft p-3">
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[15px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function FieldRow({
  field,
}: Readonly<{
  field: StudentProfileMissingField;
}>) {
  return (
    <div className="rounded-xl border border-border bg-surface-soft px-3 py-2.5">
      <p className="text-[12px] font-medium text-foreground">{field.message}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {field.snapshotKind} / {field.path}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  description,
  onClick,
}: Readonly<{
  label: string;
  description: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-left transition hover:border-primary"
    >
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function InfoCard({
  title,
  description,
}: Readonly<{
  title: string;
  description: string;
}>) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-border bg-surface-soft p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function itemToneClass(
  tone: NonNullable<
    StudentOnboardingSummary["currentHighlights"][number]["tone"]
  >
) {
  if (tone === "success") return "bg-success/10 text-success";
  if (tone === "warning") return "bg-warning text-warning-foreground";
  return "bg-primary/10 text-primary";
}
