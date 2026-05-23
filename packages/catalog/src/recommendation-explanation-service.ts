// packages/catalog/src/recommendation-explanation-service.ts
// OpenAI-backed shortlist and explanation orchestration for recommendation runs.
// Keeps the LLM pass bounded, strictly validated, and persisted in one canonical path.

import type * as dbSchema from "@etest/db";
import {
  recommendationExplanationShortlistItems,
  recommendationExplanations,
  recommendationShortlists,
  type RecommendationResultRecord,
  type RecommendationRunRecord,
  type StudentProfileSnapshotRecord,
} from "@etest/db";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import {
  RECOMMENDATION_EXPLANATION_PROMPT_VERSION,
  recommendationExplanationSystemPrompt,
} from "./recommendation-explanation-prompt.js";
import {
  getPersistedRecommendationExplanationBundle,
  loadRecommendationExplanationRunContext,
  type PersistedRecommendationExplanationBundle,
  type RecommendationExplanationReadDb,
  type RecommendationExplanationRunContext,
} from "./recommendation-explanation-read-path.js";

const RECOMMENDATION_SHORTLIST_MAX_COUNT = 3;

export type OpenAiReasoningEffort =
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "xhigh";

export type RecommendationExplanationDb = PgDatabase<
  PgQueryResultHKT,
  typeof dbSchema
>;

export interface RecommendationExplanationPromptInput {
  recommendationRun: RecommendationRunRecord;
  currentSnapshot: StudentProfileSnapshotRecord;
  projectedSnapshot: StudentProfileSnapshotRecord | null;
  scoredResults: RecommendationResultRecord[];
  schools: RecommendationExplanationRunContext["schools"];
}

export interface RecommendationExplanationModelOutput {
  recommendationRunId: string;
  shortlistedRecommendationResultIds: string[];
  shortlistRationale: string[];
  explanations: RecommendationExplanationModelExplanation[];
}

export interface RecommendationExplanationModelExplanation {
  recommendationResultId: string;
  whyRecommended: string[];
  topBlockers: string[];
  nextRecommendedActions: string[];
  budgetSummary: string[];
  assumptionChanges: string[];
  explanationConfidence: "low" | "medium" | "high";
}

export interface RecommendationExplanationClient {
  model: string;
  generate(input: {
    instructions: string;
    payload: RecommendationExplanationPromptInput;
  }): Promise<RecommendationExplanationModelOutput>;
}

export interface RecommendationExplanationClientConfig {
  apiKey: string;
  model: string;
  reasoningEffort: OpenAiReasoningEffort;
  endpoint?: string;
}

interface OpenAiResponseBody {
  status?: string;
  output?: Array<{
    type: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  } | null;
}

const recommendationExplanationResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "recommendationRunId",
    "shortlistedRecommendationResultIds",
    "shortlistRationale",
    "explanations",
  ],
  properties: {
    recommendationRunId: { type: "string" },
    shortlistedRecommendationResultIds: {
      type: "array",
      items: { type: "string" },
    },
    shortlistRationale: {
      type: "array",
      items: { type: "string" },
    },
    explanations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "recommendationResultId",
          "whyRecommended",
          "topBlockers",
          "nextRecommendedActions",
          "budgetSummary",
          "assumptionChanges",
          "explanationConfidence",
        ],
        properties: {
          recommendationResultId: { type: "string" },
          whyRecommended: {
            type: "array",
            items: { type: "string" },
          },
          topBlockers: {
            type: "array",
            items: { type: "string" },
          },
          nextRecommendedActions: {
            type: "array",
            items: { type: "string" },
          },
          budgetSummary: {
            type: "array",
            items: { type: "string" },
          },
          assumptionChanges: {
            type: "array",
            items: { type: "string" },
          },
          explanationConfidence: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
        },
      },
    },
  },
} as const;

export class RecommendationExplanationOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationExplanationOutputError";
  }
}

export function createRecommendationExplanationClient(
  config: RecommendationExplanationClientConfig,
  fetchImpl: typeof fetch = fetch
): RecommendationExplanationClient {
  const endpoint = config.endpoint ?? "https://api.openai.com/v1/responses";

  return {
    model: config.model,
    async generate(input) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          reasoning: {
            effort: config.reasoningEffort,
          },
          store: false,
          instructions: input.instructions,
          input: JSON.stringify(input.payload, null, 2),
          text: {
            format: {
              type: "json_schema",
              name: "recommendation_explanation_pass",
              schema: recommendationExplanationResponseSchema,
              strict: true,
            },
          },
        }),
      });

      return parseRecommendationExplanationResponse(response);
    },
  };
}

export function buildRecommendationExplanationClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch
): RecommendationExplanationClient {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return createRecommendationExplanationClient(
    {
      apiKey,
      model: env.RECOMMENDATION_OPENAI_MODEL?.trim() || "gpt-5-nano",
      reasoningEffort: parseReasoningEffort(
        env.RECOMMENDATION_OPENAI_REASONING_EFFORT
      ),
    },
    fetchImpl
  );
}

export function buildRecommendationExplanationPromptInput(
  context: RecommendationExplanationRunContext
): RecommendationExplanationPromptInput {
  return {
    recommendationRun: context.recommendationRun,
    currentSnapshot: context.currentSnapshot,
    projectedSnapshot: context.projectedSnapshot,
    scoredResults: context.scoredResults,
    schools: context.schools,
  };
}

export async function runRecommendationExplanationPassForRun(input: {
  db: RecommendationExplanationDb;
  recommendationRunId: string;
  client: RecommendationExplanationClient;
}): Promise<PersistedRecommendationExplanationBundle> {
  const context = await loadRecommendationExplanationRunContext(
    input.db,
    input.recommendationRunId
  );

  const modelOutput =
    context.scoredResults.length === 0
      ? emptyRecommendationExplanationOutput(context.recommendationRun.id)
      : validateRecommendationExplanationModelOutput(
          await input.client.generate({
            instructions: recommendationExplanationSystemPrompt,
            payload: buildRecommendationExplanationPromptInput(context),
          }),
          context
        );

  return persistRecommendationExplanationPass(input.db, context, modelOutput, {
    model: input.client.model,
    promptVersion: RECOMMENDATION_EXPLANATION_PROMPT_VERSION,
    systemPrompt: recommendationExplanationSystemPrompt,
  });
}

export async function persistRecommendationExplanationPass(
  db: RecommendationExplanationReadDb,
  context: RecommendationExplanationRunContext,
  output: RecommendationExplanationModelOutput,
  metadata: {
    model: string;
    promptVersion: string;
    systemPrompt: string;
  }
): Promise<PersistedRecommendationExplanationBundle> {
  const orderedResultIds = output.shortlistedRecommendationResultIds;
  const explanationByResultId = new Map(
    output.explanations.map((item) => [item.recommendationResultId, item])
  );

  await db.transaction(async (tx) => {
    const [shortlist] = await tx
      .insert(recommendationShortlists)
      .values({
        recommendationRunId: context.recommendationRun.id,
        model: metadata.model,
        promptVersion: metadata.promptVersion,
        systemPrompt: metadata.systemPrompt,
        shortlistRationale: output.shortlistRationale,
      })
      .returning();

    if (!shortlist) {
      throw new RecommendationExplanationOutputError(
        "Recommendation shortlist persistence failed."
      );
    }

    if (orderedResultIds.length > 0) {
      const explanations = await tx
        .insert(recommendationExplanations)
        .values(
          orderedResultIds.map((recommendationResultId) => {
            const explanation = explanationByResultId.get(
              recommendationResultId
            );

            if (!explanation) {
              throw new RecommendationExplanationOutputError(
                `Missing explanation payload for recommendation result ${recommendationResultId}.`
              );
            }

            return {
              recommendationShortlistId: shortlist.id,
              recommendationResultId,
              whyRecommended: explanation.whyRecommended,
              topBlockers: explanation.topBlockers,
              nextRecommendedActions: explanation.nextRecommendedActions,
              budgetSummary: explanation.budgetSummary,
              assumptionChanges: explanation.assumptionChanges,
              explanationConfidence: explanation.explanationConfidence,
            };
          })
        )
        .returning();

      await tx.insert(recommendationExplanationShortlistItems).values(
        orderedResultIds.map((recommendationResultId, index) => {
          const explanation = explanations.find(
            (entry) => entry.recommendationResultId === recommendationResultId
          );

          if (!explanation) {
            throw new RecommendationExplanationOutputError(
              `Missing persisted explanation for recommendation result ${recommendationResultId}.`
            );
          }

          return {
            recommendationExplanationId: explanation.id,
            recommendationResultId,
            rankOrder: index + 1,
          };
        })
      );
    }
  });

  const bundle = await getPersistedRecommendationExplanationBundle(
    db,
    context.recommendationRun.id
  );

  if (!bundle) {
    throw new RecommendationExplanationOutputError(
      "Recommendation explanation persistence completed without a readable bundle."
    );
  }

  return bundle;
}

function parseRecommendationExplanationResponse(response: Response) {
  return response.text().then((responseText) => {
    if (!response.ok) {
      throw new Error(
        `OpenAI Responses API request failed with HTTP ${response.status}: ${responseText}`
      );
    }

    let payload: OpenAiResponseBody;
    try {
      payload = JSON.parse(responseText) as OpenAiResponseBody;
    } catch {
      throw new Error("OpenAI Responses API returned a non-JSON response.");
    }

    if (payload.status === "failed") {
      throw new Error(
        payload.error?.message ?? "OpenAI Responses API request failed."
      );
    }

    const outputText = readOutputText(payload);
    if (!outputText) {
      throw new Error(
        "OpenAI Responses API returned no structured text output."
      );
    }

    try {
      return JSON.parse(outputText) as RecommendationExplanationModelOutput;
    } catch {
      throw new Error("OpenAI Responses API output was not valid JSON.");
    }
  });
}

function readOutputText(body: OpenAiResponseBody) {
  for (const item of body.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

function validateRecommendationExplanationModelOutput(
  output: RecommendationExplanationModelOutput,
  context: RecommendationExplanationRunContext
): RecommendationExplanationModelOutput {
  if (output.recommendationRunId !== context.recommendationRun.id) {
    throw new RecommendationExplanationOutputError(
      `Recommendation run id ${output.recommendationRunId} does not match the requested run ${context.recommendationRun.id}.`
    );
  }

  const allowedResultIds = new Set(
    context.scoredResults.map((result) => result.id)
  );
  const shortlistIds = output.shortlistedRecommendationResultIds;

  if (context.scoredResults.length > 0 && shortlistIds.length === 0) {
    throw new RecommendationExplanationOutputError(
      "The explanation pass must shortlist at least one school when scored results exist."
    );
  }

  if (shortlistIds.length > RECOMMENDATION_SHORTLIST_MAX_COUNT) {
    throw new RecommendationExplanationOutputError(
      `The explanation pass may shortlist at most ${RECOMMENDATION_SHORTLIST_MAX_COUNT} schools.`
    );
  }

  assertUniqueStrings(shortlistIds, "shortlistedRecommendationResultIds");
  assertStringArray(output.shortlistRationale, "shortlistRationale");

  for (const resultId of shortlistIds) {
    if (!allowedResultIds.has(resultId)) {
      throw new RecommendationExplanationOutputError(
        `Recommendation result ${resultId} is not part of the scored result set.`
      );
    }
  }

  if (output.explanations.length !== shortlistIds.length) {
    throw new RecommendationExplanationOutputError(
      "Every shortlisted school must have exactly one explanation payload."
    );
  }

  const explanationIds = output.explanations.map(
    (explanation) => explanation.recommendationResultId
  );
  assertUniqueStrings(explanationIds, "explanations.recommendationResultId");

  for (const explanation of output.explanations) {
    if (!allowedResultIds.has(explanation.recommendationResultId)) {
      throw new RecommendationExplanationOutputError(
        `Explanation result ${explanation.recommendationResultId} is not part of the scored result set.`
      );
    }

    assertStringArray(explanation.whyRecommended, "whyRecommended");
    assertStringArray(explanation.topBlockers, "topBlockers");
    assertStringArray(
      explanation.nextRecommendedActions,
      "nextRecommendedActions"
    );
    assertStringArray(explanation.budgetSummary, "budgetSummary");
    assertStringArray(explanation.assumptionChanges, "assumptionChanges");
  }

  for (const shortlistId of shortlistIds) {
    if (!explanationIds.includes(shortlistId)) {
      throw new RecommendationExplanationOutputError(
        `Missing explanation payload for shortlisted recommendation result ${shortlistId}.`
      );
    }
  }

  return {
    ...output,
    explanations: shortlistIds.map((resultId) => {
      const explanation = output.explanations.find(
        (entry) => entry.recommendationResultId === resultId
      );

      if (!explanation) {
        throw new RecommendationExplanationOutputError(
          `Missing explanation payload for shortlisted recommendation result ${resultId}.`
        );
      }

      return explanation;
    }),
  };
}

function emptyRecommendationExplanationOutput(
  recommendationRunId: string
): RecommendationExplanationModelOutput {
  return {
    recommendationRunId,
    shortlistedRecommendationResultIds: [],
    shortlistRationale: [],
    explanations: [],
  };
}

function assertUniqueStrings(values: string[], fieldName: string) {
  assertStringArray(values, fieldName);

  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new RecommendationExplanationOutputError(
        `Duplicate value found in ${fieldName}: ${value}`
      );
    }

    seen.add(value);
  }
}

function assertStringArray(values: unknown, fieldName: string) {
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== "string")
  ) {
    throw new RecommendationExplanationOutputError(
      `Field ${fieldName} must be an array of strings.`
    );
  }
}

function parseReasoningEffort(
  value: string | undefined
): OpenAiReasoningEffort {
  if (!value) {
    return "low";
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "minimal" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }

  throw new Error(
    `Invalid RECOMMENDATION_OPENAI_REASONING_EFFORT value: ${value}`
  );
}
