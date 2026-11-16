import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("lorebook tools lint, preview scans, and bulk-enable selected books", async ({ page, request }) => {
  const book = await (
    await request.post("/api/lorebooks", {
      data: { name: "Synthetic tools proof book", enabled: false },
      failOnStatusCode: true,
    })
  ).json();
  const visibleBook = await (
    await request.post("/api/lorebooks", {
      data: { name: "Visible selected lorebook", enabled: true },
      failOnStatusCode: true,
    })
  ).json();
  try {
    await request.post(`/api/lorebooks/${book.id}/entries`, {
      data: { name: "Keyless sample entry", content: "A note for the synthetic proof." },
      failOnStatusCode: true,
    });
    await request.post(`/api/lorebooks/${book.id}/entries`, {
      data: { name: "Lantern watcher", content: "A watcher near the lanterns.", keys: ["lantern"] },
      failOnStatusCode: true,
    });

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
    await page.addInitScript(
      (appVersion) => localStorage.setItem("marinara:whats-new:seen-version", appVersion),
      version,
    );
    await page.goto("/");
    await clickTopbarPanel(page, "lorebooks");

    await page.getByRole("button", { name: "Select lorebooks", exact: true }).click();
    await page.getByRole("button", { name: "Select lorebook", exact: true }).first().click();
    await page.getByRole("button", { name: "Select lorebook", exact: true }).click();
    const search = page.getByPlaceholder("Search lorebooks", { exact: true });
    await search.fill(visibleBook.name);
    await expect(page.getByText(book.name, { exact: true })).not.toBeVisible();
    await expect(page.getByText(visibleBook.name, { exact: true })).toBeVisible();
    const enable = page.getByRole("button", { name: "Enable the selected lorebooks", exact: true });
    await expect(enable).toBeEnabled();
    const enabledResponse = page.waitForResponse("**/api/lorebooks/bulk-enabled");
    await enable.click();
    const enabled = await enabledResponse;
    expect(enabled.request().postDataJSON().ids.sort()).toEqual([book.id, visibleBook.id].sort());
    expect(await enabled.json()).toEqual({ changedIds: [book.id], unchangedIds: [visibleBook.id], missingIds: [] });
    await expect.poll(async () => (await (await request.get(`/api/lorebooks/${book.id}`)).json()).enabled).toBe(true);

    const undoResponse = page.waitForResponse("**/api/lorebooks/bulk-enabled");
    await page
      .locator("[data-sonner-toast]")
      .filter({ hasText: "Enabled 1 lorebook" })
      .getByRole("button", { name: "Undo", exact: true })
      .click();
    expect((await undoResponse).request().postDataJSON()).toEqual({ ids: [book.id], enabled: false });
    await expect.poll(async () => (await (await request.get(`/api/lorebooks/${book.id}`)).json()).enabled).toBe(false);
    expect((await (await request.get(`/api/lorebooks/${visibleBook.id}`)).json()).enabled).toBe(true);

    const disabledResponse = page.waitForResponse("**/api/lorebooks/bulk-enabled");
    await page.getByRole("button", { name: "Disable the selected lorebooks", exact: true }).click();
    const disabled = await disabledResponse;
    expect(disabled.request().postDataJSON().ids.sort()).toEqual([book.id, visibleBook.id].sort());
    expect(await disabled.json()).toEqual({ changedIds: [visibleBook.id], unchangedIds: [book.id], missingIds: [] });
    await page.getByRole("button", { name: "Enable the selected lorebooks", exact: true }).click();
    await expect.poll(async () => (await (await request.get(`/api/lorebooks/${book.id}`)).json()).enabled).toBe(true);

    await search.fill("");
    await page.getByRole("button", { name: "Exit lorebook selection", exact: true }).click();
    await page.getByText(book.name, { exact: true }).click();
    await page.getByRole("button", { name: "Check lorebook", exact: true }).click();
    await expect(page.getByText("Keyless sample entry", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Keyword test", exact: true }).click();
    await page.getByPlaceholder("Paste a paragraph or sample messages here…", { exact: true }).fill("A lantern glows.");
    await page.getByRole("button", { name: "Run scanner", exact: true }).click();
    await expect(page.getByText("Lantern watcher", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Import entries from Markdown or CSV", exact: true }).click();
    const importDialog = page.getByRole("dialog", { name: "Import entries", exact: true });
    await importDialog
      .getByRole("textbox", { name: "Markdown or CSV text", exact: true })
      .fill("## River sentinel\nKeys: river\nFolder: Places\n\nGuards the river.");
    await expect(importDialog.getByText("River sentinel", { exact: true })).toBeVisible();
    await importDialog.getByRole("button", { name: "Import 1 entry", exact: true }).click();
    await expect(importDialog).not.toBeVisible();
    await expect
      .poll(async () => (await (await request.get(`/api/lorebooks/${book.id}/entries`)).json()).length)
      .toBe(3);

    const entrySection = page.locator('[data-editor-section="entries"]');
    await entrySection.getByRole("button", { name: "Select", exact: true }).click();
    await entrySection.getByRole("button", { name: "Select all", exact: true }).click();
    await page.getByRole("button", { name: "Bulk edit 3 entries", exact: true }).click();
    await page.getByRole("button", { name: "Constant on", exact: true }).click();
    await expect
      .poll(async () => {
        const entries = await (await request.get(`/api/lorebooks/${book.id}/entries`)).json();
        return entries.every((entry: { constant: boolean }) => entry.constant);
      })
      .toBe(true);
  } finally {
    await page.close();
    await request.delete(`/api/lorebooks/${book.id}`).catch(() => undefined);
    await request.delete(`/api/lorebooks/${visibleBook.id}`).catch(() => undefined);
  }
});
