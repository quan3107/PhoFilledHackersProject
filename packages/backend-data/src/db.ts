import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

import * as dbSchema from "@etest/db";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

declare global {
  var __etestBackendDataSqlClient: postgres.Sql | undefined;
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

export type BackendDb = ReturnType<typeof drizzle<typeof dbSchema>>;

let backendDbPromise: Promise<BackendDb> | null = null;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return "postgres://dummy:dummy@localhost:5432/dummy";
    }
    throw new Error("Missing DATABASE_URL.");
  }

  return databaseUrl;
}

function getSqlClient() {
  if (!globalThis.__etestBackendDataSqlClient) {
    globalThis.__etestBackendDataSqlClient = postgres(getDatabaseUrl(), {
      prepare: false,
      max: 5,
    });
  }

  return globalThis.__etestBackendDataSqlClient;
}

export async function getBackendDb() {
  if (!backendDbPromise) {
    backendDbPromise = Promise.resolve(
      drizzle(getSqlClient(), {
        schema: dbSchema,
      })
    );
  }

  return backendDbPromise;
}
