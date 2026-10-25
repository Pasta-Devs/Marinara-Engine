import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createDefaultVideoGenerationProfile } from "../packages/shared/src/constants/video-generation-defaults.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => console.error("Media settings page error:", error.stack ?? error.message));
});

async function seed(page: Page, theme: "dark" | "light") {
  let syncedUi = "";
  await page.route("**/api/app-settings/ui", async (route) => {
    if (route.request().method() === "PUT") syncedUi = route.request().postDataJSON().value as string;
    await route.fulfill({ json: { value: syncedUi } });
  });
  await seedUIState(
    page,
    { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme },
    "if-missing",
  );
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  return () => (syncedUi ? (JSON.parse(syncedUi) as Record<string, unknown>) : {});
}

for (const theme of ["dark", "light"] as const) {
  test(`generated image WebP settings are opt-in and persist in ${theme}`, async ({ page }, info) => {
    const syncedUi = await seed(page, theme);
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          {
            id: "illustrator",
            version: "1.0.0",
            status: "active",
            legacy: false,
            error: null,
            installedAt: "2026-10-25T00:00:00.000Z",
            manifest: {
              schemaVersion: 1,
              id: "illustrator",
              name: "Illustrator",
              version: "1.0.0",
              description: "Image prompt writer",
              engine: { min: "2.3.0", maxExclusive: "3.0.0" },
              kind: ["agent"],
              entrypoints: { agents: "agents.json" },
              files: [],
              permissions: [],
              restartRequired: false,
            },
          },
        ],
      }),
    );
    const open = () =>
      page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setSettingsTab("generations");
        useUIStore.getState().openRightPanel("settings");
      });
    await page.goto("/");
    await open();
    const toggle = page.getByRole("checkbox", { name: "Save generated images as WebP", exact: true });
    await expect(toggle).not.toBeChecked();
    await page.getByText("Overall Generations", { exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath("png-default.png"), animations: "disabled" });
    await page.getByText("Save generated images as WebP", { exact: true }).click();
    await expect(toggle).toBeChecked();
    const quality = page.getByRole("slider", { name: /WebP quality/ });
    await expect(quality).toHaveValue("95");
    await quality.press("End");
    await quality.press("ArrowLeft");
    await expect(quality).toHaveValue("99");
    await expect
      .poll(() => ({ enabled: syncedUi().saveGeneratedImagesAsWebp, quality: syncedUi().generatedImageWebpQuality }))
      .toEqual({ enabled: true, quality: 99 });
    await page.reload();
    await open();
    await expect(toggle).toBeChecked();
    await expect(quality).toHaveValue("99");
    await quality.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath("webp-saved.png"), animations: "disabled" });
    await page.getByText("Save generated images as WebP", { exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await expect(quality).toHaveCount(0);
    await expect.poll(() => syncedUi().saveGeneratedImagesAsWebp).toBe(false);
  });

  test(`OpenRouter H3 Max and Seedance 2.5 selections persist in ${theme}`, async ({ page, request }, info) => {
    await seed(page, theme);
    await page.goto("/");
    for (const model of [
      { id: "minimax/hailuo-3-max", resolution: "768p", duration: "15", resolutions: ["480p", "768p"] },
      { id: "bytedance/seedance-2.5", resolution: "720p", duration: "30", resolutions: ["480p", "720p"] },
    ]) {
      const response = await request.post("/api/connections", {
        data: {
          name: `${model.id} ${theme} fixture`,
          provider: "video_generation",
          videoGenerationSource: "openrouter",
          videoService: "openrouter",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "",
          apiKey: "fixture-key",
          defaultParameters: JSON.stringify({ videoGeneration: createDefaultVideoGenerationProfile("openrouter") }),
        },
      });
      expect(response.ok()).toBe(true);
      const { id } = await response.json();
      const open = () =>
        page.evaluate(async (connectionId) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().openConnectionDetail(connectionId);
        }, id);
      try {
        await open();
        await expect(page.getByPlaceholder("Connection name")).toHaveValue(`${model.id} ${theme} fixture`);
        await page.getByText("Select a model…", { exact: true }).click();
        await page.getByPlaceholder("Search models…").fill(model.id);
        const choice = page.getByRole("button").filter({ hasText: model.id });
        await expect(choice).toHaveCount(1);
        await choice.click();
        const resolution = page.getByRole("combobox", { name: "Resolution", exact: true });
        if (!(await resolution.count())) await page.getByRole("button", { name: /OpenRouter Video setup/ }).click();
        await expect(resolution).toHaveValue(model.resolution);
        await expect(resolution.locator("option")).toHaveText(model.resolutions);
        await page.getByRole("button", { name: "Reset", exact: true }).click();
        await expect(resolution).toHaveValue(model.resolution);
        const duration = page.getByRole("spinbutton", { name: "Duration Seconds", exact: true });
        await duration.fill(model.duration);
        await duration.blur();
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect
          .poll(async () => {
            const saved = await (await request.get(`/api/connections/${id}`)).json();
            const profile = JSON.parse(saved.defaultParameters).videoGeneration;
            return {
              model: saved.model,
              source: saved.videoGenerationSource,
              resolution: profile.openrouter.resolution,
              duration: profile.openrouter.durationSeconds,
            };
          })
          .toEqual({
            model: model.id,
            source: "openrouter",
            resolution: model.resolution,
            duration: Number(model.duration),
          });
        await page.reload();
        await open();
        await expect(resolution).toHaveValue(model.resolution);
        await expect(duration).toHaveValue(model.duration);
        await resolution.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: info.outputPath(`${model.id.split("/")[1]}-saved.png`), animations: "disabled" });
        if (model.resolution === "768p") {
          await page.getByText("MiniMax: H3 Max (OpenRouter) (minimax/hailuo-3-max)", { exact: true }).click();
          await page.getByPlaceholder("Search models…").fill("google/veo-3.1");
          await page.getByRole("button").filter({ hasText: "google/veo-3.1" }).click();
          await expect(resolution).toHaveValue("720p");
          await expect(resolution.locator('option[value="768p"]')).toHaveCount(0);
          await page.getByRole("button", { name: "Save", exact: true }).click();
        }
      } finally {
        await request.delete(`/api/connections/${id}`);
      }
    }
  });
}
