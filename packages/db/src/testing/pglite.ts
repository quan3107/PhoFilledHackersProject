// packages/db/src/testing/pglite.ts
// In-memory Postgres helper for db-package integration tests.
// Applies the same Drizzle migration journal used by the live database workflow.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";

import { fileURLToPath } from "node:url";

import * as schema from "../index.js";

export async function createCatalogTestDatabase() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });

  return {
    client,
    db,
    async close() {
      await client.close();
    },
  };
}
