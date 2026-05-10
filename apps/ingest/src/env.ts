// apps/ingest/src/env.ts
// Local env bootstrap for the ingest runner.
// Auto-loads the repo root .env file so local runs do not require shell sourcing first.

import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

interface InitializeIngestEnvOptions {
  cwd?: string;
  moduleUrl?: string;
  existsSyncImpl?: typeof existsSync;
  loadEnvFileImpl?: typeof loadEnvFile;
}

function toRepoRootEnvPath(moduleUrl: string) {
  return new URL("../../../.env", moduleUrl);
}

export function initializeIngestEnv(options: InitializeIngestEnvOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const moduleUrl = options.moduleUrl ?? import.meta.url;
  const existsSyncImpl = options.existsSyncImpl ?? existsSync;
  const loadEnvFileImpl = options.loadEnvFileImpl ?? loadEnvFile;

  const candidatePaths = [`${cwd}/.env`, toRepoRootEnvPath(moduleUrl)];

  for (const candidatePath of candidatePaths) {
    if (!existsSyncImpl(candidatePath)) {
      continue;
    }

    loadEnvFileImpl(candidatePath);
    break;
  }
}
