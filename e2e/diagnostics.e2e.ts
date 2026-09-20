import { expect, test } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const CLIENT_DIAGNOSTICS_KEY = "marinara-client-diagnostics-v1";
function readDiagnosticLogs(project: string) {
  const logDirectory = resolve(
    process.cwd(),
    ".tmp/playwright-data",
    project.startsWith("mobile") ? "mobile" : "desktop",
    "logs",
  );
  let files: string[] = [];
  try {
    files = readdirSync(logDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => resolve(logDirectory, entry.name));
  } catch {
    return "";
  }
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

test("browser diagnostics report a redacted runtime error and persist its reference", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Chat navigation" })).toBeVisible();
  await page.evaluate((key) => localStorage.removeItem(key), CLIENT_DIAGNOSTICS_KEY);

  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/diagnostics/client") && response.request().method() === "POST",
  );
  await page.evaluate(() => {
    const error = new Error('quoted {"apiKey":"synthetic-secret"} token=synthetic-token');
    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));
  });
  const response = await responsePromise;
  expect(response.status()).toBe(202);
  const submitted = response.request().postDataJSON();
  expect(submitted.clientEventId).toMatch(/\S+/);
  expect(JSON.stringify(submitted)).not.toMatch(/synthetic-secret|synthetic-token/);
  const body = (await response.json()) as { errorId?: string };
  expect(body.errorId).toMatch(/\S+/);

  await expect.poll(() => readDiagnosticLogs(testInfo.project.name)).toContain(body.errorId!);
  const logs = readDiagnosticLogs(testInfo.project.name);
  expect(logs).not.toContain("synthetic-secret");
  expect(logs).not.toContain("synthetic-token");
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), CLIENT_DIAGNOSTICS_KEY)).toBe("[]");
});

test("browser diagnostics queue offline errors and flushes them when connectivity returns", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Chat navigation" })).toBeVisible();
  await page.evaluate((key) => localStorage.removeItem(key), CLIENT_DIAGNOSTICS_KEY);
  await context.setOffline(true);

  await page.evaluate(() => {
    const error = new Error('offline {"token":"offline-secret"}');
    window.dispatchEvent(new ErrorEvent("error", { error, message: error.message }));
  });
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), CLIENT_DIAGNOSTICS_KEY))
    .toContain("offline");
  expect(await page.evaluate((key) => localStorage.getItem(key), CLIENT_DIAGNOSTICS_KEY)).not.toContain(
    "offline-secret",
  );

  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/diagnostics/client") && response.request().method() === "POST",
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const response = await responsePromise;
  expect(response.status()).toBe(202);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), CLIENT_DIAGNOSTICS_KEY)).toBe("[]");
});
