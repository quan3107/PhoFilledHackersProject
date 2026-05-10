// apps/student-onboarding/src/lib/intake-fields.ts
// Canonical intake field registry for the LLM-driven onboarding flow.
// Keeps question priority, user-facing explanations, and field ordering in one shared place.

export const intakeFieldPaths = [
  "citizenshipCountry",
  "targetEntryTerm",
  "academic.currentGpa100",
  "academic.projectedGpa100",
  "academic.curriculumStrength",
  "academic.classRankPercent",
  "testing.willSubmitTests",
  "testing.satTotal",
  "testing.actComposite",
  "testing.englishExamType",
  "testing.englishExamScore",
  "preferences.intendedMajors",
  "preferences.preferredStates",
  "preferences.preferredLocationPreferences",
  "preferences.preferredCampusLocale",
  "preferences.preferredSchoolControl",
  "preferences.preferredUndergraduateSize",
  "budget.annualBudgetUsd",
  "budget.needsFinancialAid",
  "budget.needsMeritAid",
  "budget.budgetFlexibility",
  "readiness.wantsEarlyRound",
  "readiness.hasTeacherRecommendationsReady",
  "readiness.hasCounselorDocumentsReady",
  "readiness.hasEssayDraftsStarted",
  "projected.assumptions",
] as const;

export type IntakeFieldPath = (typeof intakeFieldPaths)[number];

export interface IntakeFieldDefinition {
  path: IntakeFieldPath;
  label: string;
  priority: number;
  recommendationCritical: boolean;
  whyItMatters: string;
  answerHint: string;
}

export const intakeFieldDefinitions: IntakeFieldDefinition[] = [
  {
    path: "citizenshipCountry",
    label: "Citizenship country",
    priority: 10,
    recommendationCritical: true,
    whyItMatters:
      "Citizenship changes admissions context, testing, and aid expectations.",
    answerHint: "A country name such as Vietnam or Canada.",
  },
  {
    path: "targetEntryTerm",
    label: "Target entry term",
    priority: 20,
    recommendationCritical: true,
    whyItMatters:
      "Application timing changes deadlines and readiness pressure.",
    answerHint: "A term like Fall 2027 or Spring 2028.",
  },
  {
    path: "academic.currentGpa100",
    label: "Current GPA",
    priority: 30,
    recommendationCritical: true,
    whyItMatters: "Academic fit is one of the strongest recommendation inputs.",
    answerHint: "A GPA on any common scale such as 3.8/4.0, 8.8/10, or 92/100.",
  },
  {
    path: "academic.curriculumStrength",
    label: "Curriculum strength",
    priority: 40,
    recommendationCritical: true,
    whyItMatters: "Course rigor affects how schools interpret GPA.",
    answerHint:
      "Examples: baseline, rigorous, most rigorous, IB, AP, A-Levels.",
  },
  {
    path: "academic.classRankPercent",
    label: "Class rank percentile",
    priority: 50,
    recommendationCritical: true,
    whyItMatters:
      "Class rank helps calibrate academic standing when available.",
    answerHint: "A percentile such as top 10% or 15.",
  },
  {
    path: "testing.willSubmitTests",
    label: "Test submission intent",
    priority: 60,
    recommendationCritical: true,
    whyItMatters:
      "Recommendations need to know whether test scores will be part of the application.",
    answerHint: "Yes or no.",
  },
  {
    path: "testing.satTotal",
    label: "SAT score",
    priority: 70,
    recommendationCritical: true,
    whyItMatters:
      "A submitted SAT score affects academic fit and shortlist calibration.",
    answerHint: "A total score such as 1450.",
  },
  {
    path: "testing.actComposite",
    label: "ACT score",
    priority: 80,
    recommendationCritical: true,
    whyItMatters:
      "A submitted ACT score affects academic fit and shortlist calibration.",
    answerHint: "A composite score such as 32.",
  },
  {
    path: "testing.englishExamType",
    label: "English exam type",
    priority: 90,
    recommendationCritical: true,
    whyItMatters:
      "International English testing affects admissibility for many schools.",
    answerHint: "IELTS, TOEFL, Duolingo, none, or unknown.",
  },
  {
    path: "testing.englishExamScore",
    label: "English exam score",
    priority: 100,
    recommendationCritical: true,
    whyItMatters:
      "English score thresholds can block otherwise strong candidates.",
    answerHint: "A score like IELTS 7.5 or TOEFL 100.",
  },
  {
    path: "preferences.intendedMajors",
    label: "Intended majors",
    priority: 110,
    recommendationCritical: true,
    whyItMatters: "Program fit depends on what the student wants to study.",
    answerHint: "One or more majors such as computer science or economics.",
  },
  {
    path: "budget.annualBudgetUsd",
    label: "Annual budget",
    priority: 120,
    recommendationCritical: true,
    whyItMatters:
      "Budget is the fastest way to avoid unrealistic recommendations.",
    answerHint: "A yearly USD budget such as 40000.",
  },
  {
    path: "budget.needsFinancialAid",
    label: "Need for financial aid",
    priority: 130,
    recommendationCritical: true,
    whyItMatters:
      "Need-based aid changes the realistic school set for international students.",
    answerHint: "Yes or no.",
  },
  {
    path: "budget.needsMeritAid",
    label: "Need for merit aid",
    priority: 140,
    recommendationCritical: true,
    whyItMatters:
      "Merit aid interest helps refine budget strategy and school mix.",
    answerHint: "Yes or no.",
  },
  {
    path: "budget.budgetFlexibility",
    label: "Budget flexibility",
    priority: 150,
    recommendationCritical: false,
    whyItMatters:
      "Flexibility shows whether the shortlist can stretch or must stay strict.",
    answerHint: "Low, medium, high, or unknown.",
  },
  {
    path: "preferences.preferredLocationPreferences",
    label: "Preferred broad locations",
    priority: 160,
    recommendationCritical: true,
    whyItMatters:
      "Location preferences help narrow the list to realistic regions.",
    answerHint:
      "Examples: US East Coast, US West Coast, Canada, UK, no preference.",
  },
  {
    path: "preferences.preferredStates",
    label: "Preferred US states",
    priority: 170,
    recommendationCritical: false,
    whyItMatters:
      "State preferences can further refine recommendations within the US.",
    answerHint: "Two-letter states such as CA or MA.",
  },
  {
    path: "preferences.preferredCampusLocale",
    label: "Preferred campus locale",
    priority: 180,
    recommendationCritical: false,
    whyItMatters: "Campus setting affects fit and student experience.",
    answerHint: "Examples: urban, suburban, rural.",
  },
  {
    path: "preferences.preferredSchoolControl",
    label: "Preferred school control",
    priority: 190,
    recommendationCritical: false,
    whyItMatters:
      "Public versus private preference changes school mix and cost patterns.",
    answerHint: "Public, private nonprofit, or both.",
  },
  {
    path: "preferences.preferredUndergraduateSize",
    label: "Preferred school size",
    priority: 200,
    recommendationCritical: false,
    whyItMatters:
      "School size is a fit preference that helps rank otherwise similar options.",
    answerHint: "Small, medium, large, or unknown.",
  },
  {
    path: "readiness.wantsEarlyRound",
    label: "Early round intent",
    priority: 210,
    recommendationCritical: false,
    whyItMatters:
      "Application strategy changes when the student wants an early round.",
    answerHint: "Yes or no.",
  },
  {
    path: "readiness.hasTeacherRecommendationsReady",
    label: "Teacher recommendations ready",
    priority: 220,
    recommendationCritical: false,
    whyItMatters: "Readiness helps judge execution risk for near deadlines.",
    answerHint: "Yes or no.",
  },
  {
    path: "readiness.hasCounselorDocumentsReady",
    label: "Counselor documents ready",
    priority: 230,
    recommendationCritical: false,
    whyItMatters:
      "Missing school documents can block an otherwise good application plan.",
    answerHint: "Yes or no.",
  },
  {
    path: "readiness.hasEssayDraftsStarted",
    label: "Essay drafts started",
    priority: 240,
    recommendationCritical: false,
    whyItMatters:
      "Essay readiness affects how aggressive the application plan can be.",
    answerHint: "Yes or no.",
  },
  {
    path: "academic.projectedGpa100",
    label: "Projected GPA",
    priority: 250,
    recommendationCritical: false,
    whyItMatters:
      "Projected GPA supports upside scenarios and stretch planning.",
    answerHint: "A future GPA on any common scale.",
  },
  {
    path: "projected.assumptions",
    label: "Projected assumptions",
    priority: 260,
    recommendationCritical: false,
    whyItMatters:
      "Projected assumptions explain what must improve for a stronger outcome.",
    answerHint:
      "One or more short assumptions such as retake SAT or finish essays early.",
  },
];

export const intakeFieldDefinitionByPath = new Map(
  intakeFieldDefinitions.map((field) => [field.path, field])
);

export const totalIntakeFieldCount = intakeFieldDefinitions.length;
