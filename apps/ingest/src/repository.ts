// apps/ingest/src/repository.ts
// Postgres-backed persistence for the ingest runner.
// Keeps the raw SQL contained in one file so the runner can stay focused on orchestration.

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import type {
  IngestRepository,
  PersistSuccessfulImportInput,
} from "./types.js";
import { persistUniversityCatalogRecord } from "@etest/catalog";

function toDbStatus(status: string) {
  return status;
}

function nowIso(date: Date) {
  return date.toISOString();
}

export function createPostgresIngestRepository(
  databaseUrl: string
): IngestRepository {
  const sql = postgres(databaseUrl, {
    prepare: false,
  });

  return {
    async createImportRun(input) {
      const rows = (await sql`
        insert into catalog_import_runs (
          requested_school_name,
          status,
          metadata
        )
        values (
          ${input.requestedSchoolName},
          ${toDbStatus("pending")},
          ${{
            triggeredBy: input.triggeredBy,
            attemptCount: input.attemptCount,
          }}
        )
        returning id
      `) as Array<{ id: string }>;

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to create catalog import run.");
      }

      return row;
    },

    async updateImportRunStatus(input) {
      await sql`
        update catalog_import_runs
        set
          status = ${toDbStatus(input.status)},
          university_id = ${input.universityId ?? null},
          failure_code = ${input.failureCode ?? null},
          failure_message = ${input.failureMessage ?? null},
          finished_at = ${input.finishedAt ? nowIso(input.finishedAt) : null},
          updated_at = now()
        where id = ${input.runId}
      `;
    },

    async persistSuccessfulImport(input: PersistSuccessfulImportInput) {
      const result = await sql.begin(async (tx: any) => {
        const university = await persistUniversityCatalogRecord(drizzle(tx), {
          university: {
            ...input.record,
            validationStatus: input.validation.status,
            validationReasons: input.validation.reasons,
          },
          sources: input.selectedSources.map((source) => ({
            sourceKind: source.sourceKind,
            fieldKey: source.fieldKey,
            sourceUrl: source.sourceUrl,
            excerpt: source.excerpt,
            isPrimary: true,
            metadata: {
              ...source.metadata,
              notes: `Branch-3 ingest provenance for ${source.fieldKey}.`,
            },
          })),
          sourceReplacementPolicy: "upsert_and_mark_stale",
          importedAt: input.verifiedAt,
        });

        for (const item of input.items) {
          await tx`
            insert into catalog_import_items (
              import_run_id,
              university_id,
              source_kind,
              field_key,
              source_url,
              status,
              raw_payload,
              normalized_payload
            )
            values (
              ${input.runId},
              ${university.universityId},
              ${item.sourceKind},
              ${item.fieldKey},
              ${item.sourceUrl},
              ${item.status},
              ${item.rawPayload},
              ${item.normalizedPayload}
            )
            on conflict (import_run_id, field_key, source_url) do update
            set
              university_id = excluded.university_id,
              source_kind = excluded.source_kind,
              status = excluded.status,
              raw_payload = excluded.raw_payload,
              normalized_payload = excluded.normalized_payload,
              updated_at = now()
          `;
        }

        await tx`
          update catalog_import_runs
          set
            university_id = ${university.universityId},
            status = ${toDbStatus("succeeded")},
            finished_at = ${nowIso(input.verifiedAt)},
            updated_at = now()
          where id = ${input.runId}
        `;

        return university;
      });

      return {
        universityId: result.universityId,
      };
    },

    async persistFailedImport(input) {
      await sql`
        update catalog_import_runs
        set
          status = ${toDbStatus("failed")},
          failure_code = ${input.failureCode},
          failure_message = ${input.failureMessage},
          finished_at = ${nowIso(input.finishedAt)},
          updated_at = now()
        where id = ${input.runId}
      `;
    },

    async close() {
      await sql.end({ timeout: 0 });
    },
  };
}
