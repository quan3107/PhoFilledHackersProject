// apps/ingest/src/bright-data-browser.ts
// Browser API fallback for blocked Bright Data HTTP fetches.
// Uses a rendered browser session only when Unlocker cannot access a page directly.

import type { BrightDataPage, BrightDataSourceKind } from "./types.js";

export interface BrowserApiConfig {
  websocketEndpoint?: string;
  username?: string;
  password?: string;
}

function buildBrowserWSEndpoint(config: BrowserApiConfig) {
  if (config.websocketEndpoint) {
    return config.websocketEndpoint;
  }

  if (!config.username || !config.password) {
    return null;
  }

  const username = encodeURIComponent(config.username);
  const password = encodeURIComponent(config.password);
  return `wss://${username}:${password}@brd.superproxy.io:9222`;
}

export async function fetchWithBrowserApi(
  config: BrowserApiConfig,
  input: {
    sourceKind: BrightDataSourceKind;
    sourceUrl: string;
  }
): Promise<BrightDataPage> {
  const wsEndpoint = buildBrowserWSEndpoint(config);
  if (!wsEndpoint) {
    throw new Error("Bright Data Browser API credentials are not configured.");
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.connectOverCDP(wsEndpoint);

  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();

    try {
      const response = await page.goto(input.sourceUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      await page
        .waitForLoadState("networkidle", { timeout: 10_000 })
        .catch(() => undefined);

      const body = await page.content();
      const headers = response
        ? await response.allHeaders().catch(() => ({}))
        : {};

      return {
        sourceKind: input.sourceKind,
        sourceUrl: page.url(),
        statusCode: response?.status() ?? 200,
        headers,
        body,
        fetchedAt: new Date(),
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
}
