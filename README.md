# PhoFilledHackersProject

ETEST Compass is a Turborepo workspace for the student onboarding web app, shared backend packages, and the offline catalog ingest runner.

## Apps

- `apps/student-onboarding`: Next.js 16 student onboarding and recommendation app. Local dev runs on port `3001`.
- `apps/ingest`: offline catalog import and curated-school tooling.

## Local Setup

```bash
npm ci
npm --workspace student-onboarding run dev
```

Open `http://localhost:3001` for the student onboarding app.

For local auth development, set the app's development auth flag so the student onboarding routes can use the local-only auth path without OAuth provider setup:

```bash
STUDENT_ONBOARDING_AUTH_DEV=true
```

Required environment variables for the full backend path:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `FACEBOOK_CLIENT_ID`
- `FACEBOOK_CLIENT_SECRET`
- `OPENAI_API_KEY`
- `BRIGHT_DATA_API_KEY`
- `BRIGHT_DATA_ZONE`

Optional ingest/browser fallback variables:

- `BRIGHT_DATA_BROWSER_WSS`
- `BRIGHT_DATA_BROWSER_USERNAME`
- `BRIGHT_DATA_BROWSER_PASSWORD`
- `INGEST_SCHOOL_SLUG`

## Database

Build and run database migrations from the root workspace:

```bash
npm --workspace @etest/db run build
npm --workspace @etest/db run migrate
```

## Curated Ingest

Use curated artifacts when the source-backed school data is manually reviewed before import:

```bash
npm --workspace @phofilledhackers/ingest run curate -- next
npm --workspace @phofilledhackers/ingest run curate -- prompt <school-slug>
npm --workspace @phofilledhackers/ingest run curate -- validate data/curated-schools/<school-slug>.json
npm --workspace @phofilledhackers/ingest run import:curated -- data/curated-schools/<school-slug>.json
```

Run the configured one-school ingest slice:

```bash
npm --workspace @phofilledhackers/ingest run build
npm --workspace @phofilledhackers/ingest run start -- --school <school-slug>
```

## Predeploy Gate

Run the full gate before deployment:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run qa
```

Vercel builds the student onboarding deployment through Turbo:

```bash
npm run build -- --filter=student-onboarding...
```
