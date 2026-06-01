import { defineConfig, devices } from "@playwright/test";

const DEFAULT_PREVIEW_PORT = 4175;

function resolvePreviewPort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_PREVIEW_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PLAYWRIGHT_PORT must be an integer from 1 to 65535. Received: ${value}`);
  }

  return port;
}

const previewPort = resolvePreviewPort(process.env.PLAYWRIGHT_PORT);
const previewUrl = `http://127.0.0.1:${previewPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: previewUrl,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm preview --host 127.0.0.1 --port ${previewPort} --strictPort`,
    url: previewUrl,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
