// apps/ingest/src/repository.ts
// Postgres-backed persistence for the ingest runner.
// Keeps the raw SQL contained in one file so the runner can stay focused on orchestration.

import postgres from "postgres";

import type {
  IngestRepository,
  PersistSuccessfulImportInput,
} from "./types.js";

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
        const universityRows = (await tx`
          insert into universities (
            school_name,
            city,
            state,
            official_admissions_url,
            application_rounds,
            deadlines_by_round,
            english_requirements,
            test_policy,
            required_materials,
            tuition_annual_usd,
            estimated_cost_of_attendance_usd,
            living_cost_estimate_usd,
            scholarship_availability_flag,
            scholarship_notes,
            recommendation_inputs,
            explanation_inputs,
            last_verified_at,
            validation_status,
            validation_reasons
          )
          values (
            ${input.record.schoolName},
            ${input.record.city},
            ${input.record.state},
            ${input.record.officialAdmissionsUrl},
            ${input.record.applicationRounds},
            ${input.record.deadlinesByRound},
            ${input.record.englishRequirements},
            ${input.record.testPolicy},
            ${input.record.requiredMaterials},
            ${input.record.tuitionAnnualUsd},
            ${input.record.estimatedCostOfAttendanceUsd},
            ${input.record.livingCostEstimateUsd},
            ${input.record.scholarshipAvailabilityFlag},
            ${input.record.scholarshipNotes},
            ${input.record.recommendationInputs},
            ${input.record.explanationInputs},
            ${nowIso(input.record.lastVerifiedAt)},
            ${input.validation.status},
            ${input.validation.reasons}
          )
          on conflict (official_admissions_url) do update
          set
            school_name = excluded.school_name,
            city = excluded.city,
            state = excluded.state,
            application_rounds = excluded.application_rounds,
            deadlines_by_round = excluded.deadlines_by_round,
            english_requirements = excluded.english_requirements,
            test_policy = excluded.test_policy,
            required_materials = excluded.required_materials,
            tuition_annual_usd = excluded.tuition_annual_usd,
            estimated_cost_of_attendance_usd = excluded.estimated_cost_of_attendance_usd,
            living_cost_estimate_usd = excluded.living_cost_estimate_usd,
            scholarship_availability_flag = excluded.scholarship_availability_flag,
            scholarship_notes = excluded.scholarship_notes,
            recommendation_inputs = excluded.recommendation_inputs,
            explanation_inputs = excluded.explanation_inputs,
            last_verified_at = excluded.last_verified_at,
            validation_status = excluded.validation_status,
            validation_reasons = excluded.validation_reasons,
            updated_at = now()
          returning id
        `) as Array<{ id: string }>;

        const university = universityRows[0];
        if (!university) {
          throw new Error("Failed to persist university row.");
        }

        for (const source of input.selectedSources) {
          await tx`
            insert into university_sources (
              university_id,
              source_kind,
              field_key,
              source_url,
              excerpt,
              last_verified_at,
              is_primary,
              metadata
            )
            values (
              ${university.id},
              ${source.sourceKind},
              ${source.fieldKey},
              ${source.sourceUrl},
              ${source.excerpt},
              ${nowIso(input.verifiedAt)},
              ${true},
              ${{
                ...source.metadata,
                notes: `Branch-3 ingest provenance for ${source.fieldKey}.`,
              }}
            )
            on conflict (university_id, field_key, source_url) do update
            set
              source_kind = excluded.source_kind,
              excerpt = excluded.excerpt,
              last_verified_at = excluded.last_verified_at,
              is_primary = excluded.is_primary,
              metadata = excluded.metadata
          `;
        }

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
              ${university.id},
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
            university_id = ${university.id},
            status = ${toDbStatus("succeeded")},
            finished_at = ${nowIso(input.verifiedAt)},
            updated_at = now()
          where id = ${input.runId}
        `;

        return university;
      });

      return {
        universityId: result.id,
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
