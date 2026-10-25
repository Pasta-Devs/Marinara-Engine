import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function openConnection(page: Page, id: string) {
  await page.evaluate(async (connectionId) => {
    const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
    useUIStore.getState().openConnectionDetail(connectionId);
  }, id);
}

async function reopenConnection(page: Page, id: string) {
  await page.evaluate(async () => {
    const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as PageUiStoreModule;
    useUIStore.getState().closeConnectionDetail();
  });
  await expect(page.locator(".mari-editor-shell")).toHaveCount(0);
  await openConnection(page, id);
}

for (const theme of ["dark", "light"] as const) {
  test(`Seedance reference upload and video defaults survive save and cached reopen (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    const created = await request.post("/api/connections", {
      data: {
        name: `Seedance references ${testInfo.project.name} ${theme}`,
        provider: "video_generation",
        videoGenerationSource: "seedance",
        videoService: "seedance",
        model: "seedance-2-0",
      },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = (await created.json()) as { id: string };
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        theme,
      });
      await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
      await page.goto("/");
      await openConnection(page, id);
      const editor = page.locator(".mari-editor-shell");
      const upload = editor.getByRole("checkbox", { name: /^Upload Seedance reference frames temporarily/u });
      const duration = editor.getByRole("spinbutton", { name: "Duration Seconds", exact: true });
      const expiry = editor.getByText("Temporary link lifetime", { exact: true }).locator("..").getByRole("combobox");
      const save = async () => {
        await editor.getByRole("button", { name: "Save", exact: true }).click();
        await expect(editor.getByText("Saved", { exact: true }).locator("..")).toBeVisible();
      };
      const storedDefaults = async () => {
        const response = await request.get(`/api/connections/${id}`);
        expect(response.ok()).toBeTruthy();
        const saved = (await response.json()) as { defaultParameters: string };
        return JSON.parse(saved.defaultParameters).videoGeneration.seedance;
      };
      await expect(upload).not.toBeChecked();
      await editor.getByRole("button", { name: /Seedance 2.0 setup/u }).click();
      await duration.fill("9");
      // Clicking the switch also commits the focused duration field.
      await editor
        .locator(`label[for="${await upload.getAttribute("id")}"]`)
        .first()
        .click();
      await expect(upload).toBeChecked();
      await expiry.selectOption("1h");
      await save();
      expect(await storedDefaults()).toMatchObject({
        durationSeconds: 9,
        temporaryPublicReferenceUploadEnabled: true,
        temporaryPublicReferenceUploadExpiry: "1h",
      });
      // This remount uses React Query's cached connection, unlike the initial fetch.
      await reopenConnection(page, id);
      await expect(upload).toBeChecked();
      await expect(expiry).toHaveValue("1h");
      await expect(duration).toHaveValue("9");
      await upload.scrollIntoViewIfNeeded();
      const screenshot = testInfo.outputPath(`seedance-reference-enabled-${theme}.png`);
      await page.screenshot({ path: screenshot, animations: "disabled" });
      await testInfo.attach(`seedance-reference-enabled-${theme}`, { path: screenshot, contentType: "image/png" });
      // A full reload also hydrates the saved defaults correctly.
      await page.reload();
      await openConnection(page, id);
      await expect(upload).toBeChecked();
      await expect(expiry).toHaveValue("1h");
      await expect(duration).toHaveValue("9");
      await editor
        .locator(`label[for="${await upload.getAttribute("id")}"]`)
        .first()
        .click();
      await expect(upload).not.toBeChecked();
      await save();
      await reopenConnection(page, id);
      await expect(upload).not.toBeChecked();
      await expect(duration).toHaveValue("9");
      expect(await storedDefaults()).toMatchObject({
        durationSeconds: 9,
        temporaryPublicReferenceUploadEnabled: false,
        temporaryPublicReferenceUploadExpiry: "1h",
      });
    } finally {
      await request.delete(`/api/connections/${id}`);
    }
  });
}
