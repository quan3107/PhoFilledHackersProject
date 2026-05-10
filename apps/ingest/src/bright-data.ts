// apps/ingest/src/bright-data.ts
// Thin Bright Data Unlocker client for the runner's one-school fetch step.
// Uses a direct REST call so the ingest slice stays simple and testable.

import {
  fetchWithBrowserApi,
  type BrowserApiConfig,
} from "./bright-data-browser.js";
import type {
  BrightDataClient,
  BrightDataPage,
  BrightDataSourceKind,
} from "./types.js";

interface BrightDataRequestBody {
  zone: string;
  url: string;
  method: "GET";
  format: "raw";
}

interface BrightDataApiResponse {
  status_code: number;
  body: string;
  headers?: Record<string, string | number | boolean>;
  url?: string;
}

function normalizeHeaders(
  headers: Record<string, string | number | boolean> | undefined
) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    normalized[key] = String(value);
  }

  return normalized;
}

function shouldUseBrowserFallback(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("bad_endpoint") ||
    message.includes("robots.txt") ||
    message.includes("immediate access mode")
  );
}

async function readApiResponse(response: Response) {
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Bright Data Unlocker request failed with HTTP ${response.status}: ${responseText}`
    );
  }

  try {
    return JSON.parse(responseText) as BrightDataApiResponse;
  } catch {
    return {
      status_code: response.status,
      body: responseText,
      headers: Object.fromEntries(response.headers.entries()),
    } satisfies BrightDataApiResponse;
  }
}

async function fetchWithUnlocker(
  input: {
    apiKey: string;
    zone: string;
    endpoint: string;
    sourceKind: BrightDataSourceKind;
    sourceUrl: string;
  },
  fetchImpl: typeof fetch
): Promise<BrightDataPage> {
  const body: BrightDataRequestBody = {
    zone: input.zone,
    url: input.sourceUrl,
    method: "GET",
    format: "raw",
  };

  const response = await fetchImpl(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = await readApiResponse(response);
  if (typeof payload.status_code !== "number") {
    throw new Error("Bright Data Unlocker response is missing status_code.");
  }

  if (typeof payload.body !== "string") {
    throw new Error("Bright Data Unlocker response is missing body content.");
  }

  return {
    sourceKind: input.sourceKind,
    sourceUrl: payload.url ?? input.sourceUrl,
    statusCode: payload.status_code,
    body: payload.body,
    headers: normalizeHeaders(payload.headers),
    fetchedAt: new Date(),
  };
}

export function createBrightDataClient(
  input: {
    apiKey: string;
    zone: string;
    browserApi?: BrowserApiConfig;
    endpoint?: string;
  },
  deps: {
    fetchImpl?: typeof fetch;
    fetchWithBrowserApiImpl?: typeof fetchWithBrowserApi;
  } = {}
): BrightDataClient {
  const endpoint = input.endpoint ?? "https://api.brightdata.com/request";
  const fetchImpl = deps.fetchImpl ?? fetch;
  const fetchWithBrowserApiImpl =
    deps.fetchWithBrowserApiImpl ?? fetchWithBrowserApi;

  return {
    async fetchPage({ sourceKind, sourceUrl }): Promise<BrightDataPage> {
      try {
        return await fetchWithUnlocker(
          {
            apiKey: input.apiKey,
            zone: input.zone,
            endpoint,
            sourceKind,
            sourceUrl,
          },
          fetchImpl
        );
      } catch (error) {
        if (!input.browserApi || !shouldUseBrowserFallback(error)) {
          throw error;
        }

        return fetchWithBrowserApiImpl(input.browserApi, {
          sourceKind,
          sourceUrl,
        });
      }
    },
  };
}
