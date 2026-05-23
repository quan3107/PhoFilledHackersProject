import { z } from "zod";

import { studentProfileInputSchema } from "./profile.js";

export const profilePutRequestSchema = z.object({
  currentProfile: studentProfileInputSchema,
  projectedProfile: studentProfileInputSchema,
  currentAssumptions: z.array(z.string().trim().min(1).max(240)).max(50),
  projectedAssumptions: z.array(z.string().trim().min(1).max(240)).max(50),
});

export const apiErrorCodeSchema = z.enum([
  "unauthorized",
  "invalid_request",
  "dependency_unavailable",
  "model_output_invalid",
  "recommendation_not_ready",
  "internal_error",
]);

export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
  }),
});

export type ProfilePutRequest = z.infer<typeof profilePutRequestSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
