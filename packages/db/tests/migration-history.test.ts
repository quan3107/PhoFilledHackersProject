// packages/db/tests/migration-history.test.ts
// Unit coverage for migration baselining and drift checks.

import assert from "node:assert/strict";
import test from "node:test";

import {
  collectVerifiedBaselineMigrationTags,
  collectVerifiedBaselineMigrations,
  type BaselineMigrationJournal,
} from "../scripts/baseline.js";
import {
  assertMigrationHistoryMatchesRepository,
  type AppliedMigrationRecord,
  type RepositoryMigrationRecord,
} from "../scripts/migrate.js";

const journal: BaselineMigrationJournal = {
  entries: [
    { idx: 0, when: 1000, tag: "0000_catalog_schema" },
    { idx: 1, when: 2000, tag: "0001_auth" },
    { idx: 2, when: 3000, tag: "0002_profiles" },
    { idx: 7, when: 8000, tag: "0007_future" },
  ],
};

test("baseline records every verified journal migration through the checked schema", () => {
  const verifiedTags = collectVerifiedBaselineMigrationTags(journal);
  const migrations = collectVerifiedBaselineMigrations(
    journal,
    verifiedTags,
    (tag) => `hash:${tag}`
  );

  assert.deepEqual(migrations, [
    { hash: "hash:0000_catalog_schema", createdAt: 1000 },
    { hash: "hash:0001_auth", createdAt: 2000 },
    { hash: "hash:0002_profiles", createdAt: 3000 },
  ]);
});

test("migration history rejects edited old migrations", () => {
  assert.throws(
    () =>
      assertMigrationHistoryMatchesRepository(
        [
          appliedMigration("hash:0000", 1000),
          appliedMigration("stale-hash", 2000),
        ],
        [
          repositoryMigration("hash:0000", 1000),
          repositoryMigration("hash:0001", 2000),
        ]
      ),
    /hash mismatch/i
  );
});

test("migration history rejects missing intermediate repo migrations", () => {
  assert.throws(
    () =>
      assertMigrationHistoryMatchesRepository(
        [
          appliedMigration("hash:0000", 1000),
          appliedMigration("hash:0002", 3000),
        ],
        [
          repositoryMigration("hash:0000", 1000),
          repositoryMigration("hash:0001", 2000),
          repositoryMigration("hash:0002", 3000),
        ]
      ),
    /not applied/i
  );
});

test("migration history rejects databases ahead of the repository", () => {
  assert.throws(
    () =>
      assertMigrationHistoryMatchesRepository(
        [
          appliedMigration("hash:0000", 1000),
          appliedMigration("hash:0009", 9000),
        ],
        [repositoryMigration("hash:0000", 1000)]
      ),
    /not present in repository/i
  );
});

function appliedMigration(
  hash: string,
  createdAt: number
): AppliedMigrationRecord {
  return { hash, createdAt };
}

function repositoryMigration(
  hash: string,
  createdAt: number
): RepositoryMigrationRecord {
  return { hash, createdAt };
}
