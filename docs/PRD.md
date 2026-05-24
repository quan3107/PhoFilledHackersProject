# ETEST Compass - Engineering PRD

**Version:** v2.0-draft\
**Status:** Draft\
**Last Updated:** 2026-03-21\
**Target Release:** Hackathon MVP\
**Approved Stack:** Turborepo, Next.js 16, Supabase Postgres, Drizzle ORM, Better Auth, Google OAuth, Facebook OAuth, email auth, shadcn/ui, OpenAPI

## 1. Product Description

Reserved for the final PM-approved product narrative.

Working description:

ETEST Compass is a student-facing admissions advisory web app for Vietnamese students applying to US universities. The product structures a student's profile, recommends schools with transparent reasoning, clarifies budget and timing tradeoffs, and hands qualified leads to ETEST counselors for paid consultation.

## 2. Document Purpose

This document translates the product idea into an engineering build specification. It defines MVP scope, feature boundaries, user flows, required data, and implementation constraints so product, design, and engineering can make consistent decisions.

## 3. Problem Statement

Students and parents need clearer answers to four questions:

- Which US universities are realistic for the student right now?
- Which universities could become realistic with improvement?
- Which options are financially realistic for the family?
- When is human counselor support necessary?

ETEST also needs a structured pre-consultation workflow. Today, too much counselor time is spent reconstructing context from unstructured chat instead of reviewing a clean profile and acting on it.

## 4. Goals

### P0 goals

- Convert raw student input into a structured admissions profile.
- Generate US university recommendations across Reach / Target / Safety.
- Show transparent recommendation reasoning, including current fit, projected fit, budget fit, and blockers.
- Persist user state so students can return and continue.
- Create a clean counselor handoff with enough context to support a paid consultation.

### P1 goals

- Capture booking requests after counselor handoff into an internal queue.
- Provide a basic internal admin surface for school catalog review and updates.

### Non-goals

- Full CRM replacement.
- Full essay-writing or essay-review platform.
- Visa workflow management.
- Guaranteed admissions or scholarship outcomes.
- Live request-time school-data scraping as an MVP dependency.

## 5. Product Principles

- Human-in-the-loop: the product supports counselor workflows and does not replace counselor judgment.
- No silent gatekeeping: the system may warn or downgrade, but it should not hide options without explanation.
- Transparency by default: every recommendation should expose assumptions, blockers, budget labels, and source timestamps.
- Catalog-first: user-facing recommendations must read from a stored school catalog, not from live scraping at request time.
- Structured data over chat clutter: major user actions should write back to normalized records.

## 6. Users and Jobs To Be Done

### Primary users

- Vietnamese students in grades 9-12 or gap year applying to US universities.
- Parents reviewing affordability, realism, and next steps.

### Internal users

- ETEST counselors reviewing qualified leads.
- Admin or operations users maintaining catalog quality.

### Core jobs

- "Tell me which schools are realistic for me now."
- "Tell me what could become realistic if I improve."
- "Tell me which schools are financially realistic."
- "Explain why this school is Reach / Target / Safety."
- "Help me decide whether I should talk to a counselor now."

## 7. MVP Scope

### Included

- Email authentication plus social authentication with Google and Facebook.
- Student onboarding and profile builder.
- Saved student profile and edit flow.
- Curated university catalog stored in Supabase.
- Offline catalog ingestion/import pipeline for official admissions, tuition, cost-of-attendance, and scholarship data.
- Recommendation engine with Current Outlook and Projected Outlook.
- Reach / Target / Safety recommendation lists.
- Transparent school cards with cost, budget fit, blockers, and sources.
- Compare mode for 2-3 shortlisted schools.
- Chat-assisted clarification and recommendation explanation.
- Counselor handoff summary.
- Internal booking request queue for counselor follow-up.
- OpenAPI-documented backend endpoints.

### Explicitly excluded from MVP

- Fully automated school-data crawling at request time.
- Program-level recommendations.
- Parent-specific dashboards.
- OCR or document-intelligence workflows.
- Advanced booking operations such as reminders, calendar sync, or rescheduling.
- Counselor override workflows beyond basic notes and review status.

## 8. Core User Flows

1. User signs in with Google, Facebook, or email auth.
2. User completes profile intake: academics, tests, activities, timing, budget, and preferences.
3. System normalizes input into a structured student profile.
4. User triggers recommendation generation.
5. System reads from the published university catalog and computes school recommendations.
6. UI displays Reach / Target / Safety with Current Outlook, Projected Outlook, budget fit, reasons, blockers, and next actions.
7. User asks follow-up questions in chat or updates profile data.
8. User requests counselor help.
9. System creates a counselor handoff packet and optionally stores a booking request.

## 9. Feature Requirements

### 9.1 Authentication and access

**Priority:** P0

#### Requirements

- Use Better Auth as the authentication layer.
- Support Google OAuth, Facebook OAuth, and email auth at launch.
- Persist user sessions across visits.
- Each user owns one active student profile for MVP.
- Admin and counselor routes must be role-gated.
- Public landing pages may be anonymous, but recommendation generation requires authentication.

#### Acceptance criteria

- A new user can sign in via Google, Facebook, or email auth and land in onboarding.
- A returning user resumes their saved profile and prior recommendation results.
- Unauthorized users cannot access admin or counselor routes.

### 9.2 Student profile builder

**Priority:** P0

#### Required inputs

- Grade level, graduation year, and curriculum.
- GPA and grade trend.
- Intended majors.
- IELTS / TOEFL / SAT / ACT status.
- Activities, awards, leadership, volunteering, and projects.
- Application readiness: essays, recommendations, and documents.
- Preferences: geography, campus type, and size.
- Budget: target annual budget, maximum stretch budget, scholarship need, and strategy mode.

#### Derived fields

- Student stage: Early Builder / Pre-Applicant / Active Applicant.
- Academic strength band.
- Test readiness band.
- Activity depth and leadership signal.
- Scholarship dependence.
- Affordability sensitivity.

#### Rules

- The profile must capture both current facts and planned milestones.
- Missing data should stay explicit rather than being silently guessed.
- Users can save progress and return later.

#### Acceptance criteria

- A partially completed profile can be saved and resumed.
- The normalized profile can be rendered without depending on raw chat history.
- Required fields for recommendation generation are validated before a run starts.

### 9.3 University catalog

**Priority:** P0

#### Purpose

Maintain a source-backed list of US universities used by recommendations and explanation surfaces.

#### Required fields per school

- `school_name`
- `city`
- `state`
- `official_admissions_url`
- `application_rounds`
- `deadlines_by_round`
- `english_requirements`
- `test_policy`
- `required_materials`
- `tuition_annual_usd`
- `estimated_cost_of_attendance_usd`
- `living_cost_estimate_usd`
- `scholarship_availability_flag`
- `scholarship_notes`
- `recommendation_inputs`
- `explanation_inputs`
- `source_urls`
- `last_verified_at`
- `validation_status`

#### Rules

- Every user-visible school fact must have at least one source URL.
- Every school card must show `last_verified_at`.
- Catalog records may be created manually or via offline import for MVP.
- Ingestion must normalize source-backed records before recommendations read from them.
- `recommendation_inputs` must stay machine-readable and bounded to enumerated, boolean, numeric, or short-note fields.
- `explanation_inputs` must be structured primitives such as selectivity bands, risk tags, fit tags, and next-step tags rather than freeform narrative.
- The catalog may store derived recommendation and explanation primitives, but those primitives must be backed by explicit catalog facts or approved public dataset fields.

#### Acceptance criteria

- Recommendation generation reads only from stored catalog records marked publishable.
- An admin can review school records and see stale or low-confidence fields.
- Missing required catalog fields block publication.

### 9.4 Recommendation engine

**Priority:** P0

#### Required outputs per school

- Reach / Target / Safety tier
- Current Outlook
- Projected Outlook
- Confidence level
- Budget Fit label
- Deadline Pressure label
- Reasons for fit
- Top blockers
- Next recommended actions

#### Required structured inputs per school

- `recommendation_inputs` must capture scoring-ready fields such as admission rate, undergraduate size, average net price, school control, campus locale, international aid policy, broad academic-domain `program_fit_tags`, a school-level `program_admission_model`, `application_strategy_tags`, and a structured `testing_requirements` block.
- `program_fit_tags` and `program_admission_model` are school-wide academic-domain proxies for recommendation scoring, not true per-major recommendation logic.
- `testing_requirements` must stay structured and source-backed, including accepted exams, minimum SAT or ACT scores when published, latest test-date notes, superscore policy, writing or essay policy, score-reporting policy, and middle-50 score ranges when available.
- `explanation_inputs` must capture explanation-ready fields such as selectivity band, testing expectation, aid model, application complexity, deadline urgency windows, fit tags, risk tags, and next-step tags.
- The engine should compose readable explanations from those structured inputs instead of relying on unconstrained model prose at recommendation time.

#### Scoring dimensions

- Admission Fit
- Readiness Fit
- Budget Fit
- Preference Fit
- Improvement Upside

#### Rules

- Budget affects ranking and explanation, but does not hard-remove a school by default.
- Current Outlook uses only current profile state.
- Projected Outlook uses only explicit, user-stated milestones and assumptions.
- The engine must explain which assumptions changed between Current and Projected Outlook.
- Output must remain readable to non-expert parents.

#### Acceptance criteria

- A student receives at least one school in each tier when enough catalog coverage exists.
- Each recommended school includes machine-readable fields for score components plus user-readable explanations.
- If the profile lacks enough data, the system asks for specific missing fields before running.
- Recommendation explanations remain reproducible because they are built from stored structured inputs rather than ad hoc generated text.

### 9.5 Recommendation UI and comparison

**Priority:** P0

#### Required school card fields

- School name and location
- Tuition and estimated all-in annual cost
- Scholarship or aid availability flag
- Current Outlook
- Projected Outlook
- Budget Fit
- Deadline Pressure
- Top fit reasons
- Top blockers
- Last verified timestamp
- Source links
- Counselor CTA

#### Compare mode requirements

- Users can compare 2-3 schools.
- Comparison must show outlook, budget fit, deadlines, missing requirements, and counselor urgency side by side.

#### Acceptance criteria

- Recommendation cards are readable on desktop and mobile.
- Every school card exposes the same explanation structure.
- Compare mode preserves consistent field ordering across schools.

### 9.6 Chat assistant

**Priority:** P0

#### Purpose

Clarify recommendations, collect missing data, and convert qualified users into counselor handoff.

#### Allowed behaviors

- Explain why a school is Reach / Target / Safety.
- Explain Current Outlook vs Projected Outlook.
- Ask for missing facts needed by the engine.
- Explain deadline, affordability, and requirement gaps.
- Recommend counselor handoff when confidence is low or blockers are significant.

#### Disallowed behaviors

- Guarantee admissions.
- Guarantee scholarships.
- Invent school facts not present in the catalog.
- Present projections as certainty.

#### Implementation note

The LLM provider and orchestration layer are intentionally left open in this PRD. The assistant must consume normalized profile data and published catalog data through application services rather than direct client-side database access.

#### Acceptance criteria

- Chat responses can cite structured facts already stored by the platform.
- The assistant can request missing profile fields and persist user replies.
- Handoff can be initiated from chat without re-entering profile data.

### 9.7 Counselor handoff

**Priority:** P0

#### Required payload

- Student identity and contact info
- Structured profile summary
- Student stage
- Intended majors
- Budget profile and scholarship need
- Top recommended schools
- Current Outlook and Projected Outlook per school
- Deadline pressure summary
- Affordability summary
- Major blockers
- Chat summary
- Booking intent

#### Acceptance criteria

- A counselor can understand the lead without reading the full chat log.
- The handoff record is queryable by status and creation date.
- The user receives a clear confirmation after handoff submission.

### 9.8 Booking request

**Priority:** P0

#### MVP requirements

- User can submit preferred consultation topic and time window.
- System stores booking request status.
- Admin or counselor can view pending requests in an internal queue.
- Booking requests are persisted internally and do not require an external CRM or webhook for MVP.

#### Not required in MVP

- Real-time slot availability
- Calendar sync
- Automated reminders
- Rescheduling

### 9.9 Admin and counselor console

**Priority:** P1

#### Required views

- School catalog browser
- School record detail with sources and validation status
- Lead queue
- Handoff detail
- Booking request list

#### Not required in MVP

- Full analytics dashboard
- Granular permissions beyond basic role separation
- Advanced workflow automation

## 10. Transparency Requirements

These are product-critical and not optional UI polish.

- Every recommended school must show why it was recommended.
- Every projected recommendation must show its assumptions.
- Every school fact shown to the user must have source provenance stored in the system.
- Budget mismatch must be visible as a warning, not hidden in scoring only.
- Low-confidence or stale catalog data must be visible internally.
- The product must clearly distinguish current state from possible future state.

## 11. Data Model

Minimum entities for MVP:

- `users`
- `accounts` and `sessions` managed by Better Auth
- `student_profiles`
- `student_profile_snapshots`
- `universities`
- `university_sources`
- `catalog_import_runs`
- `catalog_import_items`
- `recommendation_runs`
- `recommendation_results`
- `chat_threads`
- `chat_messages`
- `counselor_handoffs`
- `booking_requests`

### Notes

- Use Drizzle schema definitions as the source of truth for application data models.
- Store school source provenance separately from the derived university row so fact updates remain auditable.
- Snapshot the student profile used for each recommendation run to keep recommendation history explainable.

## 12. API and Contract Strategy

OpenAPI is required for server contracts.

### Requirements

- Define OpenAPI specs for all non-trivial backend routes used by the app and admin console.
- Use typed request and response contracts generated from the OpenAPI source where practical.
- Version external or integration-facing endpoints.
- Avoid undocumented ad hoc JSON shapes between client and server.

### Suggested endpoint groups

- `/auth/*`
- `/api/profile/*`
- `/api/universities/*`
- `/api/catalog-imports/*`
- `/api/recommendations/*`
- `/api/chat/*`
- `/api/handoffs/*`
- `/api/bookings/*`
- `/api/admin/*`

## 13. Technical Architecture

### Approved stack

- Monorepo: Turborepo
- Frontend and BFF: Next.js 16 App Router
- Database: Supabase Postgres
- ORM and migrations: Drizzle
- Authentication: Better Auth with Google OAuth, Facebook OAuth, and email auth
- UI system: shadcn/ui
- API contracts: OpenAPI

### Engineering constraints

- Use server-side data access for protected operations.
- Keep database writes behind application services or route handlers.
- Do not let the client compute recommendation results independently.
- Use role-based route protection for admin and counselor pages.
- Design for mobile-first responsive layouts.

### Suggested module boundaries

- `apps/student-onboarding/app/` for routes and layouts
- `apps/student-onboarding/src/lib/` for profile, recommendation, chat, and API orchestration helpers
- `apps/student-onboarding/src/components/` for student onboarding and dashboard UI
- `apps/ingest/` for the offline catalog import pipeline
- `packages/catalog/` for catalog schema, validation, and normalization
- `packages/db/` for Drizzle schema and queries
- `packages/auth/` for Better Auth configuration and shared server auth helpers
- `packages/api-contracts/` for OpenAPI helpers, generated types, and shared transport logic

## 14. Release Plan

### Phase 1 / Hackathon MVP

- Authentication
- Profile builder
- Curated catalog
- Offline catalog import pipeline
- Recommendation engine
- Recommendation UI
- Compare mode
- Chat clarification
- Counselor handoff
- Internal booking queue
- Basic admin review surfaces

### Phase 2

- Booking workflow improvements
- Better counselor tooling
- Analytics and feedback loops

## 15. Success Metrics

### User metrics

- Sign-up completion rate
- Profile completion rate
- Recommendation generation rate
- Recommendation-to-handoff rate
- Handoff-to-booking-request rate

### Operational metrics

- Percentage of published schools with complete source-backed fields
- Time required for a counselor to review a new lead
- Rate of recommendation runs blocked by missing data
- Percentage of recommendation cards with source links and last-verified timestamps

### Operational metrics ownership

- Recommendation run success and failure logs are owned by `apps/student-onboarding` API routes and recommendation workflow services.
- Source-backed catalog coverage is owned by `packages/catalog`, `packages/db`, and the catalog review workflow.
- Ingest validation failures are owned by `apps/ingest` and the catalog publishability validators.
- LLM provider unavailable and malformed-output counts are owned by the student onboarding intake/chat clients and the ingest extraction client.
- Health endpoint checks are owned by `apps/student-onboarding/app/api/health` and deployment monitoring.

## 16. Risks and Mitigations

- **Risk:** automated school-data ingestion expands scope too early.\
  **Mitigation:** keep ingestion offline, source-backed, and limited to official admissions, tuition, cost, and scholarship pages.

- **Risk:** recommendation logic becomes opaque.\
  **Mitigation:** require explanation fields, assumption lists, and visible budget labels in every result.

- **Risk:** chat responses drift from stored facts.\
  **Mitigation:** route assistant answers through structured services and source-backed catalog data.

## 17. Assumptions

- The initial launch scope is US universities only.
- The initial school catalog is populated through an offline import pipeline from official admissions, tuition, cost, and scholarship pages.
- Counselors remain the final decision-makers for premium strategy.
- Booking in MVP is an internal queue workflow, not a synchronized calendar system.

## 18. Confirmed Sprint Decisions

- MVP auth includes Google OAuth, Facebook OAuth, and email auth through Better Auth.
- Compare mode is included in the hackathon MVP.
- Booking requests are stored in an internal queue for counselor follow-up.
