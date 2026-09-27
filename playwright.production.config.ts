import { defineConfig } from "@playwright/test";
import path from "node:path";
import baseConfig from "./playwright.config";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:7973";
const dataDir = path.resolve(".tmp/playwright-data/production");

export default defineConfig({
  ...baseConfig,
  testMatch: "**/production-startup.ts",
  use: { ...baseConfig.use, baseURL },
  projects: baseConfig.projects?.map((project) => ({
    ...project,
    use: { ...project.use, baseURL },
  })),
  webServer:
    process.env.PLAYWRIGHT_SKIP_WEBSERVER === "true"
      ? undefined
      : {
          command: "node e2e/global-setup.mjs && node packages/server/dist/index.js",
          url: `${baseURL}/api/health`,
          reuseExistingServer: false,
          timeout: 120_000,
          gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
          env: {
            NODE_ENV: "production",
            HOST: "127.0.0.1",
            PORT: new URL(baseURL).port,
            DATA_DIR: dataDir,
            MARINARA_ENV_FILE: path.join(dataDir, ".env"),
            AUTO_CREATE_DEFAULT_CONNECTION: "false",
            AUTO_OPEN_BROWSER: "false",
            UPDATES_APPLY_DISABLED: "true",
            LOG_LEVEL: "silent",
          },
        },
});
