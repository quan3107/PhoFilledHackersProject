// Shared Drizzle-backed persistence for normalized university catalog records.
// Used by both live ingest and curated imports to keep upsert semantics aligned.

import { eq } from "drizzle-orm";

import { universities, universitySources } from "@etest/db";
import type { UniversitySourceKind } from "@etest/api-contracts";
import type {
  UniversitySourceMetadata,
  UniversityValidationReason,
  UniversityValidationStatus,
} from "@etest/db";

import type { NormalizedUniversityCatalogRecord } from "./types.js";

export interface NormalizedUniversitySourceRecord {
  sourceKind: UniversitySourceKind;
  fieldKey: string;
  sourceUrl: string;
  excerpt: string | null;
  isPrimary: boolean;
  metadata: UniversitySourceMetadata;
}

export interface PersistUniversityCatalogRecordCommand {
  university: NormalizedUniversityCatalogRecord & {
    validationStatus?: Extract<
      UniversityValidationStatus,
      "publishable" | "draft" | "rejected"
    >;
    validationReasons?: UniversityValidationReason[];
  };
  sources: NormalizedUniversitySourceRecord[];
  sourceReplacementPolicy: "replace_all" | "upsert_and_mark_stale";
  importedAt: Date;
}

type CatalogPersistenceDatabase = {
  transaction<T>(
    callback: (tx: CatalogPersistenceTransaction) => Promise<T>
  ): Promise<T>;
};

type InsertBuilder = {
  values: (values: unknown) => {
    onConflictDoUpdate: (options: unknown) => {
      returning: (fields: unknown) => Promise<Array<{ id: string }>>;
    };
  };
};

type DeleteBuilder = {
  where: (condition: unknown) => Promise<unknown>;
};

type CatalogPersistenceTransaction = {
  insert: (
    table: typeof universities | typeof universitySources
  ) => InsertBuilder;
  delete: (table: typeof universitySources) => DeleteBuilder;
};

type CatalogPersistenceConnection =
  | CatalogPersistenceDatabase
  | CatalogPersistenceTransaction;

function buildUniversityValues(command: PersistUniversityCatalogRecordCommand) {
  return {
    schoolName: command.university.schoolName,
    city: command.university.city,
    state: command.university.state,
    officialAdmissionsUrl: command.university.officialAdmissionsUrl,
    applicationRounds: command.university.applicationRounds,
    deadlinesByRound: command.university.deadlinesByRound,
    englishRequirements: command.university.englishRequirements,
    testPolicy: command.university.testPolicy,
    requiredMaterials: command.university.requiredMaterials,
    tuitionAnnualUsd: command.university.tuitionAnnualUsd,
    estimatedCostOfAttendanceUsd:
      command.university.estimatedCostOfAttendanceUsd,
    livingCostEstimateUsd: command.university.livingCostEstimateUsd,
    scholarshipAvailabilityFlag: command.university.scholarshipAvailabilityFlag,
    scholarshipNotes: command.university.scholarshipNotes,
    recommendationInputs: command.university.recommendationInputs,
    explanationInputs: command.university.explanationInputs,
    lastVerifiedAt: command.university.lastVerifiedAt,
    validationStatus: command.university.validationStatus ?? "draft",
    validationReasons: command.university.validationReasons ?? [],
  };
}

export async function persistUniversityCatalogRecord(
  db: unknown,
  command: PersistUniversityCatalogRecordCommand
) {
  const connection = db as CatalogPersistenceConnection;
  const persist = async (tx: CatalogPersistenceTransaction) => {
    const values = buildUniversityValues(command);
    const [upsertedUniversity] = await tx
      .insert(universities)
      .values(values)
      .onConflictDoUpdate({
        target: universities.officialAdmissionsUrl,
        set: values,
      })
      .returning({ id: universities.id });

    if (!upsertedUniversity) {
      throw new Error(
        `Failed to upsert university for "${command.university.schoolName}".`
      );
    }

    if (command.sourceReplacementPolicy === "replace_all") {
      await tx
        .delete(universitySources)
        .where(eq(universitySources.universityId, upsertedUniversity.id));
    }

    for (const source of command.sources) {
      await tx
        .insert(universitySources)
        .values({
          universityId: upsertedUniversity.id,
          sourceKind: source.sourceKind,
          fieldKey: source.fieldKey,
          sourceUrl: source.sourceUrl,
          excerpt: source.excerpt,
          lastVerifiedAt: command.importedAt,
          isPrimary: source.isPrimary,
          metadata: source.metadata,
        })
        .onConflictDoUpdate({
          target: [
            universitySources.universityId,
            universitySources.fieldKey,
            universitySources.sourceUrl,
          ],
          set: {
            sourceKind: source.sourceKind,
            excerpt: source.excerpt,
            lastVerifiedAt: command.importedAt,
            isPrimary: source.isPrimary,
            metadata: source.metadata,
          },
        });
    }

    return { universityId: upsertedUniversity.id };
  };

  if ("transaction" in connection) {
    return connection.transaction(persist);
  }

  return persist(connection);
}
