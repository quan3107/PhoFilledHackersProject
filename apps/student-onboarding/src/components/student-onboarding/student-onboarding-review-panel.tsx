// Review surface for the onboarding experience.
// Keeps save-state and action guidance visible using canonical backend state.
"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Save,
  Sparkles,
  UserRound,
} from "lucide-react";

import { MetricCard, Pill, SectionCard } from "../dashboard/primitives";
import {
  type StudentOnboardingMissingField,
  type StudentOnboardingSummary,
} from "./student-onboarding-model";

type ReviewPanelProps = Readonly<{
  summary: StudentOnboardingSummary;
  missingFields: StudentOnboardingMissingField[];
  dirty: boolean;
  saving: boolean;
  saveMessage: string | null;
  saveError: string | null;
  onSave: () => void;
  onRunRecommendations: () => void;
}>;

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
          <div className="rounded-[1.4rem] border border-border bg-[var(--surface-soft,#f4f7fb)] p-4">
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
                    ? "bg-amber-50 text-amber-700"
                    : "bg-emerald-50 text-emerald-700"
                }
              >
                {summary.completion}% ready
              </Pill>
            </div>
            {saveError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {saveError}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Missing" value={String(summary.missingCount)} />
            <MetricCard
              label="Current gaps"
              value={String(summary.currentMissingCount)}
            />
            <MetricCard
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
                <MissingFieldRow
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
              This review surface reflects the canonical profile snapshots and
              recommendation controls.
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
                <MissingFieldRow
                  key={step}
                  field={{
                    snapshotKind: "current",
                    path: "next-step",
                    message: step,
                  }}
                />
              ))
            ) : (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
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
}: Readonly<{
  viewerName: string;
  viewerEmail: string;
  onViewerNameChange: (value: string) => void;
  onLogout?: () => void;
  onGoToProfile: () => void;
}>) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
      <SectionCard title="Settings" icon={Sparkles}>
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
            <MetricCard label="Authenticated viewer" value="Yes" />
            <MetricCard label="Current workspace" value="Student onboarding" />
            <MetricCard label="Persistence" value="Backend canonical" />
          </div>
        </SectionCard>

        <SectionCard title="Backend-owned surfaces" icon={Sparkles}>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              The visible surfaces here now reflect backend-backed profile,
              intake, and recommendation state.
            </p>
            <div className="rounded-2xl border border-dashed border-border bg-white px-3 py-3 text-sm text-muted-foreground">
              This panel reflects backend-backed profile, intake, and
              recommendation data only.
            </div>
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

function MissingFieldRow({
  field,
}: Readonly<{
  field: StudentOnboardingMissingField;
}>) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-white px-3 py-2.5">
      <div className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{field.message}</p>
        <p className="text-xs text-muted-foreground">
          {field.snapshotKind} / {field.path}
        </p>
      </div>
    </div>
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
    <div className="rounded-2xl border border-border bg-[var(--surface-soft,#f4f7fb)] p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
