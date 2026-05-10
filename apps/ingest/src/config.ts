// apps/ingest/src/config.ts
// Environment and CLI parsing for the ingest runner.
// Fails fast on missing secrets so the runner does not limp along with partial configuration.

import type { IngestConfig, IngestTriggeredBy } from "./types.js";

function getEnvValue(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value.trim();
}

function parseTriggeredBy(value: string | undefined): IngestTriggeredBy {
  if (!value) {
    return "scheduled";
  }

  if (value === "seed" || value === "manual" || value === "scheduled") {
    return value;
  }

  throw new Error(
    `Invalid INGEST_TRIGGERED_BY value "${value}". Expected seed, manual, or scheduled.`
  );
}

function parseReasoningEffort(
  value: string | undefined
): IngestConfig["openAiReasoningEffort"] {
  if (!value) {
    return "minimal";
  }

  if (
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
  ) {
    return value;
  }

  throw new Error(
    `Invalid INGEST_OPENAI_REASONING_EFFORT value "${value}". Expected minimal, low, medium, high, or xhigh.`
  );
}

function parseBrowserApiConfig(env: NodeJS.ProcessEnv) {
  const username = env.BRIGHT_DATA_BROWSER_USERNAME?.trim() || null;
  const password = env.BRIGHT_DATA_BROWSER_PASSWORD?.trim() || null;
  const websocketEndpoint = env.BRIGHT_DATA_BROWSER_WSS?.trim() || null;

  if ((username && !password) || (!username && password)) {
    throw new Error(
      "BRIGHT_DATA_BROWSER_USERNAME and BRIGHT_DATA_BROWSER_PASSWORD must be set together."
    );
  }

  return {
    username,
    password,
    websocketEndpoint,
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

export function loadIngestConfig(
  env: NodeJS.ProcessEnv = process.env,
  argv: string[] = process.argv.slice(2)
): IngestConfig {
  const schoolSlug =
    readSchoolSlugFromArgs(argv) || env.INGEST_SCHOOL_SLUG?.trim() || null;
  const browserApiConfig = parseBrowserApiConfig(env);

  return {
    databaseUrl: getEnvValue(env, "DATABASE_URL"),
    brightDataApiKey: getEnvValue(env, "BRIGHT_DATA_API_KEY"),
    brightDataZone: getEnvValue(env, "BRIGHT_DATA_ZONE"),
    brightDataBrowserUsername: browserApiConfig.username,
    brightDataBrowserPassword: browserApiConfig.password,
    brightDataBrowserWSEndpoint: browserApiConfig.websocketEndpoint,
    openAiApiKey: getEnvValue(env, "OPENAI_API_KEY"),
    openAiModel: env.INGEST_OPENAI_MODEL?.trim() || "gpt-5-nano",
    openAiReasoningEffort: parseReasoningEffort(
      env.INGEST_OPENAI_REASONING_EFFORT
    ),
    triggeredBy: parseTriggeredBy(env.INGEST_TRIGGERED_BY),
    schoolSlug,
  };
}
