// packages/db/tests/migration-integrity.test.ts
// Guards the checked-in Drizzle journal so every recorded migration has SQL and snapshot metadata.

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const dbPackageRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationsFolder = path.join(dbPackageRoot, "drizzle");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");

type MigrationJournal = {
  entries: Array<{
    idx: number;
    tag: string;
  }>;
};

test("every journal entry has matching SQL and snapshot files", () => {
  const journal = JSON.parse(
    readFileSync(journalPath, "utf8")
  ) as MigrationJournal;

  for (const entry of journal.entries) {
    assert.ok(
      existsSync(path.join(migrationsFolder, `${entry.tag}.sql`)),
      `Missing SQL migration for ${entry.tag}`
    );
    assert.ok(
      existsSync(
        path.join(
          migrationsFolder,
          "meta",
          `${String(entry.idx).padStart(4, "0")}_snapshot.json`
        )
      ),
      `Missing snapshot metadata for ${entry.tag}`
    );
  }
});
