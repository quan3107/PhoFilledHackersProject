// apps/ingest/tests/curation.test.ts
// Tests for the non-database curation CLI helpers.
// Verifies seed lookup, prompt generation, validation, and write-to-disk behavior.

import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCurationPrompt,
  findNextCuratedSchool,
  loadCurationArtifact,
  writeCuratedSchoolArtifact,
} from "../src/curation.js";
import { buildCurationArtifactExample } from "../src/curation-validation.js";
import { validateCurationArtifact } from "../src/curation-validation.js";

test("findNextCuratedSchool returns the first missing QS artifact", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "ingest-curation-"));
  await writeFile(
    path.join(tempDir, "massachusetts-institute-of-technology.json"),
    "{}\n"
  );

  const result = await findNextCuratedSchool({
    curatedSchoolsDir: tempDir,
    seedListPath: new URL(
      "../../../data/curated-schools/qs-us-top-50-2026.json",
      import.meta.url
    ).pathname,
  });

  assert.equal(result.done, false);
  if (!result.done) {
    assert.equal(result.school.slug, "stanford");
    assert.equal(path.basename(result.artifactPath), "stanford.json");
  }
});

test("buildCurationPrompt includes school-specific guidance and the output example", async () => {
  const prompt = await buildCurationPrompt("stanford", {
    seedListPath: new URL(
      "../../../data/curated-schools/qs-us-top-50-2026.json",
      import.meta.url
    ).pathname,
  });

  assert.match(prompt, /Stanford University/);
  assert.match(prompt, /data\/curated-schools\/stanford\.json/);
  assert.match(prompt, /Output shape example:/);
  assert.match(prompt, /public_dataset/);
  assert.match(prompt, /testingRequirements/);
  assert.match(prompt, /averageNetPriceUsd/);
  assert.match(prompt, /programFitTags/);
  assert.match(prompt, /applicationStrategyTags/);
});

test("validateCurationArtifact accepts the current Stanford artifact shape", async () => {
  const raw = JSON.parse(
    await readFile(
      new URL("../../../data/curated-schools/stanford.json", import.meta.url),
      "utf8"
    )
  );

  const result = validateCurationArtifact(raw, "stanford");

  assert.equal(result.ok, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.artifact?.quality.status, "publishable");
});

test("writeCuratedSchoolArtifact writes a validated artifact to disk", async () => {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "ingest-curation-write-")
  );
  const example = buildCurationArtifactExample({
    usRank: 2,
    slug: "stanford",
    schoolName: "Stanford University",
  });

  const outputPath = await writeCuratedSchoolArtifact("stanford", example, {
    curatedSchoolsDir: tempDir,
  });

  const written = JSON.parse(await readFile(outputPath, "utf8")) as {
    schoolSlug: string;
    quality: { status: string };
  };

  assert.equal(path.basename(outputPath), "stanford.json");
  assert.equal(written.schoolSlug, "stanford");
  assert.equal(written.quality.status, "needs_review");
});

test("loadCurationArtifact reads from a file path", async () => {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "ingest-curation-load-")
  );
  const filePath = path.join(tempDir, "sample.json");
  await writeFile(filePath, '{"hello":"world"}\n');

  const loaded = await loadCurationArtifact(filePath);
  assert.deepEqual(loaded, { hello: "world" });
});
