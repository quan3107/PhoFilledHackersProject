// Manual profile editor panel for the student onboarding experience.
// Edits the canonical current and projected profile snapshots separately.
"use client";

import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

import { SectionCard } from "../dashboard/primitives";
import {
  formatLocationPreferences,
  locationPreferenceOptions,
  parseLocationPreferences,
} from "@/lib/location-preferences";
import {
  budgetFlexibilityOptions,
  curriculumStrengthOptions,
  englishExamTypeOptions,
  joinListValue,
  parseBooleanChoice,
  preferredUndergraduateSizeOptions,
  serializeBooleanChoice,
  splitListValue,
  type StudentProfile,
  type StudentProfileDocument,
  type StudentProfileMissingField,
} from "@/lib/student-profile";

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

const yesNoOptions = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const schoolControlOptions = [
  { value: "public", label: "Public" },
  { value: "private_nonprofit", label: "Private nonprofit" },
];

function serializeNumber(value: number | null) {
  return value === null ? "" : String(value);
}

function parseNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function updateAcademic(
  profile: StudentProfile,
  values: Partial<StudentProfile["academic"]>
): StudentProfile {
  return { ...profile, academic: { ...profile.academic, ...values } };
}

function updateTesting(
  profile: StudentProfile,
  values: Partial<StudentProfile["testing"]>
): StudentProfile {
  return { ...profile, testing: { ...profile.testing, ...values } };
}

function updatePreferences(
  profile: StudentProfile,
  values: Partial<StudentProfile["preferences"]>
): StudentProfile {
  return { ...profile, preferences: { ...profile.preferences, ...values } };
}

function updateBudget(
  profile: StudentProfile,
  values: Partial<StudentProfile["budget"]>
): StudentProfile {
  return { ...profile, budget: { ...profile.budget, ...values } };
}

function updateReadiness(
  profile: StudentProfile,
  values: Partial<StudentProfile["readiness"]>
): StudentProfile {
  return { ...profile, readiness: { ...profile.readiness, ...values } };
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
                placeholder="Vietnam"
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
                placeholder="Fall 2027"
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Academic">
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Current GPA (100 scale)"
                value={current.academic.currentGpa100}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateAcademic(profile, { currentGpa100: value })
                  )
                }
                placeholder="92"
              />
              <ChoiceField
                label="Curriculum strength"
                value={current.academic.curriculumStrength}
                options={curriculumStrengthOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateAcademic(profile, {
                      curriculumStrength:
                        value as StudentProfile["academic"]["curriculumStrength"],
                    })
                  )
                }
              />
              <NumberField
                label="Class rank percentile"
                value={current.academic.classRankPercent}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateAcademic(profile, { classRankPercent: value })
                  )
                }
                placeholder="90"
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Testing">
            <div className="grid gap-3 sm:grid-cols-3">
              <ChoiceField
                label="Will submit tests"
                value={serializeBooleanChoice(current.testing.willSubmitTests)}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateTesting(profile, {
                      willSubmitTests: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <NumberField
                label="SAT total"
                value={current.testing.satTotal}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateTesting(profile, { satTotal: value })
                  )
                }
                placeholder="1450"
              />
              <NumberField
                label="ACT composite"
                value={current.testing.actComposite}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateTesting(profile, { actComposite: value })
                  )
                }
                placeholder="32"
              />
              <ChoiceField
                label="English exam"
                value={current.testing.englishExamType}
                options={englishExamTypeOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateTesting(profile, {
                      englishExamType:
                        value as StudentProfile["testing"]["englishExamType"],
                    })
                  )
                }
              />
              <NumberField
                label="English score"
                value={current.testing.englishExamScore}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateTesting(profile, { englishExamScore: value })
                  )
                }
                placeholder="7.5"
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Preferences">
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Intended majors"
                value={joinListValue(current.preferences.intendedMajors)}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updatePreferences(profile, {
                      intendedMajors: splitListValue(value),
                    })
                  )
                }
                placeholder="Computer Science, Economics"
              />
              <TextField
                label="Preferred states"
                value={joinListValue(current.preferences.preferredStates)}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updatePreferences(profile, {
                      preferredStates: splitListValue(value).map((entry) =>
                        entry.toUpperCase()
                      ),
                    })
                  )
                }
                placeholder="CA, MA, NY"
              />
              <TextField
                label="Location preferences"
                value={formatLocationPreferences({
                  preferredStates: [],
                  preferredLocationPreferences:
                    current.preferences.preferredLocationPreferences,
                })}
                onChange={(value) =>
                  onChangeCurrent((profile) => {
                    const parsed = parseLocationPreferences(value);
                    return updatePreferences(profile, {
                      preferredLocationPreferences:
                        parsed.preferredLocationPreferences,
                    });
                  })
                }
                placeholder={locationPreferenceOptions.slice(0, 2).join(", ")}
              />
              <TextField
                label="Campus locale"
                value={joinListValue(current.preferences.preferredCampusLocale)}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updatePreferences(profile, {
                      preferredCampusLocale: splitListValue(value),
                    })
                  )
                }
                placeholder="Urban, Suburban"
              />
              <ChoiceField
                label="School control"
                value={current.preferences.preferredSchoolControl[0] ?? ""}
                options={schoolControlOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updatePreferences(profile, {
                      preferredSchoolControl: value
                        ? [
                            value as StudentProfile["preferences"]["preferredSchoolControl"][number],
                          ]
                        : [],
                    })
                  )
                }
              />
              <ChoiceField
                label="Undergraduate size"
                value={current.preferences.preferredUndergraduateSize}
                options={preferredUndergraduateSizeOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updatePreferences(profile, {
                      preferredUndergraduateSize:
                        value as StudentProfile["preferences"]["preferredUndergraduateSize"],
                    })
                  )
                }
              />
            </div>
          </ProfileGroup>

          <ProfileGroup title="Budget and readiness">
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Annual budget (USD)"
                value={current.budget.annualBudgetUsd}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateBudget(profile, { annualBudgetUsd: value })
                  )
                }
                placeholder="55000"
              />
              <ChoiceField
                label="Needs financial aid"
                value={serializeBooleanChoice(current.budget.needsFinancialAid)}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateBudget(profile, {
                      needsFinancialAid: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <ChoiceField
                label="Needs merit aid"
                value={serializeBooleanChoice(current.budget.needsMeritAid)}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateBudget(profile, {
                      needsMeritAid: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <ChoiceField
                label="Budget flexibility"
                value={current.budget.budgetFlexibility}
                options={budgetFlexibilityOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateBudget(profile, {
                      budgetFlexibility:
                        value as StudentProfile["budget"]["budgetFlexibility"],
                    })
                  )
                }
              />
              <ChoiceField
                label="Wants early round"
                value={serializeBooleanChoice(
                  current.readiness.wantsEarlyRound
                )}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateReadiness(profile, {
                      wantsEarlyRound: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <ChoiceField
                label="Teacher recommendations ready"
                value={serializeBooleanChoice(
                  current.readiness.hasTeacherRecommendationsReady
                )}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateReadiness(profile, {
                      hasTeacherRecommendationsReady: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <ChoiceField
                label="Counselor documents ready"
                value={serializeBooleanChoice(
                  current.readiness.hasCounselorDocumentsReady
                )}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateReadiness(profile, {
                      hasCounselorDocumentsReady: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <ChoiceField
                label="Essay drafts started"
                value={serializeBooleanChoice(
                  current.readiness.hasEssayDraftsStarted
                )}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeCurrent((profile) =>
                    updateReadiness(profile, {
                      hasEssayDraftsStarted: parseBooleanChoice(value),
                    })
                  )
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
              <NumberField
                label="Projected GPA (100 scale)"
                value={projected.academic.projectedGpa100}
                onChange={(value) =>
                  onChangeProjected((profile) =>
                    updateAcademic(profile, { projectedGpa100: value })
                  )
                }
                placeholder="96"
              />
              <TextField
                label="Projected majors"
                value={joinListValue(projected.preferences.intendedMajors)}
                onChange={(value) =>
                  onChangeProjected((profile) =>
                    updatePreferences(profile, {
                      intendedMajors: splitListValue(value),
                    })
                  )
                }
                placeholder="Computer Science"
              />
              <ChoiceField
                label="Projected wants early round"
                value={serializeBooleanChoice(
                  projected.readiness.wantsEarlyRound
                )}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeProjected((profile) =>
                    updateReadiness(profile, {
                      wantsEarlyRound: parseBooleanChoice(value),
                    })
                  )
                }
              />
              <ChoiceField
                label="Projected essay drafts started"
                value={serializeBooleanChoice(
                  projected.readiness.hasEssayDraftsStarted
                )}
                options={yesNoOptions}
                onChange={(value) =>
                  onChangeProjected((profile) =>
                    updateReadiness(profile, {
                      hasEssayDraftsStarted: parseBooleanChoice(value),
                    })
                  )
                }
              />
            </div>
            <TagsField
              label="Projected assumptions"
              value={document.projected.assumptions}
              onChange={onChangeProjectedAssumptions}
            />
            <div className="rounded-2xl border border-dashed border-border bg-[var(--surface-soft,#f4f7fb)] p-4 text-sm text-muted-foreground">
              Projected fields are saved as their own canonical snapshot, so a
              future-state edit does not rewrite the current profile.
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
            {missingFields.length === 0 ? (
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                All tracked onboarding fields are present.
              </p>
            ) : null}
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

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: Readonly<{
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}>) {
  return (
    <TextField
      label={label}
      value={serializeNumber(value)}
      onChange={(nextValue) => onChange(parseNumber(nextValue))}
      placeholder={placeholder}
    />
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
  options: readonly (string | { value: string; label: string })[];
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
        {options.map((option) => {
          const valueText = typeof option === "string" ? option : option.value;
          const labelText = typeof option === "string" ? option : option.label;

          return (
            <option key={valueText} value={valueText}>
              {labelText}
            </option>
          );
        })}
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
              {item} x
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
  field: StudentProfileMissingField;
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
