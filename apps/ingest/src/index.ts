// apps/ingest/src/index.ts
// Entry point for the one-school ingest runner.
// Loads secrets, resolves the configured school, and executes the canonical ingest flow.

import { pathToFileURL } from "node:url";

import { createBrightDataClient } from "./bright-data.js";
import { loadIngestConfig } from "./config.js";
import { initializeIngestEnv } from "./env.js";
import { createOpenAiExtractionClient } from "./openai.js";
import { createPostgresIngestRepository } from "./repository.js";
import { runIngest } from "./runner.js";

export async function main(argv = process.argv.slice(2)) {
  initializeIngestEnv();
  const config = loadIngestConfig(process.env, argv);
  const repository = createPostgresIngestRepository(config.databaseUrl);
  const browserApi =
    config.brightDataBrowserWSEndpoint ||
    config.brightDataBrowserUsername ||
    config.brightDataBrowserPassword
      ? {
          username: config.brightDataBrowserUsername ?? undefined,
          password: config.brightDataBrowserPassword ?? undefined,
          websocketEndpoint: config.brightDataBrowserWSEndpoint ?? undefined,
        }
      : undefined;
  const brightData = createBrightDataClient({
    apiKey: config.brightDataApiKey,
    zone: config.brightDataZone,
    browserApi,
  });
  const openAi = createOpenAiExtractionClient({
    apiKey: config.openAiApiKey,
    model: config.openAiModel,
    reasoningEffort: config.openAiReasoningEffort,
  });

  try {
    const result = await runIngest(config, {
      repository,
      brightData,
      openAi,
    });

    console.log(
      `[ingest] run=${result.runId} university=${result.universityId} validation=${result.validationStatus} items=${result.itemCount}`
    );
    return result;
  } finally {
    await repository.close();
  }
}

const isEntrypoint =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  main().catch((error: unknown) => {
    console.error(
      `[ingest] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
