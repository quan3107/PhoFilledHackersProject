// apps/ingest/src/import-curated.ts
// Drizzle-based importer for curated school JSON artifacts.
// Loads the validated curated catalog into the canonical university tables without rerunning live crawl/extract steps.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  catalogRequiredFields,
  universities,
  universitySources,
  type DeadlinesByRound,
  type CatalogRequiredField,
  type UniversitySourceKind,
  type UniversityValidationReason,
} from "@etest/db";

import { validateCurationArtifact } from "./curation-validation.js";
import { initializeIngestEnv } from "./env.js";

const repoRootDir = fileURLToPath(new URL("../../../", import.meta.url));
const curatedSchoolsDir = path.join(repoRootDir, "data", "curated-schools");

type ImportStatus = "publishable" | "draft";

interface ImportOptions {
  schoolSlug: string | null;
}

interface ProvenanceSourceRow {
  universityId: string;
  sourceKind: UniversitySourceKind;
  fieldKey: string;
  sourceUrl: string;
  excerpt: string | null;
  lastVerifiedAt: Date;
  isPrimary: boolean;
  metadata: {
    notes?: string;
  };
}

function readSchoolSlugFromArgs(argv: string[]) {
  const explicitFlag = argv.find((argument) =>
    argument.startsWith("--school=")
  );
  if (explicitFlag) {
    return explicitFlag.slice("--school=".length).trim();
  }

  const position = argv.indexOf("--school");
  if (position >= 0 && typeof argv[position + 1] === "string") {
    return argv[position + 1].trim();
  }

  return null;
}

function parseOptions(argv: string[]): ImportOptions {
  return {
    schoolSlug: readSchoolSlugFromArgs(argv),
  };
}

function mapQualityStatusToValidationStatus(status: string): ImportStatus {
  return status === "publishable" ? "publishable" : "draft";
}

function buildValidationReasons(
  artifact: ReturnType<typeof validateCurationArtifact>["artifact"]
): UniversityValidationReason[] {
  if (!artifact || artifact.quality.status === "publishable") {
    return [];
  }

  const allowedFields = new Set(catalogRequiredFields);
  return artifact.quality.missingFields.flatMap((field) => {
    if (!allowedFields.has(field as CatalogRequiredField)) {
      return [];
    }

    return [
      {
        code: "missing_required_field",
        field: field as CatalogRequiredField,
        message: `Curated artifact marked needs_review: ${field}`,
      },
    ];
  });
}

function toDbDeadlines(
  deadlinesByRound: Record<string, string | null | undefined>
): DeadlinesByRound {
  const result: DeadlinesByRound = {};

  for (const [round, value] of Object.entries(deadlinesByRound)) {
    if (typeof value === "string") {
      result[round as keyof DeadlinesByRound] = value;
    }
  }

  return result;
}

function mapCurationSourceKind(sourceKind: string): {
  sourceKind: UniversitySourceKind;
  note: string | null;
} {
  if (
    sourceKind === "official_admissions" ||
    sourceKind === "official_tuition" ||
    sourceKind === "official_cost_of_attendance" ||
    sourceKind === "official_scholarship"
  ) {
    return { sourceKind, note: null };
  }

  return {
    sourceKind: "manual_review",
    note: `Imported curated provenance with original source kind "${sourceKind}".`,
  };
}

function pickPreferredSourceKind(
  current: UniversitySourceKind,
  candidate: UniversitySourceKind
): UniversitySourceKind {
  if (current === candidate) {
    return current;
  }

  if (current === "manual_review") {
    return candidate;
  }

  if (candidate === "manual_review") {
    return current;
  }

  return current;
}

function mergeExcerpts(existing: string | null, incoming: string | null) {
  const excerpts = new Set<string>();
  for (const excerpt of [existing, incoming]) {
    if (typeof excerpt === "string" && excerpt.trim().length > 0) {
      excerpts.add(excerpt.trim());
    }
  }

  if (excerpts.size === 0) {
    return null;
  }

  return Array.from(excerpts).join("\n");
}

async function loadArtifactFileNames(options: ImportOptions) {
  if (options.schoolSlug) {
    return [`${options.schoolSlug}.json`];
  }

  const fileNames = await readdir(curatedSchoolsDir);
  return fileNames
    .filter(
      (fileName) =>
        fileName.endsWith(".json") && fileName !== "qs-us-top-50-2026.json"
    )
    .sort();
}

async function loadValidatedArtifact(fileName: string) {
  const filePath = path.join(curatedSchoolsDir, fileName);
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const slug = fileName.replace(/\.json$/, "");
  const validation = validateCurationArtifact(raw, slug);
  if (!validation.ok || !validation.artifact) {
    throw new Error(
      `Curated artifact "${fileName}" is invalid: ${JSON.stringify(validation.issues)}`
    );
  }

  return validation.artifact;
}

export async function importCuratedSchools(argv = process.argv.slice(2)) {
  initializeIngestEnv();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing DATABASE_URL.");
  }

  const options = parseOptions(argv);
  const fileNames = await loadArtifactFileNames(options);
  if (fileNames.length === 0) {
    throw new Error("No curated school artifacts were found to import.");
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 1,
  });
  const db = drizzle(client, { schema: { universities, universitySources } });

  let importedCount = 0;
  try {
    for (const fileName of fileNames) {
      const artifact = await loadValidatedArtifact(fileName);
      const validationStatus = mapQualityStatusToValidationStatus(
        artifact.quality.status
      );
      const lastVerifiedAt = new Date(
        `${artifact.lastVerifiedAt}T00:00:00.000Z`
      );
      const deadlinesByRound = toDbDeadlines(artifact.deadlinesByRound);
      const validationReasons = buildValidationReasons(artifact);

      await db.transaction(async (tx) => {
        const [upsertedUniversity] = await tx
          .insert(universities)
          .values({
            schoolName: artifact.identity.schoolName,
            city: artifact.identity.city,
            state: artifact.identity.state,
            officialAdmissionsUrl: artifact.identity.officialAdmissionsUrl,
            applicationRounds: artifact.applicationRounds,
            deadlinesByRound,
            englishRequirements: artifact.englishRequirements,
            testPolicy: artifact.testPolicy,
            requiredMaterials: artifact.requiredMaterials,
            tuitionAnnualUsd: artifact.tuitionAnnualUsd,
            estimatedCostOfAttendanceUsd: artifact.estimatedCostOfAttendanceUsd,
            livingCostEstimateUsd: artifact.livingCostEstimateUsd,
            scholarshipAvailabilityFlag: artifact.scholarshipAvailabilityFlag,
            scholarshipNotes: artifact.scholarshipNotes,
            recommendationInputs: artifact.recommendationInputs,
            explanationInputs: artifact.explanationInputs,
            lastVerifiedAt,
            validationStatus,
            validationReasons,
          })
          .onConflictDoUpdate({
            target: universities.officialAdmissionsUrl,
            set: {
              schoolName: artifact.identity.schoolName,
              city: artifact.identity.city,
              state: artifact.identity.state,
              applicationRounds: artifact.applicationRounds,
              deadlinesByRound,
              englishRequirements: artifact.englishRequirements,
              testPolicy: artifact.testPolicy,
              requiredMaterials: artifact.requiredMaterials,
              tuitionAnnualUsd: artifact.tuitionAnnualUsd,
              estimatedCostOfAttendanceUsd:
                artifact.estimatedCostOfAttendanceUsd,
              livingCostEstimateUsd: artifact.livingCostEstimateUsd,
              scholarshipAvailabilityFlag: artifact.scholarshipAvailabilityFlag,
              scholarshipNotes: artifact.scholarshipNotes,
              recommendationInputs: artifact.recommendationInputs,
              explanationInputs: artifact.explanationInputs,
              lastVerifiedAt,
              validationStatus,
              validationReasons,
            },
          })
          .returning({
            id: universities.id,
          });

        if (!upsertedUniversity) {
          throw new Error(
            `Failed to upsert university for "${artifact.identity.schoolName}".`
          );
        }

        await tx
          .delete(universitySources)
          .where(eq(universitySources.universityId, upsertedUniversity.id));

        const provenanceRowsByKey = new Map<string, ProvenanceSourceRow>();
        for (const [fieldKey, entries] of Object.entries(
          artifact.fieldProvenance
        )) {
          entries.forEach((entry, index) => {
            const mapped = mapCurationSourceKind(entry.sourceKind);
            const key = `${fieldKey}::${entry.sourceUrl}`;
            const existing = provenanceRowsByKey.get(key);

            if (existing) {
              existing.sourceKind = pickPreferredSourceKind(
                existing.sourceKind,
                mapped.sourceKind
              );
              existing.excerpt = mergeExcerpts(existing.excerpt, entry.excerpt);
              if (mapped.note) {
                existing.metadata.notes = existing.metadata.notes
                  ? `${existing.metadata.notes}; ${mapped.note}`
                  : mapped.note;
              }
              return;
            }

            provenanceRowsByKey.set(key, {
              universityId: upsertedUniversity.id,
              sourceKind: mapped.sourceKind,
              fieldKey,
              sourceUrl: entry.sourceUrl,
              excerpt: entry.excerpt,
              lastVerifiedAt,
              isPrimary: index === 0,
              metadata: {
                notes: mapped.note ?? undefined,
              },
            });
          });
        }

        const provenanceRows = Array.from(provenanceRowsByKey.values());

        if (provenanceRows.length > 0) {
          await tx.insert(universitySources).values(provenanceRows);
        }
      });

      importedCount += 1;
      console.log(`[import-curated] imported ${artifact.schoolSlug}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          importedCount,
          mode: options.schoolSlug ? "single" : "all",
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
  importCuratedSchools().catch((error: unknown) => {
    console.error(
      `[import-curated] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
