// packages/auth/src/auth.ts
// Shared Better Auth server configuration for the web app.
// Initializes auth and the Drizzle client lazily so app builds stay side-effect free.

import { randomUUID } from "node:crypto";
import { getBackendDb, type BackendDb } from "@etest/backend-data";
import * as dbSchema from "@etest/db";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

type AuthInstance = ReturnType<typeof betterAuth>;

let authPromise: Promise<AuthInstance> | null = null;

const allowInsecureAuthDev = process.env.ALLOW_INSECURE_AUTH_DEV === "true";

function isLocalAuthUrl(url: string | undefined) {
  return Boolean(
    url && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(url)
  );
}

function getBaseUrl() {
  const explicitBaseUrl =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  const vercelUrl =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();

  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

function getTrustedOrigins() {
  const origins = new Set<string>();
  const vercelCandidates = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .map((value) => (value!.startsWith("http") ? value! : `https://${value}`));
  const configuredOrigins =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  for (const candidate of [
    getBaseUrl(),
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    ...vercelCandidates,
    ...configuredOrigins,
  ]) {
    if (!candidate) {
      continue;
    }

    try {
      origins.add(new URL(candidate).origin);
    } catch {
      origins.add(candidate);
    }
  }

  return [...origins];
}

export function getAuthSecret() {
  const configuredSecret = process.env.BETTER_AUTH_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  const appUrl =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (allowInsecureAuthDev && isLocalAuthUrl(appUrl)) {
    return "dev-only-change-me";
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return "phofilledhackers-build-secret-dummy-001";
  }

  throw new Error("BETTER_AUTH_SECRET is required outside explicit local dev.");
}

function isExplicitLocalAuthDev() {
  return allowInsecureAuthDev && isLocalAuthUrl(getBaseUrl());
}

function buildAuthOptions(db: BackendDb): BetterAuthOptions {
  return {
    baseURL: getBaseUrl(),
    trustedOrigins: getTrustedOrigins(),
    secret: getAuthSecret(),
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        ...dbSchema,
        user: dbSchema.users,
        session: dbSchema.sessions,
        account: dbSchema.accounts,
        verification: dbSchema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      useSecureCookies: !isExplicitLocalAuthDev(),
      disableOriginCheck: isExplicitLocalAuthDev(),
      database: {
        generateId: () => randomUUID(),
      },
    },
  };
}

export async function getAuth() {
  if (!authPromise) {
    authPromise = getBackendDb().then((db) => betterAuth(buildAuthOptions(db)));
  }

  return authPromise;
}
