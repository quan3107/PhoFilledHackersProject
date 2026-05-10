// apps/web/src/components/student-onboarding/student-onboarding-panels.tsx
// Chat intake and manual profile dashboard panes for the onboarding experience.
// Splits the main experience into compact, reusable client-side form surfaces.

"use client";

import { type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MessagesSquare,
  Sparkles,
  UserRound,
} from "lucide-react";

import { Pill, SectionCard } from "@/components/dashboard/primitives";
import { type StudentOnboardingSummary } from "@/lib/student-onboarding";
import {
  budgetFlexibilityOptions,
  curriculumStrengthOptions,
  englishExamTypeOptions,
  joinListValue,
  preferredUndergraduateSizeOptions,
  splitListValue,
  type StudentProfileDocument,
  type StudentProfileMissingField,
  type StudentProfile,
} from "@/lib/student-profile";

type ChatMessage = Readonly<{
  id: string;
  role: "assistant" | "student";
  text: string;
}>;

type ChatPanelProps = Readonly<{
  viewerName: string;
  viewerEmail: string;
  document: StudentProfileDocument;
  summary: StudentOnboardingSummary;
  messages: ChatMessage[];
  draft: string;
  missingFields: StudentProfileMissingField[];
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (value: string) => void;
  onViewerNameChange: (value: string) => void;
}>;

type ProfilePanelProps = Readonly<{
  document: StudentProfileDocument;
  missingFields: StudentProfileMissingField[];
  onChangeCurrent: (
    updater: (profile: StudentProfile) => StudentProfile
  ) => void;
  onChangeProjected: (
    updater: (profile: StudentProfile) => StudentProfile
  ) => void;
  onChangeCurrentAssumptions: (value: string[]) => void;
  onChangeProjectedAssumptions: (value: string[]) => void;
}>;

const quickPrompts = [
  "My name is Alex and I plan for fall 2027.",
  "My current GPA is 3.8 and I want projected GPA 96.",
  "I want to major in computer science, economics.",
  "My budget is $45,000 and I need financial aid.",
  "I will submit SAT scores and teacher recommendations are ready.",
];

export function StudentOnboardingChatPanel({
  viewerName,
  viewerEmail,
  document,
  summary,
  messages,
  draft,
  missingFields,
  onDraftChange,
  onSend,
  onQuickAction,
  onViewerNameChange,
}: ChatPanelProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
      <SectionCard title="Intake chat" icon={MessagesSquare} className="h-full">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <Field label="Display name">
              <input
                value={viewerName}
                onChange={(event) => onViewerNameChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none ring-0 transition focus:border-primary"
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

          <div className="rounded-[1.4rem] border border-border bg-surface-soft p-3">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2.5">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Live intake transcript
                </p>
                <p className="text-xs text-muted-foreground">
                  Use quick prompts or type a request below.
                </p>
              </div>
              <Pill className="bg-primary/10 text-primary">
                {summary.completion}% ready
              </Pill>
            </div>

            <div className="mt-3 max-h-[18rem] space-y-3 overflow-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "student" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === "student"
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-white text-foreground shadow-sm"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                rows={3}
                placeholder="Tell the assistant what to change in your profile."
                className="min-h-[5.5rem] flex-1 resize-none rounded-2xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                type="button"
                onClick={onSend}
                className="inline-flex h-[5.5rem] items-center justify-center rounded-2xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onQuickAction(prompt)}
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:border-primary hover:text-foreground"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryTile
              label="Missing fields"
              value={String(summary.missingCount)}
            />
            <SummaryTile
              label="Current gaps"
              value={String(summary.currentMissingCount)}
            />
            <SummaryTile
              label="Projected gaps"
              value={String(summary.projectedMissingCount)}
            />
          </div>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Live profile" icon={Sparkles}>
          <SummaryList
            title="Current snapshot"
            items={summary.currentHighlights}
          />
          <SummaryList
            title="Projected snapshot"
            items={summary.projectedHighlights}
            className="mt-5"
          />
        </SectionCard>

        <SectionCard title="Missing fields" icon={CheckCircle2}>
          <div className="space-y-2">
            {missingFields.slice(0, 8).map((field) => (
              <MissingFieldRow
                key={`${field.snapshotKind}-${field.path}`}
                field={field}
              />
            ))}
            {missingFields.length > 8 ? (
              <p className="pt-2 text-xs text-muted-foreground">
                {missingFields.length - 8} more fields remain outside the
                current view.
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Snapshot notes" icon={UserRound}>
          <div className="space-y-3">
            <NoteBlock
              title="Current assumptions"
              value={joinListValue(document.current.assumptions) || "Not set"}
            />
            <NoteBlock
              title="Projected assumptions"
              value={joinListValue(document.projected.assumptions) || "Not set"}
            />
            <NoteBlock
              title="School control"
              value={
                joinListValue(
                  document.current.profile.preferences.preferredSchoolControl
                ) || "Not set"
              }
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function StudentOnboardingProfilePanel({
  document,
  missingFields,
  onChangeCurrent,
  onChangeProjected,
  onChangeCurrentAssumptions,
  onChangeProjectedAssumptions,
}: ProfilePanelProps) {
  const current = document.current.profile;
  const projected = document.projected.profile;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
      <SectionCard title="Manual profile dashboard" icon={Sparkles}>
        <div className="space-y-5">
          <ProfileGroup title="Identity">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Citizenship country"
                value={current.citizenshipCountry}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    citizenshipCountry: value,
                  }))
                }
              />
              <TextField
                label="Target entry term"
                value={current.targetEntryTerm}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    targetEntryTerm: value,
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Academic">
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Current GPA"
                value={current.academic.currentGpa100}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    academic: { ...profile.academic, currentGpa100: value },
                  }))
                }
              />
              <ChoiceField
                label="Curriculum strength"
                value={current.academic.curriculumStrength}
                options={curriculumStrengthOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    academic: {
                      ...profile.academic,
                      curriculumStrength: value,
                    },
                  }))
                }
              />
              <NumberField
                label="Class rank %"
                value={current.academic.classRankPercent}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    academic: { ...profile.academic, classRankPercent: value },
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Testing">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceField
                label="Will submit tests"
                value={
                  current.testing.willSubmitTests === null
                    ? ""
                    : current.testing.willSubmitTests
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    testing: {
                      ...profile.testing,
                      willSubmitTests: value === "" ? null : value === "true",
                    },
                  }))
                }
              />
              <ChoiceField
                label="English exam"
                value={current.testing.englishExamType}
                options={englishExamTypeOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    testing: { ...profile.testing, englishExamType: value },
                  }))
                }
              />
              <NumberField
                label="SAT total"
                value={current.testing.satTotal}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    testing: { ...profile.testing, satTotal: value },
                  }))
                }
              />
              <NumberField
                label="ACT composite"
                value={current.testing.actComposite}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    testing: { ...profile.testing, actComposite: value },
                  }))
                }
              />
              <NumberField
                label="English score"
                value={current.testing.englishExamScore}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    testing: { ...profile.testing, englishExamScore: value },
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Preferences">
            <div className="grid gap-3 sm:grid-cols-2">
              <TagsField
                label="Intended majors"
                value={current.preferences.intendedMajors}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      intendedMajors: value,
                    },
                  }))
                }
              />
              <TagsField
                label="Preferred states"
                value={current.preferences.preferredStates}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      preferredStates: value,
                    },
                  }))
                }
              />
              <TagsField
                label="Campus locale"
                value={current.preferences.preferredCampusLocale}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      preferredCampusLocale: value,
                    },
                  }))
                }
              />
              <ChoiceField
                label="School control"
                value={current.preferences.preferredSchoolControl[0] ?? ""}
                options={["", "public", "private_nonprofit"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      preferredSchoolControl: value ? [value] : [],
                    },
                  }))
                }
              />
              <ChoiceField
                label="School size"
                value={current.preferences.preferredUndergraduateSize}
                options={preferredUndergraduateSizeOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    preferences: {
                      ...profile.preferences,
                      preferredUndergraduateSize: value,
                    },
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Budget">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Annual budget USD"
                value={current.budget.annualBudgetUsd}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    budget: { ...profile.budget, annualBudgetUsd: value },
                  }))
                }
              />
              <ChoiceField
                label="Budget flexibility"
                value={current.budget.budgetFlexibility}
                options={budgetFlexibilityOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    budget: { ...profile.budget, budgetFlexibility: value },
                  }))
                }
              />
              <ChoiceField
                label="Needs financial aid"
                value={
                  current.budget.needsFinancialAid === null
                    ? ""
                    : current.budget.needsFinancialAid
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    budget: {
                      ...profile.budget,
                      needsFinancialAid: value === "" ? null : value === "true",
                    },
                  }))
                }
              />
              <ChoiceField
                label="Needs merit aid"
                value={
                  current.budget.needsMeritAid === null
                    ? ""
                    : current.budget.needsMeritAid
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    budget: {
                      ...profile.budget,
                      needsMeritAid: value === "" ? null : value === "true",
                    },
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Readiness">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceField
                label="Wants early round"
                value={
                  current.readiness.wantsEarlyRound === null
                    ? ""
                    : current.readiness.wantsEarlyRound
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    readiness: {
                      ...profile.readiness,
                      wantsEarlyRound: value === "" ? null : value === "true",
                    },
                  }))
                }
              />
              <ChoiceField
                label="Has teacher recommendations ready"
                value={
                  current.readiness.hasTeacherRecommendationsReady === null
                    ? ""
                    : current.readiness.hasTeacherRecommendationsReady
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    readiness: {
                      ...profile.readiness,
                      hasTeacherRecommendationsReady:
                        value === "" ? null : value === "true",
                    },
                  }))
                }
              />
              <ChoiceField
                label="Has counselor documents ready"
                value={
                  current.readiness.hasCounselorDocumentsReady === null
                    ? ""
                    : current.readiness.hasCounselorDocumentsReady
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    readiness: {
                      ...profile.readiness,
                      hasCounselorDocumentsReady:
                        value === "" ? null : value === "true",
                    },
                  }))
                }
              />
              <ChoiceField
                label="Has essay drafts started"
                value={
                  current.readiness.hasEssayDraftsStarted === null
                    ? ""
                    : current.readiness.hasEssayDraftsStarted
                      ? "true"
                      : "false"
                }
                options={["", "true", "false"] as const}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    readiness: {
                      ...profile.readiness,
                      hasEssayDraftsStarted:
                        value === "" ? null : value === "true",
                    },
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Current assumptions">
            <TagsField
              label="Current assumptions"
              value={document.current.assumptions}
              onChange={onChangeCurrentAssumptions}
            />
          </ProfileGroup>
        </div>
      </SectionCard>

      <div className="space-y-4">
        <SectionCard title="Projected snapshot" icon={ArrowRight}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField
                label="Projected GPA"
                value={projected.academic.projectedGpa100}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    academic: { ...profile.academic, projectedGpa100: value },
                  }))
                }
              />
              <TextField
                label="Projected entry term"
                value={projected.targetEntryTerm}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    targetEntryTerm: value,
                  }))
                }
              />
            </div>
            <TagsField
              label="Projected assumptions"
              value={document.projected.assumptions}
              onChange={onChangeProjectedAssumptions}
            />
            <div className="rounded-2xl border border-dashed border-border bg-surface-soft p-4 text-sm text-muted-foreground">
              Shared fields are mirrored from the current snapshot as you edit.
              This card only owns projected-only inputs.
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Missing field log" icon={CheckCircle2}>
          <div className="space-y-2">
            {missingFields.slice(0, 6).map((field) => (
              <MissingFieldRow
                key={`${field.snapshotKind}-${field.path}`}
                field={field}
              />
            ))}
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
  children: ReactNode;
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

function TextField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary"
      />
    </Field>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}>) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value)
          )
        }
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary"
      />
    </Field>
  );
}

function ChoiceField<T extends string>({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: T | "";
  options: readonly T[];
  onChange: (value: T) => void;
}>) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "" ? "Not set" : option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TagsField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}>) {
  return (
    <Field label={label}>
      <textarea
        rows={3}
        value={joinListValue(value)}
        onChange={(event) => onChange(splitListValue(event.target.value))}
        placeholder="Comma-separated values"
        className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
      />
    </Field>
  );
}

function ProfileGroup({
  title,
  children,
}: Readonly<{
  title: string;
  children: ReactNode;
}>) {
  return (
    <div className="rounded-[1.35rem] border border-border bg-surface-soft p-4">
      <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function SummaryTile({
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
      <p className="mt-1 text-[16px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SummaryList({
  title,
  items,
  className = "",
}: Readonly<{
  title: string;
  items: StudentOnboardingSummary["currentHighlights"];
  className?: string;
}>) {
  return (
    <div className={className}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <SummaryRow key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function MissingFieldRow({
  field,
}: Readonly<{
  field: StudentProfileMissingField;
}>) {
  return (
    <div className="rounded-xl border border-border bg-white px-3 py-2.5">
      <p className="text-[12px] font-medium text-foreground">{field.message}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {field.snapshotKind} / {field.path}
      </p>
    </div>
  );
}

function NoteBlock({
  title,
  value,
}: Readonly<{
  title: string;
  value: string;
}>) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
        {value}
      </p>
    </div>
  );
}
