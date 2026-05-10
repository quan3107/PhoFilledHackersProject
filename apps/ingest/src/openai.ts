// apps/ingest/src/openai.ts
// OpenAI Responses API wrapper for the runner's extraction step.
// Uses structured JSON output via direct fetch so the model result stays machine-readable.

import type {
  BrightDataPage,
  OpenAiExtractionClient,
  SchoolExtractionDraft,
  SeedSchool,
} from "./types.js";

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

const extractionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "identity",
    "applicationRounds",
    "deadlinesByRound",
    "englishRequirements",
    "testPolicy",
    "requiredMaterials",
    "tuitionAnnualUsd",
    "estimatedCostOfAttendanceUsd",
    "livingCostEstimateUsd",
    "scholarshipAvailabilityFlag",
    "scholarshipNotes",
    "recommendationInputs",
    "explanationInputs",
  ],
  properties: {
    identity: {
      type: "object",
      additionalProperties: false,
      required: ["schoolName", "city", "state", "officialAdmissionsUrl"],
      properties: {
        schoolName: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        officialAdmissionsUrl: { type: "string" },
      },
    },
    applicationRounds: {
      type: "array",
      items: { type: "string" },
    },
    deadlinesByRound: {
      type: "object",
      additionalProperties: false,
      required: [
        "early_action",
        "early_decision",
        "regular_decision",
        "rolling_admission",
        "priority",
      ],
      properties: {
        early_action: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        early_decision: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        regular_decision: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        rolling_admission: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        priority: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    },
    englishRequirements: {
      type: "object",
      additionalProperties: false,
      required: ["minimumIelts", "minimumToeflInternetBased", "waiverNotes"],
      properties: {
        minimumIelts: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        minimumToeflInternetBased: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        waiverNotes: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
      },
    },
    testPolicy: { type: "string" },
    requiredMaterials: {
      type: "array",
      items: { type: "string" },
    },
    tuitionAnnualUsd: {
      anyOf: [{ type: "number" }, { type: "string" }],
    },
    estimatedCostOfAttendanceUsd: {
      anyOf: [{ type: "number" }, { type: "string" }],
    },
    livingCostEstimateUsd: {
      anyOf: [{ type: "number" }, { type: "string" }],
    },
    scholarshipAvailabilityFlag: {
      anyOf: [{ type: "boolean" }, { type: "string" }],
    },
    scholarshipNotes: { type: "string" },
    recommendationInputs: {
      type: "object",
      additionalProperties: false,
      required: [
        "admissionRateOverall",
        "satAverageOverall",
        "actMidpointCumulative",
        "undergraduateSize",
        "averageNetPriceUsd",
        "schoolControl",
        "campusLocale",
        "internationalAidPolicy",
        "hasNeedBasedAid",
        "hasMeritAid",
        "programFitTags",
        "programAdmissionModel",
        "applicationStrategyTags",
        "testingRequirements",
      ],
      properties: {
        admissionRateOverall: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        satAverageOverall: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        actMidpointCumulative: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        undergraduateSize: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        averageNetPriceUsd: {
          anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
        },
        schoolControl: { type: "string" },
        campusLocale: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        internationalAidPolicy: { type: "string" },
        hasNeedBasedAid: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        hasMeritAid: {
          anyOf: [{ type: "boolean" }, { type: "null" }],
        },
        programFitTags: {
          type: "array",
          items: { type: "string" },
        },
        programAdmissionModel: { type: "string" },
        applicationStrategyTags: {
          type: "array",
          items: { type: "string" },
        },
        testingRequirements: {
          type: "object",
          additionalProperties: false,
          required: [
            "acceptedExams",
            "minimumSatTotal",
            "minimumActComposite",
            "latestSatTestDateNote",
            "latestActTestDateNote",
            "superscorePolicy",
            "writingEssayPolicy",
            "scoreReportingPolicy",
            "middle50SatTotal",
            "middle50ActComposite",
          ],
          properties: {
            acceptedExams: {
              type: "array",
              items: { type: "string" },
            },
            minimumSatTotal: {
              anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
            },
            minimumActComposite: {
              anyOf: [{ type: "number" }, { type: "string" }, { type: "null" }],
            },
            latestSatTestDateNote: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            latestActTestDateNote: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            superscorePolicy: { type: "string" },
            writingEssayPolicy: { type: "string" },
            scoreReportingPolicy: { type: "string" },
            middle50SatTotal: {
              type: "object",
              additionalProperties: false,
              required: ["low", "high"],
              properties: {
                low: {
                  anyOf: [
                    { type: "number" },
                    { type: "string" },
                    { type: "null" },
                  ],
                },
                high: {
                  anyOf: [
                    { type: "number" },
                    { type: "string" },
                    { type: "null" },
                  ],
                },
              },
            },
            middle50ActComposite: {
              type: "object",
              additionalProperties: false,
              required: ["low", "high"],
              properties: {
                low: {
                  anyOf: [
                    { type: "number" },
                    { type: "string" },
                    { type: "null" },
                  ],
                },
                high: {
                  anyOf: [
                    { type: "number" },
                    { type: "string" },
                    { type: "null" },
                  ],
                },
              },
            },
          },
        },
      },
    },
    explanationInputs: {
      type: "object",
      additionalProperties: false,
      required: [
        "academicSelectivityBand",
        "testingExpectation",
        "englishPolicySummary",
        "aidModel",
        "applicationComplexity",
        "deadlineUrgencyWindows",
        "internationalStudentConsiderations",
        "potentialFitTags",
        "potentialRiskTags",
        "actionableApplicationSteps",
      ],
      properties: {
        academicSelectivityBand: { type: "string" },
        testingExpectation: { type: "string" },
        englishPolicySummary: { type: "string" },
        aidModel: { type: "string" },
        applicationComplexity: { type: "string" },
        deadlineUrgencyWindows: {
          type: "object",
          additionalProperties: false,
          required: ["earliestDeadline", "latestMajorDeadline"],
          properties: {
            earliestDeadline: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
            latestMajorDeadline: {
              anyOf: [{ type: "string" }, { type: "null" }],
            },
          },
        },
        internationalStudentConsiderations: {
          type: "array",
          items: { type: "string" },
        },
        potentialFitTags: {
          type: "array",
          items: { type: "string" },
        },
        potentialRiskTags: {
          type: "array",
          items: { type: "string" },
        },
        actionableApplicationSteps: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
} as const;

function truncateBody(body: string, limit = 12000) {
  return body.length <= limit ? body : `${body.slice(0, limit)}\n[truncated]`;
}

function buildInputPrompt(school: SeedSchool, pages: BrightDataPage[]) {
  return JSON.stringify(
    {
      school,
      pages: pages.map((page) => ({
        sourceKind: page.sourceKind,
        sourceUrl: page.sourceUrl,
        statusCode: page.statusCode,
        body: truncateBody(page.body),
      })),
    },
    null,
    2
  );
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

async function parseOpenAiResponse(response: Response) {
  const responseText = await response.text();
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
    throw new Error("OpenAI Responses API returned no structured text output.");
  }

  try {
    return JSON.parse(outputText) as SchoolExtractionDraft;
  } catch {
    throw new Error("OpenAI Responses API output was not valid JSON.");
  }
}

export function createOpenAiExtractionClient(
  input: {
    apiKey: string;
    model: string;
    reasoningEffort: "minimal" | "low" | "medium" | "high" | "xhigh";
    endpoint?: string;
  },
  fetchImpl: typeof fetch = fetch
): OpenAiExtractionClient {
  const endpoint = input.endpoint ?? "https://api.openai.com/v1/responses";

  return {
    async extractSchoolDraft({ school, pages }) {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.model,
          reasoning: {
            effort: input.reasoningEffort,
          },
          store: false,
          instructions: [
            `Extract the school profile for ${school.schoolName} from the provided official pages.`,
            "Return only valid JSON that matches the supplied schema.",
            "Do not invent facts or sources.",
            "Populate recommendationInputs and explanationInputs with structured enums or tags only.",
            "Include recommendationInputs.averageNetPriceUsd when College Scorecard or an official aid source provides it.",
            "Use recommendationInputs.programFitTags only for broad school-level academic domains clearly supported by official pages, not ranking-based claims.",
            "Use recommendationInputs.programAdmissionModel and applicationStrategyTags to capture direct-admit, separate-school, portfolio, binding, restrictive, or rolling nuances when the school states them.",
            "Include recommendationInputs.testingRequirements with exam-specific rules, minimums if any, reporting policy, and middle-50 ranges when sourced.",
            "Do not write recommendation prose or freeform summaries.",
          ].join(" "),
          input: buildInputPrompt(school, pages),
          text: {
            format: {
              type: "json_schema",
              name: "school_profile_extraction",
              schema: extractionSchema,
              strict: true,
            },
          },
        }),
      });

      return parseOpenAiResponse(response);
    },
  };
}
