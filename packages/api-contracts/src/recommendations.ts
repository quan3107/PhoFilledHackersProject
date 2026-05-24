import { z } from "zod";

export const recommendationTiers = ["reach", "target", "safety"] as const;
export const recommendationOutlooks = [
  "very_strong",
  "strong",
  "possible",
  "stretch",
  "unlikely",
] as const;
export const budgetFits = [
  "comfortable",
  "stretch",
  "high_risk",
  "unknown",
] as const;
export const deadlinePressures = ["low", "medium", "high"] as const;
export const confidenceLevels = ["low", "medium", "high"] as const;

export const recommendationTierSchema = z.enum(recommendationTiers);
export const recommendationOutlookSchema = z.enum(recommendationOutlooks);
export const budgetFitSchema = z.enum(budgetFits);
export const deadlinePressureSchema = z.enum(deadlinePressures);
export const confidenceLevelSchema = z.enum(confidenceLevels);

export type RecommendationTier = z.infer<typeof recommendationTierSchema>;
export type RecommendationOutlook = z.infer<typeof recommendationOutlookSchema>;
export type BudgetFit = z.infer<typeof budgetFitSchema>;
export type DeadlinePressure = z.infer<typeof deadlinePressureSchema>;
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
