import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

// #7115: exports on iPhone open the share sheet, or offer a Save file toast when iOS needs a fresh tap.
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

type ShareMode = "success" | "NotAllowedError" | "AbortError";
type ExportProbe = {
  mode: ShareMode;
  shares: Array<{ activation: boolean; name: string; type: string; size: number }>;
};

const probe = (page: Page) =>
  page.evaluate(() => (window as unknown as Window & { __exportProbe: ExportProbe }).__exportProbe);
const setShareMode = (page: Page, mode: ShareMode | "unavailable") =>
  page.evaluate((mode) => {
    if (mode === "unavailable") {
      Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
      return;
    }
    (window as unknown as Window & { __exportProbe: ExportProbe }).__exportProbe.mode = mode;
  }, mode);

for (const owner of ["character", "persona"] as const) {
  test(`${owner} Marinara native export reaches the device`, async ({ page, request }, testInfo) => {
    const ios = testInfo.project.name === "mobile-webkit";
    test.skip(testInfo.project.name === "mobile-chromium", "Android browsers use the desktop download path.");
    const name = `Export ${owner} ${Date.now().toString(36)}`;
    const base = owner === "character" ? "/api/characters" : "/api/characters/personas";
    const created = await request.post(base, { data: owner === "character" ? { data: { name } } : { name } });
    expect(created.ok()).toBeTruthy();
    const { id } = (await created.json()) as { id: string };
    const filename = `${name}.marinara.json`;
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
      await page.addInitScript(
        ({ ios, appVersion }) => {
          localStorage.setItem("marinara:whats-new:seen-version", appVersion);
          // The Chromium save dialog is not a Playwright download; the browser download path is.
          Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: undefined });
          const target = window as unknown as Window & { __exportProbe: ExportProbe };
          target.__exportProbe = { mode: "success", shares: [] };
          if (!ios) return;
          Object.defineProperty(navigator, "canShare", {
            configurable: true,
            value: (data: ShareData) => data.files?.length === 1,
          });
          Object.defineProperty(navigator, "share", {
            configurable: true,
            value: async (data: ShareData) => {
              const file = data.files![0]!;
              target.__exportProbe.shares.push({
                activation: navigator.userActivation.isActive,
                name: file.name,
                type: file.type,
                size: file.size,
              });
              if (target.__exportProbe.mode !== "success") throw new DOMException("Probe", target.__exportProbe.mode);
            },
          });
        },
        { ios, appVersion: version },
      );
      await page.goto("/");
      await page.evaluate(
        async ({ owner, id }) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          const state = useUIStore.getState();
          if (owner === "character") state.openCharacterDetail(id);
          else state.openPersonaDetail(id);
        },
        { owner, id },
      );
      const exportNative = async () => {
        await page.getByTitle(owner === "character" ? "Export character" : "Export persona", { exact: true }).click();
        await page.getByRole("button", { name: /^Marinara Native/u }).click();
      };
      const readyToast = page.locator("[data-sonner-toast]").filter({ hasText: "Your file is ready." });
      const saveFile = readyToast.getByRole("button", { name: "Save file", exact: true });

      if (!ios) {
        const download = page.waitForEvent("download");
        await exportNative();
        expect((await download).suggestedFilename()).toBe(filename);
        expect(JSON.parse(readFileSync((await (await download).path())!, "utf8")).data).toBeTruthy();
      } else {
        // The share sheet opens straight away with the export file.
        await exportNative();
        await expect.poll(async () => (await probe(page)).shares.map((share) => share.name)).toEqual([filename]);
        expect((await probe(page)).shares[0]!.type).toMatch(/^application\/json/u);
        expect((await probe(page)).shares[0]!.size).toBeGreaterThan(0);
        await expect(readyToast).toHaveCount(0);

        // iOS refused the share after the download: a Save file toast waits for a fresh tap.
        await setShareMode(page, "NotAllowedError");
        await exportNative();
        await expect(readyToast).toBeVisible();
        await expect(readyToast).toContainText(filename);
        // Longer than the app's 6 s toast duration (TOAST_DURATION_MS in App.tsx), not just Sonner's 4 s default.
        await page.waitForTimeout(7_000);
        await expect(saveFile, "the toast stays until it is used").toBeVisible();
        await setShareMode(page, "success");
        await saveFile.click();
        await expect.poll(async () => (await probe(page)).shares.length).toBe(3);
        expect((await probe(page)).shares[2]).toMatchObject({ activation: true, name: filename });
        await expect(readyToast).toHaveCount(0);

        // Cancelling the share sheet stays quiet.
        await setShareMode(page, "AbortError");
        await exportNative();
        await expect.poll(async () => (await probe(page)).shares.length).toBe(4);
        await expect(readyToast).toHaveCount(0);
        await expect(page.getByText("Couldn't export the file.", { exact: true })).toHaveCount(0);

        // Plain http on the LAN has no share sheet: the toast's tap downloads the file.
        await setShareMode(page, "unavailable");
        await exportNative();
        const download = page.waitForEvent("download");
        await saveFile.click();
        expect((await download).suggestedFilename()).toBe(filename);
      }
      await testInfo.attach(`${owner}-export-${testInfo.project.name}.png`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });

      // A server failure (for example a 502 from a proxy) shows an error instead of nothing.
      await page.route(`**${base}/${id}/export?*`, (route) => route.fulfill({ status: 502, body: "Bad gateway" }));
      await exportNative();
      await expect(page.getByText("Couldn't export the file.", { exact: true })).toBeVisible();
    } finally {
      await request.delete(`${base}/${id}`);
    }
  });
}
