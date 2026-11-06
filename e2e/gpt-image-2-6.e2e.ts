import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string })
  .version;

test("GPT Image 2.6 Flare and Sunburst are offered with 2.5's quality levels", async ({ page, request }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedUIState(page, { hasCompletedOnboarding: true, rightPanelOpen: false, sidebarOpen: false, theme: "dark" });
  await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
  const created = await request.post("/api/connections", {
    data: {
      name: `GPT Image 2.6 ${info.project.name}`,
      provider: "image_generation",
      imageGenerationSource: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-image-2",
      imageGenerationQuality: "high",
    },
  });
  expect(created.ok()).toBeTruthy();
  const { id } = (await created.json()) as { id: string };
  const open = async () => {
    await page.evaluate(async (connectionId) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openConnectionDetail(connectionId);
    }, id);
    await expect(page.getByPlaceholder("Model name", { exact: true })).toBeVisible();
  };
  const search = page.getByRole("searchbox", { name: "Search models or type a model ID", exact: true });
  const row = (model: string) =>
    page.locator(`[data-model-section="all"] [data-model-id="${model}"] [data-model-option]`);
  const quality = page
    .getByRole("heading", { name: "Image quality", exact: true })
    .locator("xpath=../..")
    .getByRole("combobox");
  try {
    await page.goto("/");
    await open();
    await expect(quality.locator("option")).toHaveCount(4);
    for (const [model, name, value, label] of [
      ["gpt-image-2.6-flare", "GPT Image 2.6 Flare", "xhigh", "Extra high"],
      ["gpt-image-2.6-sunburst", "GPT Image 2.6 Sunburst", "max", "Max"],
    ] as const) {
      await search.fill("gpt-image-2.6");
      await expect(row(model)).toHaveCount(1);
      await expect(row(model)).toContainText(name);
      await row(model).click();
      await expect(quality.locator("option")).toHaveCount(6);
      await quality.selectOption({ label });
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect
        .poll(async () => {
          const connection = await (await request.get(`/api/connections/${id}`)).json();
          return { model: connection.model, quality: connection.imageGenerationQuality };
        })
        .toEqual({ model, quality: value });
      await page.reload();
      await open();
      await expect(quality).toHaveValue(value);
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    await request.delete(`/api/connections/${id}`);
  }
});
