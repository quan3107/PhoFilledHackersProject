import { z } from "zod";

import { intakeFieldPathSchema } from "./intake.js";

export const llmIntakeResolutionSchema = z.object({
  path: intakeFieldPathSchema,
  resolution: z.enum(["filled", "needs_clarification", "unknown", "declined"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export type LlmIntakeResolution = z.infer<typeof llmIntakeResolutionSchema>;
