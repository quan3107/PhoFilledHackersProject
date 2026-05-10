// packages/db/scripts/baseline.ts
// Records the checked-in baseline migration for databases that already have the schema.
// Uses Drizzle's migrator and query builder only so the repo has one consistent ORM path.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvFile } from "node:process";

import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { bigint, pgSchema, serial, text } from "drizzle-orm/pg-core";
import postgres from "postgres";

import {
  accounts,
  catalogImportItems,
  catalogImportRuns,
  sessions,
  studentProfileSnapshots,
  studentProfiles,
  universities,
  universitySources,
  users,
  verifications,
} from "../src/index.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootEnvPath = path.join(scriptDir, "../../../.env");
const migrationsFolder = path.join(scriptDir, "../drizzle");
const baselineInfraFolder = path.join(scriptDir, "../drizzle-baseline");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");

const drizzleTrackingSchema = pgSchema("drizzle");
const drizzleMigrations = drizzleTrackingSchema.table("__drizzle_migrations", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

type MigrationJournal = {
  entries: Array<{
    idx: number;
    when: number;
    tag: string;
  }>;
};

function loadRepositoryEnv() {
  if (existsSync(repoRootEnvPath)) {
    loadEnvFile(repoRootEnvPath);
  }
}

function readBaselineMigration() {
  const journal = JSON.parse(
    readFileSync(journalPath, "utf8")
  ) as MigrationJournal;
  const baselineEntry = journal.entries.at(0);

  if (!baselineEntry) {
    throw new Error("Missing baseline migration journal entry.");
  }

  const migrationPath = path.join(migrationsFolder, `${baselineEntry.tag}.sql`);
  const migrationSql = readFileSync(migrationPath, "utf8");

  return {
    hash: createHash("sha256").update(migrationSql).digest("hex"),
    createdAt: baselineEntry.when,
  };
}

async function assertExistingApplicationSchema(db: ReturnType<typeof drizzle>) {
  await Promise.all([
    db.select().from(users).limit(1),
    db.select().from(accounts).limit(1),
    db.select().from(sessions).limit(1),
    db.select().from(verifications).limit(1),
    db.select().from(studentProfiles).limit(1),
    db.select().from(studentProfileSnapshots).limit(1),
    db.select().from(universities).limit(1),
    db.select().from(universitySources).limit(1),
    db.select().from(catalogImportRuns).limit(1),
    db.select().from(catalogImportItems).limit(1),
  ]);
}

export async function baselineExistingDatabase() {
  loadRepositoryEnv();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });
  const db = drizzle(client);

  try {
    await assertExistingApplicationSchema(db);
    await migrate(db, { migrationsFolder: baselineInfraFolder });

    const baselineMigration = readBaselineMigration();
    const [existingMigration] = await db
      .select()
      .from(drizzleMigrations)
      .where(eq(drizzleMigrations.hash, baselineMigration.hash))
      .limit(1);

    if (!existingMigration) {
      const [latestRecordedMigration] = await db
        .select()
        .from(drizzleMigrations)
        .orderBy(desc(drizzleMigrations.createdAt))
        .limit(1);

      if (latestRecordedMigration) {
        throw new Error(
          "Drizzle migration history already exists but does not match the checked-in baseline. Refusing to rewrite migration state."
        );
      }
    }

    if (!existingMigration) {
      await db.insert(drizzleMigrations).values(baselineMigration);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baselined: !existingMigration,
          migrationsFolder,
        },
        null,
        2
      )
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  baselineExistingDatabase().catch((error: unknown) => {
    console.error(
      `[db:baseline] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
