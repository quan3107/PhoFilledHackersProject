# XP Sprint Checklist

This is a hackathon XP sprint: one vertical slice per branch, merged in order, with tests landing in the same branch as the code. Keep each branch short-lived and scoped to one canonical path.

## Branch Order

1. `chore/monorepo-bootstrap` - done
2. `feat/catalog-schema` - done
3. `feat/bright-data-ingest-runner`
4. `feat/catalog-review-surface`
5. `feat/recommendation-catalog-read-path`
6. `feat/import-api-contracts`
7. `fix/ingest-hardening`

## Checklist

### `chore/monorepo-bootstrap`

- Status: done
- Goal: scaffold the Turborepo workspace layout and shared tooling.
- Deliverables: `apps/student-onboarding`, `apps/ingest`, `packages/db`, `packages/catalog`, `packages/api-contracts`, `packages/auth`, root workspace config.
- Acceptance criteria: the repo installs, workspace scripts resolve, and the canonical monorepo layout is in place.
- Tests: none required for this branch.
- Ownership: repo root, workspace config, and base tooling only.

### `feat/catalog-schema`

- Status: done
- Goal: define the canonical catalog schema and publishability rules.
- Deliverables: Drizzle tables for universities, source provenance, import runs, and import items; normalized catalog types and validators.
- Acceptance criteria: a school record can be validated as publishable or rejected with explicit reasons and source provenance.
- Tests: unit tests for required-field validation and publishability rules; integration test for Drizzle round-trip on universities and university_sources.
- Ownership: `packages/db`, `packages/catalog`.

### `feat/bright-data-ingest-runner`

- Goal: add the constrained scheduled ingest pipeline for official admissions, tuition, cost-of-attendance, and scholarship pages.
- Deliverables: Bright Data fetch integration, OpenAI Responses API extraction with `gpt-5.4-nano`, source selection, normalization, validation, and persistence for one seeded school.
- Acceptance criteria: one school can run through scheduled fetch -> extract -> normalize -> validate -> persist with explicit failure states.
- Tests: unit tests for source selection and normalization fixtures; integration test for one-school ingest flow with mocked Bright Data and OpenAI clients.
- Ownership: `apps/ingest`, `packages/catalog`, `packages/api-contracts` if the runner needs shared request shapes.

### `feat/catalog-review-surface`

- Goal: give internal reviewers a minimal catalog QA surface.
- Deliverables: school review page, source list, validation status, `last_verified_at`, missing-field display, publish/unpublish action.
- Acceptance criteria: a reviewer can inspect one imported school and decide whether it is publishable.
- Tests: UI smoke test for the review page; API/integration test for publish/unpublish gating.
- Ownership: `apps/student-onboarding`, `packages/db`.

### `feat/recommendation-catalog-read-path`

- Goal: force recommendations to read only from published catalog rows.
- Deliverables: catalog read path wired into recommendations, unpublished rows excluded, raw import tables kept out of the recommendation path.
- Acceptance criteria: recommendation selection ignores unpublished or incomplete records.
- Tests: unit test that selection reads only published rows; integration test that unpublished/incomplete schools are excluded from recommendation runs.
- Ownership: `apps/student-onboarding`, `packages/db`, `packages/catalog`.

### `feat/import-api-contracts`

- Goal: define stable contracts for import and catalog review workflows.
- Deliverables: OpenAPI endpoints and generated types for import status, detail, list, and publish actions.
- Acceptance criteria: import and catalog endpoints have one documented request/response shape source.
- Tests: API/contract tests for import status, detail, list, and publish endpoints; schema-shape test for request/response drift.
- Ownership: `packages/api-contracts`, `apps/student-onboarding` route handlers.

### `fix/ingest-hardening`

- Goal: make ingest retries and failure handling deterministic.
- Deliverables: retry/backoff boundaries, idempotent reruns, stale-data blocking, explicit transient-failure reporting.
- Acceptance criteria: failed imports stay unpublished, reruns do not duplicate data, and stale records block publication.
- Tests: integration tests for retry/backoff on transient Bright Data failures; unit tests for idempotent reruns and stale-data blocking.
- Ownership: `apps/ingest`, `packages/catalog`, `packages/db`.

## Workspace Ownership

- `apps/student-onboarding`: app routes, admin review UI, recommendation read path.
- `apps/ingest`: Bright Data + Responses API ingestion runner and import orchestration.
- `packages/db`: Drizzle schema, migrations, and repository queries.
- `packages/catalog`: normalized catalog schema, validation, and publishability rules.
- `packages/api-contracts`: OpenAPI source and generated client/server types.
- `packages/auth`: Better Auth setup and shared auth helpers.

## Working Rules

- Do not mix unrelated work in one branch.
- Merge in branch order.
- Keep the product path canonical: scheduled import -> review -> publish -> recommend.
- Ship tests in the same branch as the code for every non-chore branch.
