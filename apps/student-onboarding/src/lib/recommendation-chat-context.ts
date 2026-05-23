// apps/student-onboarding/src/lib/recommendation-chat-context.ts
// Local read path for the post-recommendation assistant.
// Loads the current profile, latest successful recommendation run, and compact school context.

import {
  buildStudentProfileDocumentFromState,
  getStudentProfileStateForUser,
  type StudentProfileDocument,
  type StudentProfileState,
} from "@etest/auth";
import { getBackendDb } from "@etest/backend-data";
import {
  recommendationRuns,
  studentProfileSnapshots,
  universities,
  type RecommendationResultRecord,
  type RecommendationRunRecord,
} from "@etest/db";
import { and, eq } from "drizzle-orm";

import type { RecommendationChatTranscriptMessage } from "./recommendation-chat-processor";

type RecommendationRunRow = typeof recommendationRuns.$inferSelect;
type RecommendationResultRow = RecommendationResultRecord & {
  university: typeof universities.$inferSelect;
};
type StudentProfileSnapshotRow = typeof studentProfileSnapshots.$inferSelect;

export interface RecommendationChatSchoolContext {
  rankOrder: number;
  schoolName: string;
  city: string;
  state: string;
  tier: RecommendationResultRecord["tier"];
  currentOutlook: RecommendationResultRecord["currentOutlook"];
  projectedOutlook: RecommendationResultRecord["projectedOutlook"];
  confidenceLevel: RecommendationResultRecord["confidenceLevel"];
  budgetFit: RecommendationResultRecord["budgetFit"];
  deadlinePressure: RecommendationResultRecord["deadlinePressure"];
  currentScore: number;
  projectedScore: number | null;
  tuitionAnnualUsd: number;
  estimatedCostOfAttendanceUsd: number;
  livingCostEstimateUsd: number;
  scholarshipAvailabilityFlag: boolean;
  scholarshipNotes: string;
  officialAdmissionsUrl: string;
  applicationRounds: string[];
  deadlinesByRound: (typeof universities.$inferSelect)["deadlinesByRound"];
  englishRequirements: (typeof universities.$inferSelect)["englishRequirements"];
  testPolicy: string;
  requiredMaterials: string[];
}

export interface RecommendationChatRunContext {
  run: RecommendationRunRecord;
  currentSnapshot: StudentProfileSnapshotRowSummary | null;
  projectedSnapshot: StudentProfileSnapshotRowSummary | null;
  rankedResults: RecommendationChatSchoolContext[];
  detailedSchools: RecommendationChatSchoolContext[];
}

export interface RecommendationChatContext {
  profileState: StudentProfileState;
  profileDocument: StudentProfileDocument;
  latestRecommendationRun: RecommendationChatRunContext | null;
}

interface StudentProfileSnapshotRowSummary {
  id: string;
  studentProfileId: string;
  snapshotKind: "current" | "projected";
  assumptions: string[];
  profile: StudentProfileDocument["current"]["profile"];
  createdAt: string;
}

export async function loadRecommendationChatContextForUser(input: {
  userId: string;
  latestMessage: string | null;
  transcript: RecommendationChatTranscriptMessage[];
}): Promise<RecommendationChatContext> {
  const [authDb, profileState] = await Promise.all([
    getBackendDb(),
    getStudentProfileStateForUser(input.userId),
  ]);

  const latestSuccessfulRun = (await authDb.query.recommendationRuns.findFirst({
    where: and(
      eq(recommendationRuns.userId, input.userId),
      eq(recommendationRuns.runStatus, "succeeded")
    ),
    orderBy: (table, { desc: sortDesc }) => [sortDesc(table.createdAt)],
    with: {
      currentSnapshot: true,
      projectedSnapshot: true,
      results: {
        orderBy: (table, { asc: sortAsc }) => [sortAsc(table.rankOrder)],
        with: {
          university: true,
        },
      },
    },
  })) as RecommendationRunQueryRow | undefined;

  return {
    profileState,
    profileDocument: buildStudentProfileDocumentFromState(profileState),
    latestRecommendationRun: latestSuccessfulRun
      ? toRecommendationChatRunContext(
          latestSuccessfulRun,
          input.latestMessage,
          input.transcript
        )
      : null,
  };
}

type RecommendationRunQueryRow = RecommendationRunRow & {
  currentSnapshot: StudentProfileSnapshotRow | null;
  projectedSnapshot: StudentProfileSnapshotRow | null;
  results: RecommendationResultRow[];
};

function toRecommendationChatRunContext(
  run: RecommendationRunQueryRow,
  latestMessage: string | null,
  transcript: RecommendationChatTranscriptMessage[]
): RecommendationChatRunContext {
  const rankedResults = run.results.map(toRecommendationChatSchoolContext);
  const relevantResults = selectRelevantResultIds(
    latestMessage,
    transcript,
    rankedResults
  );
  const relevantSchoolIds = new Set(
    relevantResults.map((result) => result.schoolName)
  );

  return {
    run: toRecommendationRunRecord(run),
    currentSnapshot: run.currentSnapshot
      ? toSnapshotSummary(run.currentSnapshot)
      : null,
    projectedSnapshot: run.projectedSnapshot
      ? toSnapshotSummary(run.projectedSnapshot)
      : null,
    rankedResults,
    detailedSchools: rankedResults.filter((result) =>
      relevantSchoolIds.has(result.schoolName)
    ),
  };
}

function selectRelevantResultIds(
  latestMessage: string | null,
  transcript: RecommendationChatTranscriptMessage[],
  rankedResults: RecommendationChatSchoolContext[]
): RecommendationChatSchoolContext[] {
  const haystack = normalizeSearchText(
    [latestMessage ?? "", ...transcript.map((message) => message.text)].join(
      " "
    )
  );
  const matched = rankedResults.filter((result) =>
    normalizeSearchText(result.schoolName)
      .split(" ")
      .every((token) => haystack.includes(token))
  );

  if (matched.length > 0) {
    return matched.slice(0, 6);
  }

  return rankedResults.slice(0, 6);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRecommendationRunRecord(
  row: RecommendationRunQueryRow
): RecommendationRunRecord {
  return {
    id: row.id,
    userId: row.userId,
    studentProfileId: row.studentProfileId,
    currentSnapshotId: row.currentSnapshotId,
    projectedSnapshotId: row.projectedSnapshotId,
    runStatus: row.runStatus,
    scoringConfigSnapshot: row.scoringConfigSnapshot,
    missingProfileFields: row.missingProfileFields,
    candidateSchoolCount: row.candidateSchoolCount,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function toSnapshotSummary(
  row: StudentProfileSnapshotRow
): StudentProfileSnapshotRowSummary {
  return {
    id: row.id,
    studentProfileId: row.studentProfileId,
    snapshotKind: row.snapshotKind,
    assumptions: row.assumptions,
    profile: row.profile,
    createdAt: row.createdAt.toISOString(),
  };
}

function toRecommendationChatSchoolContext(
  row: RecommendationResultRow
): RecommendationChatSchoolContext {
  return {
    rankOrder: row.rankOrder,
    schoolName: row.university.schoolName,
    city: row.university.city,
    state: row.university.state,
    tier: row.tier,
    currentOutlook: row.currentOutlook,
    projectedOutlook: row.projectedOutlook,
    confidenceLevel: row.confidenceLevel,
    budgetFit: row.budgetFit,
    deadlinePressure: row.deadlinePressure,
    currentScore: row.currentScore,
    projectedScore: row.projectedScore,
    tuitionAnnualUsd: row.university.tuitionAnnualUsd,
    estimatedCostOfAttendanceUsd: row.university.estimatedCostOfAttendanceUsd,
    livingCostEstimateUsd: row.university.livingCostEstimateUsd,
    scholarshipAvailabilityFlag: row.university.scholarshipAvailabilityFlag,
    scholarshipNotes: row.university.scholarshipNotes,
    officialAdmissionsUrl: row.university.officialAdmissionsUrl,
    applicationRounds: row.university.applicationRounds,
    deadlinesByRound: row.university.deadlinesByRound,
    englishRequirements: row.university.englishRequirements,
    testPolicy: row.university.testPolicy,
    requiredMaterials: row.university.requiredMaterials,
  };
}
