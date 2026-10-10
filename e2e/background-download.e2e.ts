import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { downloadExport } from "./export-save.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false }, "if-missing");
});

test("Background library downloads a background with its file name (#7129)", async ({ page }, testInfo) => {
  const upload = await page.request.post("/api/backgrounds/upload", {
    multipart: { file: { name: `download-7129-${testInfo.project.name}.gif`, mimeType: "image/gif", buffer: GIF } },
  });
  expect(upload.ok()).toBeTruthy();
  const { filename } = (await upload.json()) as { filename: string };
  try {
    await page.goto("/");
    await clickTopbarPanel(page, "settings");
    await page.getByRole("tab", { name: "Appearance", exact: true }).click();
    await page.getByPlaceholder("Search settings").fill("Backgrounds");
    await page.getByRole("button", { name: /Backgrounds Section/ }).click();
    await page.getByRole("button", { name: "Browse library", exact: true }).click();
    const library = page.getByRole("dialog", { name: "Background Library" });
    await library.getByPlaceholder("Search backgrounds").fill(filename.replace(/\.gif$/, ""));
    const button = library.locator(`[data-background-id="user:${filename}"] [data-background-download]`);
    await expect(button).toHaveAttribute("title", "Download background");

    // Desktop downloads directly; iPhone offers Save file once the fetch has used up the tap.
    const download = await downloadExport(page, () => button.click());
    expect(download.suggestedFilename()).toBe(filename);
    expect(readFileSync((await download.path())!)).toEqual(GIF);
  } finally {
    await page.request.delete(`/api/backgrounds/${encodeURIComponent(filename)}`);
  }
});
