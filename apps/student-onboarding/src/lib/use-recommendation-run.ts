"use client";

import { useState } from "react";

import {
  normalizeRecommendationData,
  type StudentOnboardingRecommendationView,
} from "@/lib/student-onboarding";
import type { StudentProfileMissingField } from "@/lib/student-profile";

export type RunResult =
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: string;
      missingFields?: StudentProfileMissingField[];
    };

export type RunRecommendationsHandler = () => Promise<RunResult>;

type UseRecommendationRunInput = Readonly<{
  onRunRecommendations?: RunRecommendationsHandler;
  onRouteResults: () => void;
}>;

export function buildRecommendationFailureView(
  error: string,
  missingFields: StudentProfileMissingField[] = []
): StudentOnboardingRecommendationView {
  return {
    runId: null,
    title: "Recommendations unavailable",
    summary: error,
    items: missingFields.slice(0, 8).map((field) => ({
      label: `${field.snapshotKind} / ${field.path}`,
      value: field.message,
      tone: "warning",
    })),
    rawPreview: JSON.stringify(
      {
        error,
        missingFields,
      },
      null,
      2
    ),
  };
}

export function useRecommendationRun({
  onRunRecommendations,
  onRouteResults,
}: UseRecommendationRunInput) {
  const [runningRecommendations, setRunningRecommendations] = useState(false);
  const [recommendationView, setRecommendationView] =
    useState<StudentOnboardingRecommendationView | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null
  );

  async function handleRunRecommendations() {
    setRunningRecommendations(true);
    setRecommendationError(null);

    try {
      const runResult = onRunRecommendations
        ? await onRunRecommendations()
        : await defaultRunRecommendations();

      if (!runResult.ok) {
        setRecommendationError(runResult.error);
        setRecommendationView(
          buildRecommendationFailureView(
            runResult.error,
            runResult.missingFields ?? []
          )
        );
        onRouteResults();
        return;
      }

      setRecommendationView(normalizeRecommendationData(runResult.data));
      onRouteResults();
    } catch {
      const error =
        "Unable to run recommendations right now. Please try again.";
      setRecommendationError(error);
      setRecommendationView(buildRecommendationFailureView(error));
      onRouteResults();
    } finally {
      setRunningRecommendations(false);
    }
  }

  return {
    handleRunRecommendations,
    recommendationError,
    recommendationView,
    runningRecommendations,
  };
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
