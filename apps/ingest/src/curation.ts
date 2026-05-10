// apps/ingest/src/curation.ts
// CLI workflow for one-school-at-a-time curation.
// Reads the QS seed list and existing curated artifacts without touching the database path.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildCurationArtifactExample,
  type CuratedSchoolArtifact,
  type CuratedSchoolSeed,
  validateCurationArtifact,
} from "./curation-validation.js";

interface LoadSeedsOptions {
  seedListPath?: string;
}

interface FindNextSchoolOptions extends LoadSeedsOptions {
  curatedSchoolsDir?: string;
}

const repoRootDir = fileURLToPath(new URL("../../../", import.meta.url));
const curatedSchoolsDir = path.join(repoRootDir, "data", "curated-schools");
const seedListPath = path.join(curatedSchoolsDir, "qs-us-top-50-2026.json");

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function loadCuratedSchoolSeeds(
  options: LoadSeedsOptions = {}
): Promise<CuratedSchoolSeed[]> {
  const listPath = options.seedListPath ?? seedListPath;
  const payload = await readJsonFile<{ schools?: CuratedSchoolSeed[] }>(
    listPath
  );
  if (!Array.isArray(payload.schools)) {
    throw new Error(`Invalid QS seed list: ${listPath}`);
  }

  return payload.schools.filter(
    (school): school is CuratedSchoolSeed =>
      !!school &&
      typeof school.slug === "string" &&
      typeof school.schoolName === "string"
  );
}

export async function findNextCuratedSchool(
  options: FindNextSchoolOptions = {}
): Promise<
  | { done: false; school: CuratedSchoolSeed; artifactPath: string }
  | { done: true }
> {
  const schools = await loadCuratedSchoolSeeds({
    seedListPath: options.seedListPath,
  });
  const artifactsDir = options.curatedSchoolsDir ?? curatedSchoolsDir;

  for (const school of schools) {
    const artifactPath = path.join(artifactsDir, `${school.slug}.json`);
    if (!existsSync(artifactPath)) {
      return { done: false, school, artifactPath };
    }
  }

  return { done: true };
}

function renderArtifactExample(seed: CuratedSchoolSeed) {
  return JSON.stringify(buildCurationArtifactExample(seed), null, 2);
}

export async function buildCurationPrompt(
  slug: string,
  options: LoadSeedsOptions = {}
) {
  const schools = await loadCuratedSchoolSeeds(options);
  const school = schools.find((entry) => entry.slug === slug);
  if (!school) {
    throw new Error(`Unknown QS school slug: ${slug}`);
  }

  return [
    "You are curating one US university at a time into a source-backed JSON artifact for a recommendation catalog.",
    "",
    "Allowed sources:",
    "- official university admissions, testing, international, tuition, student budget, and scholarship/aid pages",
    "- College Scorecard for structured selectivity or enrollment inputs",
    "",
    "Hard rules:",
    "- Research exactly one school per run.",
    "- Return facts only when explicitly supported by a source.",
    "- Use null or unknown instead of guessing.",
    "- Do not write recommendation prose.",
    "- Populate recommendationInputs.averageNetPriceUsd when College Scorecard or an official aid page provides it.",
    "- Use recommendationInputs.programFitTags only for broad school-level academic domains that official pages clearly support.",
    "- Use recommendationInputs.programAdmissionModel for direct-admit, separate-school, portfolio or audition, or capacity-limited program signals when the school states them.",
    "- Use recommendationInputs.applicationStrategyTags for binding, restrictive, single-choice, multiple early round, or rolling strategy signals when the school states them.",
    "- Populate recommendationInputs.testingRequirements with school-specific SAT/ACT rules, score-reporting policy, superscoring, writing policy, and middle-50 ranges when sourced.",
    "- Every non-null field must have provenance.",
    `- Write the finished artifact to data/curated-schools/${school.slug}.json before moving on.`,
    "- If some fields are missing, still write the artifact with quality.status set to needs_review and list missingFields.",
    "",
    "School to curate:",
    `- Name: ${school.schoolName}`,
    `- Slug: ${school.slug}`,
    `- QS rank: ${school.usRank}`,
    "",
    "Output shape example:",
    renderArtifactExample(school),
  ].join("\n");
}

async function readStdin() {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf8"))
    );
    process.stdin.on("error", reject);
  });
}

export async function loadCurationArtifact(sourcePath?: string) {
  const raw =
    sourcePath && sourcePath !== "-"
      ? await readFile(sourcePath, "utf8")
      : await readStdin();
  return JSON.parse(raw) as unknown;
}

export async function writeCuratedSchoolArtifact(
  slug: string,
  artifact: CuratedSchoolArtifact,
  options: FindNextSchoolOptions = {}
) {
  const artifactsDir = options.curatedSchoolsDir ?? curatedSchoolsDir;
  await mkdir(artifactsDir, { recursive: true });

  const outputPath = path.join(artifactsDir, `${slug}.json`);
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  return outputPath;
}

export async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  switch (command) {
    case "next": {
      const result = await findNextCuratedSchool();
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    case "prompt": {
      const slug = rest[0];
      if (!slug) {
        throw new Error("Usage: curate prompt <school-slug>");
      }

      const prompt = await buildCurationPrompt(slug);
      process.stdout.write(`${prompt}\n`);
      return prompt;
    }
    case "validate": {
      const sourcePath = rest[0];
      if (!sourcePath) {
        throw new Error("Usage: curate validate <artifact-path|->");
      }

      const raw = await loadCurationArtifact(sourcePath);
      const result = validateCurationArtifact(raw);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) {
        process.exitCode = 1;
      }
      return result;
    }
    case "write": {
      const slug = rest[0];
      if (!slug) {
        throw new Error("Usage: curate write <school-slug> [artifact-path|-]");
      }

      const sourcePath = rest[1];
      const raw = await loadCurationArtifact(sourcePath);
      const validation = validateCurationArtifact(raw, slug);
      if (!validation.ok || !validation.artifact) {
        console.log(JSON.stringify(validation, null, 2));
        process.exitCode = 1;
        return validation;
      }

      const outputPath = await writeCuratedSchoolArtifact(
        slug,
        validation.artifact
      );
      const result = { ok: true, writtenTo: outputPath, schoolSlug: slug };
      console.log(JSON.stringify(result, null, 2));
      return result;
    }
    case undefined:
    case "help":
    default:
      console.log(
        [
          "Usage:",
          "  curate next",
          "  curate prompt <school-slug>",
          "  curate validate <artifact-path|->",
          "  curate write <school-slug> [artifact-path|-]",
        ].join("\n")
      );
      return null;
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error(
      `[curation] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
