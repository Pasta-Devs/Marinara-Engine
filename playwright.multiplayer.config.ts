import { defineConfig, devices } from "@playwright/test";

// A self-contained trusted-client/hostile-peer proof. No Engine data or model is used.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "multiplayer-guest-isolation.e2e.ts",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { screenshot: "only-on-failure", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "mobile-webkit", use: { ...devices["iPhone 15 Pro"] } },
  ],
});
