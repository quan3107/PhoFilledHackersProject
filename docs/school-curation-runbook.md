# School Curation Runbook

Use this runbook when a Codex session with `gpt-5.4-mini` at medium reasoning is curating one school at a time into a structured research artifact.

## Model settings

- Model: `gpt-5.4-mini`
- Reasoning: `medium`
- Working mode: one school per run

## Non-negotiable workflow

1. Research exactly one school.
2. Use only official university pages for admissions, testing, international, tuition, cost of attendance, and scholarships or aid.
3. Use College Scorecard only for structured selectivity or enrollment inputs such as admission rate, SAT or ACT, size, control, and locale.
4. As soon as the school is complete, write the result to `data/curated-schools/<school-slug>.json`.
5. If the school is incomplete, still write the file with `quality.status = "needs_review"` and explicit `missingFields`.
6. After writing the file, move to the next school. Do not keep prior schools in working memory.

## CLI workflow

Use the local curation CLI to keep the process one-school-at-a-time:

- `npm --workspace @phofilledhackers/ingest run curate next`
- `npm --workspace @phofilledhackers/ingest run curate -- prompt --school=<school-slug>`
- `npm --workspace @phofilledhackers/ingest run curate -- validate --school=<school-slug>`
- `npm --workspace @phofilledhackers/ingest run curate -- validate`

## System prompt

```text
You are curating one US university at a time into a source-backed JSON artifact for a recommendation catalog.

Allowed sources:
- official university admissions, testing, international, tuition, student budget, and scholarship or financial aid pages
- College Scorecard for selectivity, school control, size, and locale

Hard rules:
- Research exactly one school per run.
- Return facts only when explicitly supported by a source.
- Use null or unknown instead of guessing.
- Do not write recommendation prose.
- explanationInputs must use only controlled enums and tags.
- recommendationInputs.averageNetPriceUsd should come from College Scorecard or an official aid source when available.
- recommendationInputs.programFitTags must stay broad and school-level. They are academic-domain proxies, not ranking claims or per-major admit promises.
- recommendationInputs.programAdmissionModel must capture only school-stated patterns such as direct admit, separate school application, capacity-limited majors, or portfolio/audition gates.
- recommendationInputs.applicationStrategyTags must capture school-stated early-action, early-decision, or rolling nuances that matter for application planning.
- recommendationInputs.testingRequirements must capture school-specific SAT or ACT rules, score reporting, superscoring, writing or essay policy, and middle-50 ranges when the source provides them.
- Every non-null field must have provenance.
- When the school is complete, write the JSON artifact to data/curated-schools/<school-slug>.json before moving on.
- If some fields are missing, still write the artifact with quality.status set to needs_review and list missingFields.
- After writing the file, forget the school and proceed to the next one.
```

## Per-school user prompt

```text
Research this school and produce one JSON artifact only:

School name: <SCHOOL_NAME>
State if known: <STATE_OR_NULL>
Slug to write: <SCHOOL_SLUG>

Open and verify:
- undergraduate admissions home
- first-year application requirements
- international applicants or English proficiency
- testing policy
- tuition page
- cost of attendance or student budget
- scholarships or financial aid page
- College Scorecard entry for structured selectivity or enrollment fields

Write the finished artifact to:
data/curated-schools/<SCHOOL_SLUG>.json
```

## Output shape

```json
{
  "schoolSlug": "stanford",
  "lastVerifiedAt": "2026-03-21",
  "identity": {
    "schoolName": "Stanford University",
    "city": "Stanford",
    "state": "CA",
    "officialAdmissionsUrl": "https://admission.stanford.edu/"
  },
  "applicationRounds": ["early_action", "regular_decision"],
  "deadlinesByRound": {
    "early_action": "2026-11-01",
    "early_decision": null,
    "regular_decision": "2027-01-05",
    "rolling_admission": null,
    "priority": null
  },
  "englishRequirements": {
    "minimumIelts": null,
    "minimumToeflInternetBased": null,
    "waiverNotes": "No English proficiency exam is required, but fluency in English is a prerequisite."
  },
  "testPolicy": "required",
  "requiredMaterials": [
    "common_application",
    "application_fee_or_fee_waiver",
    "sat_or_act",
    "school_report",
    "counselor_recommendation",
    "official_transcript",
    "midyear_transcript",
    "teacher_recommendation_1",
    "teacher_recommendation_2",
    "personal_essay",
    "supplemental_essays"
  ],
  "tuitionAnnualUsd": 67731,
  "estimatedCostOfAttendanceUsd": 97545,
  "livingCostEstimateUsd": 22944,
  "scholarshipAvailabilityFlag": false,
  "scholarshipNotes": "Need-based aid is available. Merit scholarships are not offered except limited athletic scholarships.",
  "recommendationInputs": {
    "admissionRateOverall": 0.0391,
    "satAverageOverall": 1553,
    "actMidpointCumulative": 35,
    "undergraduateSize": 7841,
    "averageNetPriceUsd": 12136,
    "schoolControl": "private_nonprofit",
    "campusLocale": "suburban",
    "internationalAidPolicy": "meets_full_demonstrated_need_if_eligible",
    "hasNeedBasedAid": true,
    "hasMeritAid": false,
    "programFitTags": ["engineering", "life_sciences", "research_intensive"],
    "programAdmissionModel": "open",
    "applicationStrategyTags": ["restrictive_early_action"],
    "testingRequirements": {
      "acceptedExams": ["sat", "act"],
      "minimumSatTotal": null,
      "minimumActComposite": null,
      "latestSatTestDateNote": "by the end of October for Restrictive Early Action and by the end of December for Regular Decision",
      "latestActTestDateNote": "by the end of September for Restrictive Early Action and by the end of December for Regular Decision",
      "superscorePolicy": "both",
      "writingEssayPolicy": "optional",
      "scoreReportingPolicy": "official_required_after_admit",
      "middle50SatTotal": {
        "low": 1510,
        "high": 1570
      },
      "middle50ActComposite": {
        "low": 34,
        "high": 35
      }
    }
  },
  "explanationInputs": {
    "academicSelectivityBand": "ultra_selective",
    "testingExpectation": "high_scores_expected",
    "englishPolicySummary": "english_fluency_required_no_exam_minimum_listed",
    "aidModel": "need_based_only",
    "applicationComplexity": "high",
    "deadlineUrgencyWindows": {
      "earliestDeadline": "2026-11-01",
      "latestMajorDeadline": "2027-01-05"
    },
    "internationalStudentConsiderations": ["english_fluency_required"],
    "potentialFitTags": ["research_or_innovation_oriented"],
    "potentialRiskTags": ["extremely_low_admission_rate", "high_total_cost"],
    "actionableApplicationSteps": ["build_supplemental_essay_plan"]
  },
  "fieldProvenance": {
    "testPolicy": [
      {
        "sourceKind": "official_admissions",
        "sourceUrl": "https://admission.stanford.edu/apply/first-year/testing.html",
        "excerpt": "ACT or SAT scores are required"
      }
    ]
  },
  "quality": {
    "status": "publishable",
    "missingFields": [],
    "warnings": []
  }
}
```

## Enum constraints

Use the enum and tag vocabularies defined in `packages/db/src/schema/types.ts`.

Key constrained fields:

- `testPolicy`: `required`, `test_optional`, `test_flexible`, `test_blind`, `unknown`
- `schoolControl`: `public`, `private_nonprofit`, `private_for_profit`, `unknown`
- `internationalAidPolicy`: `meets_full_demonstrated_need_if_eligible`, `need_based_aid_available`, `merit_aid_available`, `need_and_merit_available`, `limited_or_unclear`, `unknown`
- `programFitTags`: `computer_science`, `engineering`, `business`, `economics`, `life_sciences`, `health_pre_med`, `humanities`, `social_sciences`, `arts_design`, `public_policy`, `research_intensive`
- `programAdmissionModel`: `open`, `direct_admit`, `separate_school_application`, `capacity_limited`, `portfolio_or_audition`, `unknown`
- `applicationStrategyTags`: `non_binding_early_action`, `restrictive_early_action`, `single_choice_early_action`, `binding_early_decision`, `multiple_early_rounds`, `rolling_or_extended_timeline`
- `testingRequirements.acceptedExams`: `sat`, `act`
- `testingRequirements.superscorePolicy`: `sat_only`, `act_only`, `both`, `none`, `unknown`
- `testingRequirements.writingEssayPolicy`: `required`, `optional`, `not_considered`, `unknown`
- `testingRequirements.scoreReportingPolicy`: `self_report_allowed`, `official_required_upfront`, `official_required_after_admit`, `unknown`
- `academicSelectivityBand`: `ultra_selective`, `highly_selective`, `selective`, `moderately_selective`, `broad_access`, `unknown`
- `testingExpectation`: `high_scores_expected`, `scores_considered`, `tests_not_required`, `tests_not_considered`, `unknown`
- `englishPolicySummary`: `minimum_scores_required`, `english_fluency_required_no_exam_minimum_listed`, `waiver_possible`, `not_clearly_stated`, `unknown`
- `aidModel`: `need_based_only`, `merit_available`, `need_and_merit`, `limited_aid`, `unknown`
- `applicationComplexity`: `low`, `medium`, `high`, `unknown`

## Review rule

If any required catalog field is missing, the artifact is still written, but:

- `quality.status` must be `needs_review`
- `quality.missingFields` must list the exact field names
- the next school should not begin until the current artifact has been written
