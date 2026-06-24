import { defineConfig, devices } from "@playwright/test";

function parsePort(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

const clientPort = parsePort("PLAYWRIGHT_CLIENT_PORT", 5178);
const serverPort = parsePort("PLAYWRIGHT_SERVER_PORT", 7971);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${clientPort}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./e2e/global-setup.mjs",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true"
      ? undefined
      : {
          command: "pnpm dev",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            AUTO_CREATE_DEFAULT_CONNECTION: "false",
            AUTO_OPEN_BROWSER: "false",
            DATA_DIR: "../../.tmp/playwright-data",
            DEV_SERVER_READY_TIMEOUT_MS: "180000",
            LOG_DISABLE_REQUEST_LOGGING: "true",
            LOG_LEVEL: "silent",
            MARINARA_ENV_FILE: "../../.tmp/playwright-data/.env",
            PORT: String(serverPort),
            SKIP_PWA: "true",
            VITE_HOST: "127.0.0.1",
            VITE_OPEN_BROWSER: "false",
            VITE_PORT: String(clientPort),
          },
        },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
});
