# Contributing to PhoFilledHackersProject

## Naming Conventions

This project enforces consistent naming conventions via ESLint with `@typescript-eslint/naming-convention` rules. The configuration is located in `apps/student-onboarding/eslint.config.mjs`.

| Element                           | Convention                           | Examples                                   |
| --------------------------------- | ------------------------------------ | ------------------------------------------ |
| Types, Interfaces, Classes, Enums | PascalCase                           | `StudentProfile`, `IntakeFieldPath`        |
| Variables, Functions, Parameters  | camelCase                            | `createEmptyProfile()`, `apiKey`           |
| Constants                         | UPPER_CASE or camelCase              | `MAX_RETRIES`, `curriculumStrengthOptions` |
| Properties                        | camelCase, PascalCase, or UPPER_CASE | `firstName`, `userId`, `CONTENT_TYPE`      |
| Enum Members                      | PascalCase or UPPER_CASE             | `GradeLevel.Nine`, `HTTP_STATUS.OK`        |

## Module Organization

- `apps/student-onboarding`: Next.js student app and BFF routes. Local dev port: `3001`.
- `apps/ingest`: offline catalog ingest and curated artifact tooling.
- `packages/*`: shared libraries for auth, database, catalog, and API contracts.

## Local Development

```bash
npm ci
npm --workspace student-onboarding run dev
```

Set `STUDENT_ONBOARDING_AUTH_DEV=true` for local auth development. Full backend flows also require `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, OAuth provider credentials, `OPENAI_API_KEY`, `BRIGHT_DATA_API_KEY`, and `BRIGHT_DATA_ZONE`.

## Database and Ingest

```bash
npm --workspace @etest/db run build
npm --workspace @etest/db run migrate
npm --workspace @phofilledhackers/ingest run curate -- next
npm --workspace @phofilledhackers/ingest run curate -- prompt <school-slug>
npm --workspace @phofilledhackers/ingest run curate -- validate data/curated-schools/<school-slug>.json
npm --workspace @phofilledhackers/ingest run import:curated -- data/curated-schools/<school-slug>.json
```

## Predeploy Gate

Run the same gate locally before opening or updating a deployment PR:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run qa
```

For the Vercel student app build graph, use:

```bash
npm run build -- --filter=student-onboarding...
```
