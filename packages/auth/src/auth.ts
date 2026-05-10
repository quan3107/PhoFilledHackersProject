// packages/auth/src/auth.ts
// Shared Better Auth server configuration for the web app.
// Initializes auth and the Drizzle client lazily so app builds stay side-effect free.

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

import * as dbSchema from "@etest/db";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __etestAuthSqlClient: postgres.Sql | undefined;
}

const envCandidates = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "..", ".env"),
  path.join(process.cwd(), "..", "..", ".env"),
];

const repoRootEnvPath = envCandidates.find((candidate) =>
  existsSync(candidate)
);

if (repoRootEnvPath) {
  loadEnvFile(repoRootEnvPath);
}

type AuthDb = ReturnType<typeof drizzle<typeof dbSchema>>;
type AuthInstance = ReturnType<typeof betterAuth>;

let authDbPromise: Promise<AuthDb> | null = null;
let authPromise: Promise<AuthInstance> | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  return databaseUrl;
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

function getSecret() {
  const configuredSecret = process.env.BETTER_AUTH_SECRET?.trim();

  if (configuredSecret) {
    return configuredSecret;
  }

  if (!isLocalDevelopment()) {
    throw new Error("Missing BETTER_AUTH_SECRET.");
  }

  return "phofilledhackers-development-secret-001";
}

function isLocalDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function getSqlClient() {
  if (!globalThis.__etestAuthSqlClient) {
    globalThis.__etestAuthSqlClient = postgres(getDatabaseUrl(), {
      prepare: false,
      max: 5,
    });
  }

  return globalThis.__etestAuthSqlClient;
}

function buildAuthOptions(db: AuthDb): BetterAuthOptions {
  return {
    baseURL: getBaseUrl(),
    trustedOrigins: getTrustedOrigins(),
    secret: getSecret(),
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
      useSecureCookies: !isLocalDevelopment(),
      disableOriginCheck: isLocalDevelopment(),
      database: {
        generateId: () => randomUUID(),
      },
    },
  };
}

export async function getAuthDb() {
  if (!authDbPromise) {
    authDbPromise = Promise.resolve(
      drizzle(getSqlClient(), {
        schema: dbSchema,
      })
    );
  }

  return authDbPromise;
}

export async function getAuth() {
  if (!authPromise) {
    authPromise = getAuthDb().then((db) => betterAuth(buildAuthOptions(db)));
  }

  return authPromise;
}
