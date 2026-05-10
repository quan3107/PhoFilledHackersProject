// apps/ingest/src/manifest.ts
// Checked-in one-school allowlist for the branch-3 runner.
// Keeps the runtime deterministic while leaving room to add more QS-backed candidates later.

import type { SeedSchool } from "./types.js";

export const seedSchools = [
  {
    slug: "stanford",
    schoolName: "Stanford University",
    city: "Stanford",
    state: "CA",
    officialAdmissionsUrl: "https://admission.stanford.edu/",
    sourceUrls: {
      admissions: "https://admission.stanford.edu/",
      tuition: "https://studentservices.stanford.edu/my-finances/tuition-fees",
      costOfAttendance: "https://financialaid.stanford.edu/undergrad/budget/",
      scholarship:
        "https://financialaid.stanford.edu/undergrad/types/index.html",
    },
  },
] as const satisfies readonly SeedSchool[];

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export function resolveSeedSchool(slug: string | null | undefined) {
  if (!slug) {
    if (seedSchools.length === 1) {
      return seedSchools[0]!;
    }

    throw new Error("An ingest school slug is required.");
  }

  const normalizedSlug = normalizeSlug(slug);
  const school = seedSchools.find(
    (candidate) => candidate.slug === normalizedSlug
  );

  if (!school) {
    throw new Error(
      `Unknown ingest school slug "${slug}". Valid options: ${seedSchools
        .map((candidate) => candidate.slug)
        .join(", ")}`
    );
  }

  return school;
}
