// packages/db/scripts/migrate.ts
// Runs the canonical Drizzle migration journal against Postgres.
// Fails fast when an existing database still needs a one-time Drizzle baseline.

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvFile } from "node:process";

import { desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { pgSchema, serial, text, bigint } from "drizzle-orm/pg-core";
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

const drizzleTrackingSchema = pgSchema("drizzle");
const drizzleMigrations = drizzleTrackingSchema.table("__drizzle_migrations", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull(),
  createdAt: bigint("created_at", { mode: "number" }),
});

export type AppliedMigrationRecord = {
  hash: string;
  createdAt: number | null;
};

export type RepositoryMigrationRecord = {
  hash: string;
  createdAt: number;
};

function loadRepositoryEnv() {
  if (existsSync(repoRootEnvPath)) {
    loadEnvFile(repoRootEnvPath);
  }
}

export function assertMigrationHistoryMatchesRepository(
  appliedMigrations: AppliedMigrationRecord[],
  repositoryMigrations: RepositoryMigrationRecord[]
) {
  if (appliedMigrations.length === 0) {
    return;
  }

  const repositoryByCreatedAt = new Map(
    repositoryMigrations.map((migration) => [migration.createdAt, migration])
  );
  const appliedByCreatedAt = new Map(
    appliedMigrations.map((migration) => [
      Number(migration.createdAt),
      migration,
    ])
  );
  const latestAppliedCreatedAt = Math.max(
    ...appliedMigrations.map((migration) => Number(migration.createdAt))
  );

  for (const appliedMigration of appliedMigrations) {
    const createdAt = Number(appliedMigration.createdAt);
    const repositoryMigration = repositoryByCreatedAt.get(createdAt);

    if (!repositoryMigration) {
      throw new Error(
        `Drizzle migration drift detected: applied migration ${createdAt} is not present in repository.`
      );
    }

    if (repositoryMigration.hash !== appliedMigration.hash) {
      throw new Error(
        `Drizzle migration drift detected: hash mismatch for migration ${createdAt}.`
      );
    }
  }

  for (const repositoryMigration of repositoryMigrations) {
    if (
      repositoryMigration.createdAt < latestAppliedCreatedAt &&
      !appliedByCreatedAt.has(repositoryMigration.createdAt)
    ) {
      throw new Error(
        `Drizzle migration drift detected: repository migration ${repositoryMigration.createdAt} is older than the latest applied migration but is not applied.`
      );
    }
  }
}

async function relationExists<TTable>(
  db: ReturnType<typeof drizzle>,
  table: TTable
) {
  try {
    await db
      .select()
      .from(table as never)
      .limit(1);
    return true;
  } catch {
    return false;
  }
}

async function tableExistsByName(
  db: ReturnType<typeof drizzle>,
  tableName: string
) {
  const result = await db.execute(sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = ${tableName}
    ) as exists
  `);

  const row = Array.isArray(result) ? result[0] : result.rows[0];

  return Boolean(row?.exists);
}

async function runDrizzleMigrations() {
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
    const migrations = readMigrationFiles({ migrationsFolder });
    const latestMigration = migrations.at(-1);

    if (!latestMigration) {
      throw new Error(`No Drizzle migrations found in ${migrationsFolder}.`);
    }

    const [
      hasUsers,
      hasAccounts,
      hasSessions,
      hasVerifications,
      hasStudentProfiles,
      hasStudentProfileSnapshots,
      hasUniversities,
      hasSources,
      hasRuns,
      hasItems,
      hasMigrationState,
      hasUsersTable,
      hasAccountsTable,
      hasSessionsTable,
      hasVerificationsTable,
      hasStudentProfilesTable,
      hasStudentProfileSnapshotsTable,
    ] = await Promise.all([
      relationExists(db, users),
      relationExists(db, accounts),
      relationExists(db, sessions),
      relationExists(db, verifications),
      relationExists(db, studentProfiles),
      relationExists(db, studentProfileSnapshots),
      relationExists(db, universities),
      relationExists(db, universitySources),
      relationExists(db, catalogImportRuns),
      relationExists(db, catalogImportItems),
      relationExists(db, drizzleMigrations),
      tableExistsByName(db, "users"),
      tableExistsByName(db, "accounts"),
      tableExistsByName(db, "sessions"),
      tableExistsByName(db, "verifications"),
      tableExistsByName(db, "student_profiles"),
      tableExistsByName(db, "student_profile_snapshots"),
    ]);

    const driftedApplicationTables = [
      hasUsersTable && !hasUsers ? "users" : null,
      hasAccountsTable && !hasAccounts ? "accounts" : null,
      hasSessionsTable && !hasSessions ? "sessions" : null,
      hasVerificationsTable && !hasVerifications ? "verifications" : null,
      hasStudentProfilesTable && !hasStudentProfiles
        ? "student_profiles"
        : null,
      hasStudentProfileSnapshotsTable && !hasStudentProfileSnapshots
        ? "student_profile_snapshots"
        : null,
    ].filter((tableName): tableName is string => Boolean(tableName));

    const hasApplicationSchema =
      hasUsers ||
      hasAccounts ||
      hasSessions ||
      hasVerifications ||
      hasStudentProfiles ||
      hasStudentProfileSnapshots ||
      hasUniversities ||
      hasSources ||
      hasRuns ||
      hasItems;

    if (driftedApplicationTables.length > 0) {
      throw new Error(
        `Existing application tables do not match the checked-in Drizzle schema: ${driftedApplicationTables.join(", ")}. Normalize or drop the drifted tables before rerunning migrate.`
      );
    }

    if (hasMigrationState) {
      const appliedMigrations = await db
        .select()
        .from(drizzleMigrations)
        .orderBy(desc(drizzleMigrations.createdAt));

      assertMigrationHistoryMatchesRepository(
        appliedMigrations,
        migrations.map((migration) => ({
          hash: migration.hash,
          createdAt: migration.folderMillis,
        }))
      );
    }

    if (hasApplicationSchema && !hasMigrationState) {
      throw new Error(
        "Existing catalog schema detected without Drizzle migration history. Run `npm --workspace @etest/db run baseline` once, then rerun migrate."
      );
    }

    await migrate(db, { migrationsFolder });

    console.log(
      JSON.stringify(
        {
          ok: true,
          migrationsFolder,
          baselinedExistingSchema: hasApplicationSchema,
          migrationCount: migrations.length,
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
  runDrizzleMigrations().catch((error: unknown) => {
    console.error(
      `[db:migrate] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
