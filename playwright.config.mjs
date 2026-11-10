import { defineConfig } from "@playwright/test";

const baseURL = process.env.E2E_URL || "http://127.0.0.1:18081";

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: [
    ["list"],
    ["json", { outputFile: "artifacts/playwright.json" }],
    ["junit", { outputFile: "artifacts/playwright.xml" }],
    ["html", { outputFolder: "artifacts/playwright-html", open: "never" }],
  ],
  outputDir: "artifacts/playwright-results",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  ...(process.env.E2E_URL
    ? {}
    : {
        webServer: {
          command: "./dist/api",
          url: `${baseURL}/api/health`,
          env: {
            HTTP_ADDR: "127.0.0.1:18081",
            WEB_ROOT: "dist/web",
            DATABASE_URL: process.env.TEST_DATABASE_URL,
          },
        },
      }),
});
