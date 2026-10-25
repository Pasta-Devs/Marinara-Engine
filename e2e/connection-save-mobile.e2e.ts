import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { createDefaultVideoGenerationProfile } from "../packages/shared/src/constants/video-generation-defaults.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

for (const theme of ["dark", "light"] as const) {
  test(`connection Save remains a single stable action through success feedback in ${theme}`, async ({
    page,
    request,
  }, info) => {
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
      await page.evaluate(async (connectionId) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(connectionId);
      }, id);
      const name = page.getByPlaceholder("Connection name");
      await expect(name).toHaveValue("MiniMax 3");
      const header = page.locator(".mari-editor-header");
      const save = header.getByRole("button", { name: "Save", exact: true });
      await expect(save).toHaveCount(1);
      const views = info.project.name.includes("mobile")
        ? [
            { label: "portrait", width: 393, height: 852 },
            { label: "landscape", width: 852, height: 393 },
          ]
        : [{ label: "desktop", width: 1440, height: 900 }];
      for (const view of views) {
        await page.setViewportSize({ width: view.width, height: view.height });
        calls.length = 0;
        await name.fill(`MiniMax 3 ${view.label}`);
        await name.blur();
        const before = await save.boundingBox();
        await page.screenshot({ path: info.outputPath(`${view.label}-before-save.png`) });
        await save.click();
        await expect(header.getByText("Saved", { exact: true })).toBeAttached();
        const after = await save.boundingBox();
        const visible = await header.evaluate((element) => ({
          saveIcons: element.querySelectorAll("svg.lucide-save").length,
          checks: element.querySelectorAll("svg.lucide-check").length,
          buttons: [...element.querySelectorAll("button")].map((button) => ({
            label: button.getAttribute("aria-label"),
            left: button.getBoundingClientRect().left,
            right: button.getBoundingClientRect().right,
          })),
        }));
        await page.screenshot({ path: info.outputPath(`${view.label}-saved-flash.png`) });
        await expect(header.getByText("Saved", { exact: true })).not.toBeAttached();
        const settled = await save.boundingBox();
        await page.screenshot({ path: info.outputPath(`${view.label}-status-gone.png`) });
        const proofPath = info.outputPath(`${view.label}-save-state.json`);
        writeFileSync(proofPath, JSON.stringify({ before, after, settled, calls, visible }, null, 2));
        await info.attach(`${view.label}-save-state`, { path: proofPath, contentType: "application/json" });
        await expect(save).toHaveCount(1);
        expect(visible.saveIcons).toBe(1);
        expect(calls).toEqual([`PUT /api/connections/${id}/default-parameters`, `PATCH /api/connections/${id}`]);
        expect(after!.x, "success feedback must not move the Save control").toBeCloseTo(before!.x, 1);
        expect(settled!.x, "clearing success feedback must not move the Save control").toBeCloseTo(before!.x, 1);
      }
    } finally {
      await request.delete(`/api/connections/${id}`);
    }
  });
}
