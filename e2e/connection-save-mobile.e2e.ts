import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createDefaultVideoGenerationProfile } from "../packages/shared/src/constants/video-generation-defaults.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const theme of ["dark", "light"] as const) {
  test(`Save keeps the model window open and Done closes it in ${theme}`, async ({ page, request }, info) => {
    await isolateSyncedUISettings(page);
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme,
      appAccentPulseMode: false,
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    const defaults = createDefaultVideoGenerationProfile("openrouter");
    defaults.openrouter = { durationSeconds: 10, aspectRatio: "16:9", resolution: "768p" };
    const created = await request.post("/api/connections", {
      data: {
        name: "MiniMax 3",
        provider: "video_generation",
        videoGenerationSource: "openrouter",
        videoService: "openrouter",
        baseUrl: "https://openrouter.ai/api/v1",
        model: "minimax/hailuo-3-max",
        apiKey: "fixture-key",
        defaultParameters: JSON.stringify({ videoGeneration: defaults }),
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();
    const { id } = await created.json();
    const calls: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes(`/api/connections/${id}`) && ["PATCH", "PUT"].includes(r.method())) {
        calls.push(`${r.method()} ${new URL(r.url()).pathname}`);
      }
    });
    await page.route(`**/api/connections/${id}/models`, (route) =>
      route.fulfill({ json: { models: [{ id: "minimax/hailuo-3-max", name: "MiniMax: H3 Max" }] } }),
    );
    try {
      await page.goto("/");
      const views = info.project.name.includes("mobile")
        ? [
            { label: "portrait", width: 393, height: 852 },
            { label: "landscape", width: 852, height: 393 },
          ]
        : [{ label: "desktop", width: 1440, height: 900 }];
      for (const view of views) {
        await page.setViewportSize({ width: view.width, height: view.height });
        await page.evaluate(async (connectionId) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().openConnectionDetail(connectionId);
        }, id);
        const dialog = page.getByRole("dialog");
        const name = dialog.getByPlaceholder("Model name", { exact: true });
        await expect(name).toHaveValue(/MiniMax 3/);
        calls.length = 0;
        await name.fill(`MiniMax 3 ${view.label}`);
        await dialog.getByRole("button", { name: "Save", exact: true }).click();
        // Saving keeps the window open and turns the action into Done.
        const done = dialog.getByRole("button", { name: "Done", exact: true });
        await expect(done).toBeVisible();
        await page.screenshot({ path: info.outputPath(`${view.label}-after-save.png`) });
        expect(calls).toEqual([`PUT /api/connections/${id}/default-parameters`, `PATCH /api/connections/${id}`]);
        await done.click();
        await expect(dialog).toBeHidden();
      }
    } finally {
      await request.delete(`/api/connections/${id}`);
    }
  });
}
