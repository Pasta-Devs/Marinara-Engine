import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { forceColorValueEnablesColor } from "./e2e/playwright-color-environment.js";

const callerDisabledColors = process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "";
const shouldPreventPlaywrightColorOverride =
  callerDisabledColors && !forceColorValueEnablesColor(process.env.FORCE_COLOR);
if (shouldPreventPlaywrightColorOverride) {
  const noColorPreload = `--require=${JSON.stringify(fileURLToPath(new URL("./e2e/respect-no-color.cjs", import.meta.url)))}`;
  const nodeOptions = process.env.NODE_OPTIONS?.trim();
  if (!nodeOptions?.includes(noColorPreload)) {
    process.env.NODE_OPTIONS = nodeOptions ? `${nodeOptions} ${noColorPreload}` : noColorPreload;
  }
}

function parsePort(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : fallback;
}

const clientPort = parsePort("PLAYWRIGHT_CLIENT_PORT", 5178);
const serverPort = parsePort("PLAYWRIGHT_SERVER_PORT", 7971);
const mobileClientPort = parsePort("PLAYWRIGHT_MOBILE_CLIENT_PORT", 5179);
const mobileServerPort = parsePort("PLAYWRIGHT_MOBILE_SERVER_PORT", 7972);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${clientPort}`;
const mobileBaseURL = process.env.PLAYWRIGHT_MOBILE_BASE_URL ?? `http://127.0.0.1:${mobileClientPort}`;

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
          command: "node ./e2e/start-servers.mjs",
          // The readiness check must target a server that actually boots:
          // when a CI shard gates the boot to one project pair (#5637), the
          // desktop URL would never come up on a mobile-only shard.
          url: process.env.PLAYWRIGHT_ONLY_PROJECT?.trim() === "mobile" ? mobileBaseURL : baseURL,
          reuseExistingServer: false,
          timeout: 180_000,
          gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
          env: {
            AUTO_CREATE_DEFAULT_CONNECTION: "false",
            AUTO_OPEN_BROWSER: "false",
            DEV_PRESERVE_SHARED_DIST: "true",
            DEV_SERVER_READY_TIMEOUT_MS: "180000",
            LOG_DISABLE_REQUEST_LOGGING: "true",
            LOG_LEVEL: "silent",
            MARINARA_E2E_DISABLE_RATE_LIMIT: "true",
            PLAYWRIGHT_CLIENT_PORT: String(clientPort),
            PLAYWRIGHT_MOBILE_CLIENT_PORT: String(mobileClientPort),
            PLAYWRIGHT_MOBILE_SERVER_PORT: String(mobileServerPort),
            PLAYWRIGHT_SERVER_PORT: String(serverPort),
            SKIP_PWA: "true",
            // Playwright defaults web servers to FORCE_COLOR=1. Honor an
            // inherited NO_COLOR preference instead of creating a conflict.
            ...(shouldPreventPlaywrightColorOverride ? { FORCE_COLOR: "0" } : {}),
            VITE_HOST: "127.0.0.1",
            VITE_OPEN_BROWSER: "false",
          },
        },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], baseURL, viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], baseURL: mobileBaseURL, viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-webkit",
      use: { ...devices["iPhone 15 Pro"], baseURL: mobileBaseURL },
    },
  ],
});
