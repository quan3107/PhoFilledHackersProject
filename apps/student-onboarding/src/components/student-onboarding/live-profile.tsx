"use client";

import {
  Award,
  BookOpen,
  Building,
  DollarSign,
  FileText,
  Globe,
  GraduationCap,
  MapPin,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  copy,
  profileLabels,
  sectionFields,
  type Locale,
  type ProfileField,
  type StudentProfileDraft,
} from "@/lib/onboarding-data";

interface LiveProfileProps {
  locale: Locale;
  profile: StudentProfileDraft;
  recentlyUpdated: ProfileField | null;
  filledCount: number;
  totalCount: number;
  isComplete: boolean;
  onGenerate: () => void;
}

const fieldIcons: Record<ProfileField, React.ElementType> = {
  fullName: Users,
  grade: BookOpen,
  graduationYear: Target,
  curriculum: FileText,
  gpa: TrendingUp,
  ielts: Globe,
  sat: Award,
  intendedMajors: Target,
  extracurriculars: Users,
  wantsEarlyRound: Target,
  teacherRecommendationsReady: FileText,
  counselorDocumentsReady: FileText,
  essayDraftsStarted: FileText,
  annualBudget: DollarSign,
  scholarshipNeed: Award,
  geographyPreferences: MapPin,
  campusSize: Building,
};

const sectionIcons = {
  academics: GraduationCap,
  activities: Users,
  readiness: FileText,
  preferences: DollarSign,
};

function getSectionTitle(
  locale: Locale,
  key: "academics" | "activities" | "readiness" | "preferences"
) {
  const text = copy[locale];

  if (key === "academics") {
    return text.sectionAcademics;
  }

  if (key === "activities") {
    return text.sectionActivities;
  }

  if (key === "readiness") {
    return text.sectionReadiness;
  }

  return text.sectionPreferences;
}

function getBudgetSubtitle(value: string) {
  if (!value.includes("$")) {
    return null;
  }

  if (value.includes("20,000")) {
    return "~500tr VNĐ";
  }

  if (value.includes("40,000")) {
    return "~1 tỷ VNĐ";
  }

  if (value.includes("60,000")) {
    return "~1.5 tỷ VNĐ";
  }

  return null;
}

export function LiveProfile({
  locale,
  profile,
  recentlyUpdated,
  filledCount,
  totalCount,
  isComplete,
  onGenerate,
}: LiveProfileProps) {
  const text = copy[locale];
  const progressPercent = Math.round((filledCount / totalCount) * 100);

  return (
    <div className="relative flex h-full flex-col bg-background">
      <div className="border-b border-border bg-card px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-foreground">
              {profile.fullName || text.profileTitle}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {text.profileSubtitle}
            </p>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs ${progressPercent === 100 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            {filledCount}/{totalCount} {text.profileFields}
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{text.profileCompletion}</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {sectionFields.map((section) => {
            const SectionIcon = sectionIcons[section.key];

            return (
              <section
                key={section.key}
                className="space-y-1 rounded-xl border border-border bg-card p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <SectionIcon className="h-4 w-4 text-primary" />
                  <h4 className="text-xs uppercase tracking-wide text-muted-foreground">
                    {getSectionTitle(locale, section.key)}
                  </h4>
                </div>

                {section.fields.map((field) => {
                  const FieldIcon = fieldIcons[field];
                  const value = profile[field];
                  const isHighlighted = field === recentlyUpdated;
                  const subtitleText =
                    field === "annualBudget" ? getBudgetSubtitle(value) : null;

                  return (
                    <div
                      key={field}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-500 ${
                        isHighlighted
                          ? "bg-emerald-50 ring-1 ring-emerald-300 dark:bg-emerald-950/30 dark:ring-emerald-700"
                          : "bg-transparent"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                          value
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground/40"
                        }`}
                      >
                        <FieldIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-xs text-muted-foreground">
                          {profileLabels[field][locale]}
                        </p>
                        {value ? (
                          <>
                            <p className="truncate text-sm text-foreground">
                              {value}
                            </p>
                            {subtitleText ? (
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {subtitleText}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <div className="mt-1 h-4 w-24 animate-pulse rounded bg-muted/60" />
                        )}
                      </div>
                      {value ? (
                        <span className="mt-1 text-emerald-500">✓</span>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            );
          })}
          <div className="h-20" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent p-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!isComplete}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm transition-all ${
            isComplete
              ? "pulse-ready bg-primary text-primary-foreground hover:bg-primary/90"
              : "cursor-not-allowed bg-muted text-muted-foreground"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          {text.profileGenerate}
        </button>
      </div>
    </div>
  );
}
