// apps/student-onboarding/src/lib/location-preferences.ts
// Shared UI labels and parsing for location-preference extensions.
// Keeps the frontend mapping aligned with the canonical backend enum contract.

import {
  studentLocationPreferenceLabels,
  studentLocationPreferenceKinds,
  type StudentLocationPreferenceKind,
} from "@etest/db";

export const locationPreferenceLabels = studentLocationPreferenceLabels;

export const locationPreferenceKinds = [...studentLocationPreferenceKinds];

export const locationPreferenceOptions = locationPreferenceKinds.map(
  (kind) => locationPreferenceLabels[kind]
);

export function formatLocationPreferences(input: {
  preferredStates: string[];
  preferredLocationPreferences: readonly StudentLocationPreferenceKind[];
}) {
  if (input.preferredLocationPreferences.length > 0) {
    return input.preferredLocationPreferences
      .map((kind) => locationPreferenceLabels[kind])
      .join(", ");
  }

  return input.preferredStates.join(", ");
}

export function parseLocationPreferences(value: string) {
  const normalizedValues = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const preferredStates: string[] = [];
  const preferredLocationPreferences = new Set<StudentLocationPreferenceKind>();
  const labelToKind = new Map(
    locationPreferenceKinds.map((kind) => [
      locationPreferenceLabels[kind].toLowerCase(),
      kind,
    ])
  );

  for (const entry of normalizedValues) {
    const matchedKind = labelToKind.get(entry.toLowerCase());

    if (matchedKind) {
      preferredLocationPreferences.add(matchedKind);
    } else if (/^[A-Za-z]{2}$/.test(entry)) {
      preferredStates.push(entry.toUpperCase());
    }
  }

  return {
    preferredStates,
    preferredLocationPreferences: [...preferredLocationPreferences],
  };
}
