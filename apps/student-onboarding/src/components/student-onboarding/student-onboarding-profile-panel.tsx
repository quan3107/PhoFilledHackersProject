// Manual profile editor panel for the student onboarding experience.
// Keeps current and projected snapshots visible without requiring backend persistence.
"use client";

import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { SectionCard } from "../dashboard/primitives";
import {
  type StudentOnboardingDocument,
  type StudentOnboardingMissingField,
} from "./student-onboarding-model";
import { locationPreferenceLabels } from "@/lib/location-preferences";
import type { StudentProfileDraft } from "@/lib/onboarding-data";

type ProfilePanelProps = Readonly<{
  document: StudentOnboardingDocument;
  missingFields: StudentOnboardingMissingField[];
  onChangeCurrent: (
    updater: (profile: StudentProfileDraft) => StudentProfileDraft
  ) => void;
  onChangeProjected: (
    updater: (profile: StudentProfileDraft) => StudentProfileDraft
  ) => void;
  onChangeCurrentAssumptions: (value: string[]) => void;
  onChangeProjectedAssumptions: (value: string[]) => void;
}>;

const gradeOptions = [
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
  "Gap Year",
];
const graduationYearOptions = ["2026", "2027", "2028", "2029"];
const curriculumOptions = [
  "Vietnamese National",
  "IB (International Baccalaureate)",
  "AP (Advanced Placement)",
  "A-Levels",
  "Other",
];
const earlyRoundOptions = ["Yes - planning early", "No - regular rounds"];
const yesNoOptions = ["Yes", "No"];
const scholarshipOptions = [
  "Essential - can't attend without it",
  "Important but not critical",
  "Nice to have",
  "Not needed",
];
const locationOptions = Object.values(locationPreferenceLabels);
const sizeOptions = [
  "Small (under 5,000)",
  "Medium (5,000-15,000)",
  "Large (15,000+)",
];

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
                label="Full name"
                value={current.fullName}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    fullName: value,
                  }))
                }
              />
              <ChoiceField
                label="Grade"
                value={current.grade}
                options={gradeOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({ ...profile, grade: value }))
                }
              />
              <ChoiceField
                label="Graduation year"
                value={current.graduationYear}
                options={graduationYearOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    graduationYear: value,
                  }))
                }
              />
              <ChoiceField
                label="Curriculum"
                value={current.curriculum}
                options={curriculumOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    curriculum: value,
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Academic">
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="GPA"
                value={current.gpa}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({ ...profile, gpa: value }))
                }
                placeholder="3.8/4.0"
              />
              <TextField
                label="IELTS/TOEFL"
                value={current.ielts}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({ ...profile, ielts: value }))
                }
                placeholder="IELTS 7.0"
              />
              <TextField
                label="SAT/ACT"
                value={current.sat}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({ ...profile, sat: value }))
                }
                placeholder="SAT 1450"
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Activities">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Intended majors"
                value={current.intendedMajors}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    intendedMajors: value,
                  }))
                }
                placeholder="Computer Science, Economics"
              />
              <TextField
                label="Extracurriculars"
                value={current.extracurriculars}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    extracurriculars: value,
                  }))
                }
                placeholder="Robotics club, volunteering"
              />
              <ChoiceField
                label="Wants early round"
                value={current.wantsEarlyRound}
                options={earlyRoundOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    wantsEarlyRound: value,
                  }))
                }
              />
              <ChoiceField
                label="Has teacher recommendations ready"
                value={current.teacherRecommendationsReady}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    teacherRecommendationsReady: value,
                  }))
                }
              />
              <ChoiceField
                label="Has counselor documents ready"
                value={current.counselorDocumentsReady}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    counselorDocumentsReady: value,
                  }))
                }
              />
              <ChoiceField
                label="Has essay drafts started"
                value={current.essayDraftsStarted}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    essayDraftsStarted: value,
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Preferences">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Annual budget"
                value={current.annualBudget}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    annualBudget: value,
                  }))
                }
                placeholder="$40,000 - $60,000"
              />
              <ChoiceField
                label="Scholarship need"
                value={current.scholarshipNeed}
                options={scholarshipOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    scholarshipNeed: value,
                  }))
                }
              />
              <ChoiceField
                label="Location"
                value={current.geographyPreferences}
                options={locationOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    geographyPreferences: value,
                  }))
                }
              />
              <ChoiceField
                label="Campus size"
                value={current.campusSize}
                options={sizeOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) => ({
                    ...profile,
                    campusSize: value,
                  }))
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Current assumptions">
            <TagsField
              label="Assumptions"
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
              <TextField
                label="Projected GPA"
                value={projected.gpa}
                onChange={(value) =>
                  onChangeProjected((profile) => ({ ...profile, gpa: value }))
                }
                placeholder="3.9/4.0"
              />
              <TextField
                label="Projected majors"
                value={projected.intendedMajors}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    intendedMajors: value,
                  }))
                }
                placeholder="Computer Science"
              />
              <ChoiceField
                label="Projected wants early round"
                value={projected.wantsEarlyRound}
                options={earlyRoundOptions}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    wantsEarlyRound: value,
                  }))
                }
              />
              <ChoiceField
                label="Projected has teacher recommendations ready"
                value={projected.teacherRecommendationsReady}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    teacherRecommendationsReady: value,
                  }))
                }
              />
              <ChoiceField
                label="Projected has counselor documents ready"
                value={projected.counselorDocumentsReady}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    counselorDocumentsReady: value,
                  }))
                }
              />
              <ChoiceField
                label="Projected has essay drafts started"
                value={projected.essayDraftsStarted}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeProjected((profile) => ({
                    ...profile,
                    essayDraftsStarted: value,
                  }))
                }
              />
            </div>
            <TagsField
              label="Projected assumptions"
              value={document.projected.assumptions}
              onChange={onChangeProjectedAssumptions}
            />
            <div className="rounded-2xl border border-dashed border-border bg-[var(--surface-soft,#f4f7fb)] p-4 text-sm text-muted-foreground">
              Shared fields are mirrored from the current snapshot as you edit,
              while this card keeps projected-only assumptions visible alongside
              the canonical saved profile.
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

function ProfileGroup({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-3 rounded-[1.35rem] border border-border bg-[var(--surface-soft,#f4f7fb)] p-4">
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      {children}
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

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}>) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
      />
    </Field>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}>) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition focus:border-primary"
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.length ? (
          value.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onChange(value.filter((entry) => entry !== item))}
              className="rounded-full border border-border bg-white px-3 py-1.5 text-xs text-foreground transition hover:border-primary"
            >
              {item} ×
            </button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        )}
      </div>
      <Field label={label}>
        <TagInput onAdd={(item) => onChange([...value, item])} />
      </Field>
    </div>
  );
}

function TagInput({ onAdd }: Readonly<{ onAdd: (value: string) => void }>) {
  return (
    <input
      placeholder="Type a value and press Enter"
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return;
        }

        event.preventDefault();
        const input = event.currentTarget;
        const value = input.value.trim();
        if (!value) {
          return;
        }

        onAdd(value);
        input.value = "";
      }}
      className="h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary"
    />
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
