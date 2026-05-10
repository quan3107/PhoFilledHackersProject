// packages/db/src/schema/imports.ts
// Import-run tables for the offline catalog pipeline's canonical state machine.
// Captures run and item-level failures without mixing ingest payloads into school rows.

import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  type CatalogImportItemPayload,
  type CatalogImportRunMetadata,
  catalogImportStatuses,
} from "./types.js";
import { universities, universitySourceKindEnum } from "./universities.js";

export const catalogImportStatusEnum = pgEnum(
  "catalog_import_status",
  catalogImportStatuses
);

export const catalogImportRuns = pgTable(
  "catalog_import_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    universityId: uuid("university_id").references(() => universities.id, {
      onDelete: "set null",
    }),
    requestedSchoolName: text("requested_school_name").notNull(),
    status: catalogImportStatusEnum("status").notNull().default("pending"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    metadata: jsonb("metadata")
      .$type<CatalogImportRunMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    statusIdx: index("catalog_import_runs_status_idx").on(table.status),
  })
);

export const catalogImportItems = pgTable(
  "catalog_import_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => catalogImportRuns.id, { onDelete: "cascade" }),
    universityId: uuid("university_id").references(() => universities.id, {
      onDelete: "set null",
    }),
    sourceKind: universitySourceKindEnum("source_kind").notNull(),
    fieldKey: text("field_key").notNull(),
    sourceUrl: text("source_url").notNull(),
    status: catalogImportStatusEnum("status").notNull().default("pending"),
    rawPayload: jsonb("raw_payload")
      .$type<CatalogImportItemPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    normalizedPayload: jsonb("normalized_payload")
      .$type<CatalogImportItemPayload>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    runFieldSourceIdx: uniqueIndex("catalog_import_items_run_field_url_idx").on(
      table.importRunId,
      table.fieldKey,
      table.sourceUrl
    ),
    runIdIdx: index("catalog_import_items_run_id_idx").on(table.importRunId),
  })
);
