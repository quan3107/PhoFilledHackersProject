# Recommendation Layer

This document defines the next branches and canonical data shapes for the recommendation layer after the catalog data foundation branch. It assumes Bright Data is no longer part of the product path. The canonical flow is now:

`curated catalog -> review -> publish -> profile -> shortlist -> score -> explain -> serve`

## Principles

- Recommendations must read only from stored catalog rows marked `publishable`.
- The deterministic engine chooses candidate schools and score breakdowns.
- The LLM explains and clarifies shortlisted results. It does not invent schools or facts.
- Recommendation outputs must stay reproducible from stored profile data, published catalog data, and persisted run results.

## Branch Order

1. `feat/catalog-review-surface`
2. `feat/recommendation-student-profile-schema`
3. `feat/recommendation-catalog-read-path`
4. `feat/recommendation-engine-v1`
5. `feat/recommendation-llm-explanation-layer`
6. `feat/recommendation-api-contracts`

## Existing School-Side Inputs

These already exist in the catalog and are sufficient for a first recommendation engine:

- Core admissions and cost fields on `universities`
- `recommendationInputs`
- `explanationInputs`
- source provenance on `university_sources`
- publishability state via `validationStatus`

The school-side catalog already supports:

- admissions selectivity proxies
- testing policy and structured testing requirements
- tuition, cost of attendance, and living cost
- coarse aid model and international aid policy
- school-level academic-domain fit tags
- explanation-ready risk and action tags

## Branch 1: `feat/catalog-review-surface`

### Purpose

Give internal reviewers a minimal QA surface to inspect schools and decide whether a row should be recommendation-eligible.

### Scope

- school review page
- source list
- validation status
- `last_verified_at`
- missing-field display
- publish and unpublish actions

### Data Shapes

```ts
type CatalogReviewRecord = {
  universityId: string;
  schoolName: string;
  city: string;
  state: string;
  validationStatus: "draft" | "publishable" | "rejected";
  validationReasons: Array<{
    code: "missing_required_field" | "missing_source_provenance";
    field: string;
    message: string;
  }>;
  lastVerifiedAt: string;
  sourceCount: number;
  missingRequiredFields: string[];
};

type PublishAction = {
  universityId: string;
  action: "publish" | "unpublish";
  reviewerNote?: string;
};

type PublishActionResult = {
  universityId: string;
  validationStatus: "draft" | "publishable" | "rejected";
  published: boolean;
};
```

### Acceptance

- reviewer can inspect one school
- reviewer can publish or unpublish
- only published rows become recommendation-eligible

## Branch 2: `feat/recommendation-student-profile-schema`

### Purpose

Define the structured student profile used by the deterministic engine and support current vs projected profile states.

### New Entities

- `student_profiles`
- `student_profile_snapshots`

### Data Shapes

```ts
type StudentAcademicProfile = {
  currentGpa100: number | null;
  projectedGpa100: number | null;
  curriculumStrength: "baseline" | "rigorous" | "most_rigorous" | "unknown";
  classRankPercent: number | null;
};

type StudentTestingProfile = {
  satTotal: number | null;
  actComposite: number | null;
  englishExamType: "ielts" | "toefl" | "duolingo" | "none" | "unknown";
  englishExamScore: number | null;
  willSubmitTests: boolean | null;
};

type StudentPreferenceProfile = {
  intendedMajors: string[];
  preferredStates: string[];
  preferredCampusLocale: string[];
  preferredSchoolControl: Array<"public" | "private_nonprofit">;
  preferredUndergraduateSize: "small" | "medium" | "large" | "unknown";
};

type StudentBudgetProfile = {
  annualBudgetUsd: number | null;
  needsFinancialAid: boolean | null;
  needsMeritAid: boolean | null;
  budgetFlexibility: "low" | "medium" | "high" | "unknown";
};

type StudentReadinessProfile = {
  wantsEarlyRound: boolean | null;
  hasTeacherRecommendationsReady: boolean | null;
  hasCounselorDocumentsReady: boolean | null;
  hasEssayDraftsStarted: boolean | null;
};

type StudentProfile = {
  id: string;
  userId: string;
  citizenshipCountry: string;
  targetEntryTerm: string;
  academic: StudentAcademicProfile;
  testing: StudentTestingProfile;
  preferences: StudentPreferenceProfile;
  budget: StudentBudgetProfile;
  readiness: StudentReadinessProfile;
  createdAt: string;
  updatedAt: string;
};

type StudentProfileSnapshot = {
  id: string;
  studentProfileId: string;
  snapshotKind: "current" | "projected";
  assumptions: string[];
  profile: StudentProfile;
  createdAt: string;
};
```

### Acceptance

- app can persist one canonical student profile
- app can persist a current snapshot and a projected snapshot
- missing profile fields are explicit before a recommendation run starts

## Branch 3: `feat/recommendation-catalog-read-path`

### Purpose

Force recommendations to read only from published catalog rows and keep raw import tables out of the recommendation path.

### Read Model

```ts
type RecommendationCandidateSchool = {
  universityId: string;
  schoolName: string;
  city: string;
  state: string;
  lastVerifiedAt: string;
  tuitionAnnualUsd: number;
  estimatedCostOfAttendanceUsd: number;
  livingCostEstimateUsd: number;
  scholarshipAvailabilityFlag: boolean;
  scholarshipNotes: string;
  recommendationInputs: UniversityRecommendationInputs;
  explanationInputs: UniversityExplanationInputs;
};
```

### Rules

- exclude `draft`
- exclude `rejected`
- exclude unpublished rows
- never read raw import tables in recommendation queries

### Acceptance

- recommendation selector only receives published candidate schools
- unpublished schools never enter shortlist or scoring paths

## Branch 4: `feat/recommendation-engine-v1`

### Purpose

Implement the deterministic scoring engine and persist recommendation runs and per-school results.

### New Entities

- `recommendation_runs`
- `recommendation_results`

### Data Shapes

```ts
type RecommendationRunStatus = "pending" | "succeeded" | "failed";

type RecommendationRun = {
  id: string;
  userId: string;
  studentProfileId: string;
  currentSnapshotId: string;
  projectedSnapshotId: string | null;
  runStatus: RecommendationRunStatus;
  missingProfileFields: string[];
  candidateSchoolCount: number;
  createdAt: string;
  finishedAt: string | null;
};

type ScoreComponentBreakdown = {
  admissionFit: number;
  readinessFit: number;
  budgetFit: number;
  preferenceFit: number;
  improvementUpside: number;
};

type RecommendationTier = "reach" | "target" | "safety";

type OutlookLabel =
  | "very_strong"
  | "strong"
  | "possible"
  | "stretch"
  | "unlikely";

type BudgetFitLabel = "comfortable" | "stretch" | "high_risk" | "unknown";

type DeadlinePressureLabel = "low" | "medium" | "high";

type RecommendationResult = {
  id: string;
  recommendationRunId: string;
  universityId: string;
  tier: RecommendationTier;
  currentOutlook: OutlookLabel;
  projectedOutlook: OutlookLabel | null;
  confidenceLevel: "low" | "medium" | "high";
  budgetFit: BudgetFitLabel;
  deadlinePressure: DeadlinePressureLabel;
  currentScore: number;
  projectedScore: number | null;
  currentScoreBreakdown: ScoreComponentBreakdown;
  projectedScoreBreakdown: ScoreComponentBreakdown | null;
  projectedAssumptionDelta: string[];
  rankOrder: number;
  createdAt: string;
};
```

### Scoring Dimensions

- Admission Fit
- Readiness Fit
- Budget Fit
- Preference Fit
- Improvement Upside

### Acceptance

- one run produces persisted per-school results
- each result has structured score breakdowns
- results group into Reach / Target / Safety
- current and projected outlook remain separate and explainable

## Branch 5: `feat/recommendation-llm-explanation-layer`

### Purpose

Use an LLM only after deterministic scoring has finished, and require it to
turn stored scored results into a bounded shortlist plus explanation content.

### Canonical Role Of The LLM

The LLM must:

- read stored student profile snapshots
- read stored candidate school data
- read stored recommendation results
- produce a shortlist from the stored scored results
- produce explanation content only for shortlisted schools

The LLM must not:

- choose from the full catalog without deterministic pre-filtering
- invent school facts
- guarantee admissions
- guarantee scholarships

### Shortlist Role

The shortlist step in this branch should be LLM-assisted but still grounded in
stored recommendation data:

- input must come from persisted recommendation results, persisted profile snapshots, and stored candidate school rows
- the LLM may interpret stored scores, tier labels, budget fit, deadline pressure, and projected deltas to decide which schools should appear in the final shortlist
- the LLM must not pull in schools outside the deterministic scored result set
- the shortlist must stay reproducible from the stored run inputs and stored model prompt

### Additional Input Shape

```ts
type RecommendationShortlistInput = {
  currentSnapshot: StudentProfileSnapshot;
  projectedSnapshot: StudentProfileSnapshot | null;
  scoredResults: RecommendationResult[];
  schools: RecommendationCandidateSchool[];
};

type RecommendationShortlist = {
  recommendationRunId: string;
  shortlistedRecommendationResultIds: string[];
  shortlistRationale: string[];
};
```

### Input Shape

```ts
type RecommendationExplanationInput = {
  studentProfileSnapshot: StudentProfileSnapshot;
  recommendationResult: RecommendationResult;
  school: RecommendationCandidateSchool;
};
```

### Output Shape

```ts
type RecommendationExplanation = {
  recommendationResultId: string;
  whyRecommended: string[];
  topBlockers: string[];
  nextRecommendedActions: string[];
  budgetSummary: string[];
  assumptionChanges: string[];
  explanationConfidence: "low" | "medium" | "high";
};
```

### Prompting Rules

- consume supplied JSON only
- return JSON only
- use stored catalog facts and stored score outputs only
- if data is missing, say it is missing
- keep output list-shaped and structured, not essay-like

### Required System Prompt

Branch 5 must include a checked-in system prompt for the LLM shortlist and explanation pass.
That prompt must instruct the model to:

- shortlist schools only from the provided scored results
- treat deterministic scores and labels as the primary ranking signal
- use stored profile data and stored catalog facts to break ties or trim the shortlist
- prefer schools with strong overall fit, acceptable budget risk, and clear next actions
- keep Reach / Target / Safety representation visible when supported by the scored set
- explain why each shortlisted school survived the cut and why excluded schools were not selected when asked
- never invent new schools, new facts, or new numeric scores
- return one structured JSON object containing both shortlist ids and explanation content

### Acceptance

- branch includes a checked-in system prompt for shortlist plus explanation generation
- LLM can produce a bounded shortlist from stored scored results only
- every recommendation card can show structured, reproducible explanations
- explanation content remains bounded to stored facts and scores

## Branch 6: `feat/recommendation-api-contracts`

### Purpose

Define stable request and response shapes for the recommendation UI and chat assistant.

### Data Shapes

```ts
type GenerateRecommendationsRequest = {
  studentProfileId: string;
  includeProjected: boolean;
};

type GenerateRecommendationsResponse = {
  recommendationRunId: string;
  status: "pending" | "succeeded" | "failed";
};

type RecommendationCardResponse = {
  universityId: string;
  schoolName: string;
  city: string;
  state: string;
  tier: "reach" | "target" | "safety";
  currentOutlook: string;
  projectedOutlook: string | null;
  confidenceLevel: string;
  budgetFit: string;
  deadlinePressure: string;
  whyRecommended: string[];
  topBlockers: string[];
  nextRecommendedActions: string[];
  tuitionAnnualUsd: number;
  estimatedCostOfAttendanceUsd: number;
  scholarshipAvailabilityFlag: boolean;
  lastVerifiedAt: string;
};
```

### Acceptance

- frontend consumes one stable recommendation contract
- chat assistant consumes the same stored recommendation result shapes
- the client never computes recommendation results independently

## Recommended Engine Architecture

The recommendation layer should follow this exact shape:

1. `student profile -> deterministic retrieval`
2. `deterministic retrieval -> deterministic scoring`
3. `deterministic scoring -> persisted recommendation results`
4. `persisted recommendation results -> LLM explanation`
5. `stored results + stored explanations -> UI and chat`

This keeps the system transparent and debuggable while still allowing LLM-powered explanation quality.

## Explicit Non-Goals For V1 Recommendation Logic

- web scraping or live-fetch at recommendation time
- unconstrained model-based school selection
- per-major admissions probability modeling
- financial aid guarantees or precise net-price forecasting
- client-side-only recommendation logic

## Summary

The current catalog foundation is already strong enough for recommendation work. The missing pieces are:

- reviewer publish control
- structured student profile storage
- persisted recommendation runs and result rows
- an LLM explanation layer that operates only on stored shortlist and score data

That is the narrowest branch sequence that keeps the product path canonical and supports a trustworthy recommendation experience.
