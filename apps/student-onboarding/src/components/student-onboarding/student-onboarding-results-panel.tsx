// Recommendation surface for the onboarding experience.
// Shows the latest canonical recommendation-run output for the current student.
"use client";

import { ArrowRight, CheckCircle2, RefreshCcw, Sparkles } from "lucide-react";

import { MetricCard, Pill, SectionCard } from "../dashboard/primitives";
import {
  RecommendationChatPanel,
  type RecommendationChatMessage,
  type RecommendationChatTurnResult,
} from "./recommendation-chat-panel";
import {
  type StudentOnboardingRecommendationView,
  type StudentOnboardingSummary,
} from "@/lib/student-onboarding";
import type { StudentProfileMissingField } from "@/lib/student-profile";

type ResultsPanelProps = Readonly<{
  recommendationView: StudentOnboardingRecommendationView | null;
  summary: StudentOnboardingSummary;
  missingFields: StudentProfileMissingField[];
  recommendationError: string | null;
  runningRecommendations: boolean;
  onRunRecommendations: () => void;
  onGoToReview: () => void;
  recommendationChatSessionKey: string;
  onSubmitRecommendationChatTurn: (
    message: string | null,
    messages: RecommendationChatMessage[]
  ) => Promise<RecommendationChatTurnResult>;
}>;

export function StudentOnboardingResultsPanel({
  recommendationView,
  summary,
  missingFields,
  recommendationError,
  runningRecommendations,
  onRunRecommendations,
  onGoToReview,
  recommendationChatSessionKey,
  onSubmitRecommendationChatTurn,
}: ResultsPanelProps) {
  const visibleItems = recommendationView?.items ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <SectionCard title="Recommendations" icon={Sparkles}>
        <div className="space-y-4">
          <div className="rounded-[1.4rem] border border-border bg-[var(--surface-soft,#f4f7fb)] p-4">
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
              <MetricCard label="Ready" value={`${summary.completion}%`} />
              <MetricCard
                label="Missing fields"
                value={String(summary.missingCount)}
              />
              <MetricCard
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
                      <Pill className={toneClass(item.tone)}>{item.tone}</Pill>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.35rem] border border-dashed border-border bg-white/80 p-5 text-sm text-muted-foreground">
              No recommendation run has been saved yet for this student profile.
            </div>
          )}

          {recommendationView?.rawPreview ? (
            <pre className="max-h-[18rem] overflow-auto rounded-[1.35rem] border border-border bg-[var(--surface-soft,#f4f7fb)] p-4 text-[12px] leading-6 text-muted-foreground">
              {recommendationView.rawPreview}
            </pre>
          ) : null}
          {recommendationError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {recommendationError}
            </div>
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
              <p className="rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
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

        <RecommendationChatPanel
          sessionKey={recommendationChatSessionKey}
          onSubmitTurn={onSubmitRecommendationChatTurn}
        />
      </div>
    </div>
  );
}

function toneClass(tone: "neutral" | "warning" | "success") {
  if (tone === "success") return "bg-emerald-50 text-emerald-700";
  if (tone === "warning") return "bg-amber-50 text-amber-700";
  return "bg-muted text-foreground";
}

function FieldRow({
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
      className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-left transition hover:border-primary hover:shadow-sm"
    >
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}
