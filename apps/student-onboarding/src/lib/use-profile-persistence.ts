"use client";

import { useState } from "react";

import { authClient } from "@/lib/auth-client";
import type { StudentProfileDocument } from "@/lib/student-profile";

export type SaveResult = { ok: true } | { ok: false; error: string };

export type SaveProfileHandler = (payload: {
  name: string;
  document: StudentProfileDocument;
}) => Promise<SaveResult>;

type UseProfilePersistenceInput = Readonly<{
  document: StudentProfileDocument;
  viewerName: string;
  onSave?: SaveProfileHandler;
  onSaved: () => void;
}>;

export function useProfilePersistence({
  document,
  viewerName,
  onSave,
  onSaved,
}: UseProfilePersistenceInput) {
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const payload = {
        name: viewerName,
        document,
      };
      const saveResult = onSave
        ? await onSave(payload)
        : await defaultSave(payload);

      if (!saveResult.ok) {
        setSaveError(saveResult.error);
        return;
      }

      onSaved();
      setSaveMessage("Saved to the canonical profile and snapshot tables.");
    } catch {
      setSaveError("Unable to save right now. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return {
    handleSave,
    saveError,
    saveMessage,
    saving,
    setSaveError,
    setSaveMessage,
  };
}

async function defaultSave(payload: {
  name: string;
  document: StudentProfileDocument;
}): Promise<SaveResult> {
  const response = await fetch("/api/profile", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      currentProfile: payload.document.current.profile,
      projectedProfile: payload.document.projected.profile,
      currentAssumptions: payload.document.current.assumptions,
      projectedAssumptions: payload.document.projected.assumptions,
    }),
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!response.ok) {
    return {
      ok: false,
      error: body?.error ?? "Unable to save the profile draft.",
    };
  }

  if (payload.name.trim()) {
    await authClient.updateUser({ name: payload.name.trim() } as never);
  }

  return { ok: true };
}
