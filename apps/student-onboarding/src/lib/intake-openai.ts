// apps/student-onboarding/src/lib/intake-openai.ts
// OpenAI Responses API wrapper for the LLM-driven onboarding intake flow.
// Keeps the model call bounded to strict JSON output and a small server-side surface.

import type { IntakeFieldPath } from "@/lib/intake-fields";

export interface IntakeTurnResolution {
  path: IntakeFieldPath;
  status: "filled" | "unknown" | "declined" | "needs_clarification";
  note: string | null;
}

export interface IntakeTurnModelOutput {
  assistantMessage: string;
  currentProfilePatch: Record<string, unknown>;
  projectedProfilePatch: Record<string, unknown>;
  projectedAssumptions: string[] | null;
  resolutions: IntakeTurnResolution[];
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

const profilePatchSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "citizenshipCountry",
    "targetEntryTerm",
    "academic",
    "testing",
    "preferences",
    "budget",
    "readiness",
  ],
  properties: {
    citizenshipCountry: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    targetEntryTerm: {
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    academic: {
      type: "object",
      additionalProperties: false,
      required: [
        "currentGpa100",
        "projectedGpa100",
        "curriculumStrength",
        "classRankPercent",
      ],
      properties: {
        currentGpa100: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        projectedGpa100: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        curriculumStrength: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        classRankPercent: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
      },
    },
    testing: {
      type: "object",
      additionalProperties: false,
      required: [
        "satTotal",
        "actComposite",
        "englishExamType",
        "englishExamScore",
        "willSubmitTests",
      ],
      properties: {
        satTotal: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        actComposite: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        englishExamType: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        englishExamScore: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        willSubmitTests: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
      },
    },
    preferences: {
      type: "object",
      additionalProperties: false,
      required: [
        "intendedMajors",
        "preferredStates",
        "preferredLocationPreferences",
        "preferredCampusLocale",
        "preferredSchoolControl",
        "preferredUndergraduateSize",
      ],
      properties: {
        intendedMajors: {
          anyOf: [
            { type: "array", items: { type: "string" } },
            { type: "null" },
          ],
        },
        preferredStates: {
          anyOf: [
            { type: "array", items: { type: "string" } },
            { type: "null" },
          ],
        },
        preferredLocationPreferences: {
          anyOf: [
            { type: "array", items: { type: "string" } },
            { type: "null" },
          ],
        },
        preferredCampusLocale: {
          anyOf: [
            { type: "array", items: { type: "string" } },
            { type: "null" },
          ],
        },
        preferredSchoolControl: {
          anyOf: [
            { type: "array", items: { type: "string" } },
            { type: "null" },
          ],
        },
        preferredUndergraduateSize: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    },
    budget: {
      type: "object",
      additionalProperties: false,
      required: [
        "annualBudgetUsd",
        "needsFinancialAid",
        "needsMeritAid",
        "budgetFlexibility",
      ],
      properties: {
        annualBudgetUsd: {
          anyOf: [{ type: "number" }, { type: "null" }],
        },
        needsFinancialAid: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        needsMeritAid: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        budgetFlexibility: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    },
    readiness: {
      type: "object",
      additionalProperties: false,
      required: [
        "wantsEarlyRound",
        "hasTeacherRecommendationsReady",
        "hasCounselorDocumentsReady",
        "hasEssayDraftsStarted",
      ],
      properties: {
        wantsEarlyRound: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        hasTeacherRecommendationsReady: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        hasCounselorDocumentsReady: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        hasEssayDraftsStarted: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
      },
    },
  },
} as const;

const intakeTurnResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "assistantMessage",
    "currentProfilePatch",
    "projectedProfilePatch",
    "projectedAssumptions",
    "resolutions",
  ],
  properties: {
    assistantMessage: { type: "string" },
    currentProfilePatch: profilePatchSchema,
    projectedProfilePatch: profilePatchSchema,
    projectedAssumptions: {
      anyOf: [{ type: "array", items: { type: "string" } }, { type: "null" }],
    },
    resolutions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "status", "note"],
        properties: {
          path: { type: "string" },
          status: {
            type: "string",
            enum: ["filled", "unknown", "declined", "needs_clarification"],
          },
          note: {
            anyOf: [{ type: "string" }, { type: "null" }],
          },
        },
      },
    },
  },
} as const;

function readOutputText(body: OpenAiResponseBody) {
  for (const item of body.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const part of item.content ?? []) {
      if (part.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }

  return null;
}

export function createIntakeOpenAiClient(fetchImpl: typeof fetch = fetch) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY.");
  }

  return {
    async generate(input: {
      instructions: string;
      prompt: string;
    }): Promise<{ output: IntakeTurnModelOutput; responseId: string | null }> {
      const response = await fetchImpl("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ONBOARDING_OPENAI_MODEL?.trim() || "gpt-5.4-nano",
          reasoning: {
            effort:
              process.env.ONBOARDING_OPENAI_REASONING_EFFORT?.trim() ||
              "medium",
          },
          store: false,
          instructions: input.instructions,
          input: input.prompt,
          text: {
            format: {
              type: "json_schema",
              name: "student_onboarding_intake_turn",
              schema: intakeTurnResponseSchema,
              strict: true,
            },
          },
        }),
      });

      const body = (await response
        .json()
        .catch(() => null)) as OpenAiResponseBody | null;

      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "OpenAI intake request failed."
        );
      }

      const text = body ? readOutputText(body) : null;
      if (!text) {
        throw new Error(
          "OpenAI intake response did not include JSON output text."
        );
      }

      const parsed = JSON.parse(text) as IntakeTurnModelOutput;
      return {
        output: parsed,
        responseId:
          body && typeof (body as { id?: unknown }).id === "string"
            ? (body as { id: string }).id
            : null,
      };
    },
  };
}
