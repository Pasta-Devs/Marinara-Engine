import { expect, test, type Locator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { chooseOption } from "./select-field.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

async function openManager(page: Page) {
  await page.addInitScript(() => localStorage.setItem("marinara-tap-timings", "1"));
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: "dark",
    visualTheme: "default",
    appAccentPulseMode: false,
  });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  // The library is Engine-owned and must remain usable without Illustrator installed.
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().setSettingsTab("generations");
    useUIStore.getState().openRightPanel("settings");
  });
  const section = page
    .locator("section")
    .filter({ has: page.getByText("Image tag datasets", { exact: true }) })
    .last();
  await expect(section).toBeVisible();
  await expect(section.getByRole("button", { name: "Choose CSV", exact: true })).toBeVisible();
  return section;
}

async function searchFor(page: Page, section: Locator, query: string) {
  await section.getByLabel("Search tags", { exact: true }).fill(query);
  const response = page.waitForResponse(
    (reply) => reply.url().endsWith("/api/image-tag-datasets/search") && reply.request().method() === "POST",
  );
  await section.getByRole("button", { name: "Search tags", exact: true }).click();
  expect((await response).ok()).toBe(true);
  await expect(section.getByRole("button", { name: "Search tags", exact: true })).toBeEnabled();
}

test("image tag library imports, searches and manages server data without an installed agent", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  const token = randomUUID().replaceAll("-", "");
  const filename = `canonical-tags-${token}.csv`;
  const canonical = `blue_hair_${token}`;
  const alias = `azure hair ${token}`;
  const unicode = `初音ミク_${token}`;
  const punctuation = `tag_(variant)!_${token}`;
  const csv = [
    "name,category,post_count,aliases",
    `${canonical},0,42,"${alias},blue locks ${token}"`,
    `${unicode},4,8,miku ${token}`,
    `${punctuation},5,3,`,
    `${canonical},0,1,duplicate`,
    "invalid_count,0,not-a-number,",
  ].join("\r\n");
  let sourceId: string | undefined;
  let otherContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  try {
    const section = await openManager(page);
    await page.getByRole("button", { name: /^Quick Access/ }).click();
    await page.getByRole("button", { name: "Image tag datasets", exact: true }).click();
    await expect(section).toHaveAttribute("id", "settings-section-image-tag-datasets");
    await expect(section.getByText("Image tag datasets", { exact: true })).toBeInViewport();
    await page.screenshot({ path: info.outputPath("image-tag-datasets-empty.png"), animations: "disabled" });
    const picker = page.waitForEvent("filechooser");
    await section.getByRole("button", { name: "Choose CSV", exact: true }).click();
    await (await picker).setFiles({ name: filename, mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
    const importResponse = page.waitForResponse(
      (reply) => reply.url().endsWith("/api/image-tag-datasets/import") && reply.request().method() === "POST",
    );
    await section.getByRole("button", { name: "Import CSV", exact: true }).click();
    const imported = await importResponse;
    expect(imported.status()).toBe(201);
    sourceId = (await imported.json()).id;
    const sourceSwitch = section.getByRole("switch", { name: filename, exact: true });
    await expect(sourceSwitch).toBeChecked();
    const sourceRow = sourceSwitch.locator("xpath=ancestor::li[1]");
    await expect(
      section.getByText("Imported 3 tags. Skipped 1 invalid rows, 1 duplicates and 0 blank rows.", { exact: true }),
    ).toBeVisible();
    await section.getByText("Skipped row details", { exact: true }).click();
    await expect(section.getByText("Record 5: Duplicate tag in this category", { exact: true })).toBeVisible();
    await expect(section.getByText("Record 6: Invalid post count", { exact: true })).toBeVisible();

    await chooseOption(page, section.getByRole("combobox", { name: "Match type", exact: true }), "Exact name or alias");
    await searchFor(page, section, canonical);
    await expect(section.locator("code")).toHaveText([canonical]);
    await searchFor(page, section, alias);
    await expect(section.locator("code")).toHaveText([canonical]);
    await expect(section.getByText(`Matched alias: ${alias}`, { exact: true })).toBeVisible();
    await searchFor(page, section, unicode);
    await expect(section.locator("code")).toHaveText([unicode]);
    await searchFor(page, section, punctuation);
    await expect(section.locator("code")).toHaveText([punctuation]);

    // Capture the same working surface in both visual themes and color modes, including the current mobile project.
    for (const visualTheme of ["default", "sillytavern"] as const) {
      for (const theme of ["dark", "light"] as const) {
        await page.evaluate(
          async ({ theme, visualTheme }) => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            useUIStore.getState().setTheme(theme);
            useUIStore.getState().setVisualTheme(visualTheme);
          },
          { theme, visualTheme },
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        await sourceSwitch.scrollIntoViewIfNeeded();
        const overflow = await section.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return {
            document: document.documentElement.scrollWidth - innerWidth,
            section: element.scrollWidth - element.clientWidth,
            right: box.right - innerWidth,
            left: box.left,
          };
        });
        expect(overflow.document).toBeLessThanOrEqual(1);
        expect(overflow.section).toBeLessThanOrEqual(1);
        expect(overflow.right).toBeLessThanOrEqual(1);
        expect(overflow.left).toBeGreaterThanOrEqual(-1);
        await page.screenshot({
          path: info.outputPath(`image-tag-datasets-${visualTheme}-${theme}.png`),
          animations: "disabled",
        });
      }
    }

    const general = sourceRow.getByRole("checkbox", { name: "General (1)", exact: true });
    await general.click();
    await expect(general).not.toBeChecked();
    await searchFor(page, section, canonical);
    await expect(section.locator("code")).toHaveCount(0);
    await expect(section.getByText("Showing 0 of 0 matches.", { exact: true })).toBeVisible();
    await general.click();
    await expect(general).toBeChecked();

    await sourceSwitch.click();
    await expect(sourceSwitch).not.toBeChecked();
    await expect(general).toBeDisabled();
    await searchFor(page, section, canonical);
    await expect(section.locator("code")).toHaveCount(0);
    await sourceSwitch.click();
    await expect(sourceSwitch).toBeChecked();
    await searchFor(page, section, canonical);
    await expect(section.locator("code")).toHaveText([canonical]);

    await sourceRow.getByRole("button", { name: "Replace CSV", exact: true }).click();
    await section
      .getByLabel(`Replace: ${filename}`, { exact: true })
      .setInputFiles({ name: "broken.csv", mimeType: "text/csv", buffer: Buffer.from('"unfinished,0,1,', "utf8") });
    await section.getByRole("button", { name: "Import CSV", exact: true }).click();
    const replacementDialog = page.getByRole("dialog", { name: "Replace CSV", exact: true });
    const failedReplacement = page.waitForResponse(
      (reply) => reply.url().endsWith("/api/image-tag-datasets/import") && reply.request().method() === "POST",
    );
    await replacementDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    expect((await failedReplacement).status()).toBe(400);
    await expect(section.getByRole("alert")).toContainText("Malformed CSV");
    await section.getByRole("button", { name: "Cancel replacement", exact: true }).click();
    await searchFor(page, section, canonical);
    await expect(section.locator("code")).toHaveText([canonical]);

    // A fresh browser context has no localStorage or React Query state from the importing page.
    otherContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      viewport: page.viewportSize()!,
      isMobile: info.project.use.isMobile,
      hasTouch: info.project.use.hasTouch,
    });
    const secondPage = await otherContext.newPage();
    const secondSection = await openManager(secondPage);
    await expect(secondSection.getByRole("switch", { name: filename, exact: true })).toBeChecked();
    await searchFor(secondPage, secondSection, alias);
    await expect(secondSection.locator("code")).toHaveText([canonical]);

    await sourceRow.getByRole("button", { name: "Delete dataset", exact: true }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete dataset", exact: true });
    await deleteDialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(sourceSwitch).toBeChecked();
    await sourceRow.getByRole("button", { name: "Delete dataset", exact: true }).click();
    const deletion = page.waitForResponse(
      (reply) => reply.url().endsWith(`/api/image-tag-datasets/${sourceId}`) && reply.request().method() === "DELETE",
    );
    await deleteDialog.getByRole("button", { name: "Confirm", exact: true }).click();
    expect((await deletion).status()).toBe(204);
    await expect(sourceSwitch).toHaveCount(0);
    sourceId = undefined;
    await info.attach("tap-timings", {
      body: await page.locator('[data-component="TapTimings"]').innerText(),
      contentType: "text/plain",
    });
    expect(pageErrors).toEqual([]);
  } finally {
    await otherContext?.close();
    if (sourceId) await page.request.delete(`/api/image-tag-datasets/${sourceId}`);
  }
});
