"use client";

import { useMemo, useState } from "react";

import {
  buildStudentOnboardingSummary,
  cloneStudentProfileDocument,
  type StudentOnboardingSnapshotKind,
} from "@/lib/student-onboarding";
import {
  getStudentProfileMissingFields,
  type StudentProfile,
  type StudentProfileDocument,
} from "@/lib/student-profile";

export function updateStudentProfileSnapshot(
  document: StudentProfileDocument,
  snapshotKind: StudentOnboardingSnapshotKind,
  updater: (profile: StudentProfile) => StudentProfile
): StudentProfileDocument {
  const next = cloneStudentProfileDocument(document);
  next[snapshotKind].profile = updater(next[snapshotKind].profile);
  return next;
}

export function updateStudentProfileAssumptions(
  document: StudentProfileDocument,
  snapshotKind: StudentOnboardingSnapshotKind,
  assumptions: string[]
): StudentProfileDocument {
  const next = cloneStudentProfileDocument(document);
  next[snapshotKind].assumptions = assumptions
    .map((value) => value.trim())
    .filter(Boolean);
  return next;
}

export function useStudentOnboardingState(
  initialDocument: StudentProfileDocument
) {
  const [document, setDocument] = useState<StudentProfileDocument>(() =>
    cloneStudentProfileDocument(initialDocument)
  );
  const [dirty, setDirty] = useState(false);

  const missingFields = useMemo(
    () => getStudentProfileMissingFields(document),
    [document]
  );
  const summary = useMemo(
    () => buildStudentOnboardingSummary(document),
    [document]
  );

  function updateSnapshotProfile(
    snapshotKind: StudentOnboardingSnapshotKind,
    updater: (profile: StudentProfile) => StudentProfile
  ) {
    setDocument((existing) =>
      updateStudentProfileSnapshot(existing, snapshotKind, updater)
    );
    setDirty(true);
  }

  function updateSnapshotAssumptions(
    snapshotKind: StudentOnboardingSnapshotKind,
    assumptions: string[]
  ) {
    setDocument((existing) =>
      updateStudentProfileAssumptions(existing, snapshotKind, assumptions)
    );
    setDirty(true);
  }

  function replaceDocument(nextDocument: StudentProfileDocument) {
    setDocument(cloneStudentProfileDocument(nextDocument));
  }

  return {
    document,
    dirty,
    missingFields,
    replaceDocument,
    setDirty,
    setDocument,
    summary,
    updateSnapshotAssumptions,
    updateSnapshotProfile,
  };
}
