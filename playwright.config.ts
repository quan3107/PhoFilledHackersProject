import { defineConfig } from "@playwright/test";

export default defineConfig({
  testMatch: ["playwright-qa.spec.ts"],
  use: { baseURL: "http://127.0.0.1:3001" },
  webServer: {
    command: "npm --workspace student-onboarding run dev",
    url: "http://127.0.0.1:3001/qa-smoke",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
