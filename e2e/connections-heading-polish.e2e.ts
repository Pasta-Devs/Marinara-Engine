import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { SIDECAR_DEFAULT_CONFIG } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const account = {
  id: "polish-account",
  name: "Studio service with a long account name",
  provider: "openai",
  baseUrl: "http://127.0.0.1:9/v1",
  hasApiKey: true,
  enabled: true,
  modelCount: 1,
  state: "ok",
};
const row = {
  id: "polish-model",
  accountId: account.id,
  provider: "openai",
  name: "Studio model",
  model: "gpt-5.5",
  baseUrl: account.baseUrl,
  enabled: true,
  isDefault: true,
  pinnedModels: "[]",
};

for (const width of [390, 768, 1440]) {
  test(`heading and picture dialogs at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith("/access-refusals")) return route.fulfill({ json: [] });
      if (path.endsWith("/app-settings")) return route.fulfill({ json: { value: null } });
      if (path.endsWith("/sidecar/status")) {
        return route.fulfill({
          json: {
            status: "stopped",
            config: { ...SIDECAR_DEFAULT_CONFIG },
            modelDownloaded: false,
            modelDisplayName: null,
            modelSize: null,
            runtime: { installed: false, build: null, variant: null, backend: null },
            inferenceReady: false,
            logPath: null,
            platform: "linux",
            arch: "x64",
            curatedModels: [],
          },
        });
      }
      if (path.endsWith("/connections/refresh-local-context")) return route.fulfill({ json: { updated: [] } });
      return route.fallback();
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await page.route("**/api/connections", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? [row] : {} }),
    );
    await page.route("**/api/connection-accounts", (route) =>
      route.fulfill({ json: route.request().method() === "GET" ? [account] : {} }),
    );
    await page.route("**/api/connection-folders", (route) =>
      route.fulfill({ json: [{ id: "work", name: "Work folder", icon: "briefcase", color: "#3b82f6" }] }),
    );
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "connections",
      chibiProfessorMariEnabled: false,
      theme: "dark",
    });
    await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
    await page.goto("/");
    const panel = page.locator("[data-connections-panel]");
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.locator('[data-connection-account-id="polish-account"]')).toBeVisible();
    await panel.locator('[data-connection-account-id="polish-account"]').scrollIntoViewIfNeeded();
    mkdirSync(".tmp/connections-polish", { recursive: true });
    await page.screenshot({ path: `.tmp/connections-polish/heading-${width}.png` });
    for (const label of ["Choose service logo", "Use letters"]) {
      await panel.getByRole("button", { name: `Change picture for ${account.name}`, exact: true }).click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      const dialog = page.getByRole("dialog", { name: label, exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.locator("[data-picture-menu-panel]")).toBeVisible();
      await page.keyboard.press("Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.screenshot({
        path: `.tmp/connections-polish/${label === "Use letters" ? "letters" : "logos"}-${width}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(panel).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
