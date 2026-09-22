import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const model of ["gpt-6-sol", "gpt-6-luna"]) {
  test(`${model} selection and reasoning Off/Maximum persist`, async ({ page, request }, info) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    const created = await request.post("/api/connections", {
      data: { name: `${model} fixture`, provider: "openai", model: "" },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    const open = async () => {
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
      await expect(page.getByPlaceholder("Connection name")).toHaveValue(`${model} fixture`);
    };
    try {
      await page.goto("/");
      await open();
      await page.getByText("Select a model…", { exact: true }).click();
      await page.getByPlaceholder("Search models…").fill(model);
      await page.screenshot({ path: info.outputPath("model-picker.png"), animations: "disabled" });
      const choice = page.getByRole("button").filter({ hasText: model });
      await expect(choice).toHaveCount(1);
      await expect(choice).toContainText("1.1M");
      await expect(choice).toContainText("128K");
      await choice.click();
      const defaults = page.getByRole("checkbox", { name: "Use custom defaults for this connection", exact: true });
      await defaults.scrollIntoViewIfNeeded();
      await defaults.press("Space");
      await expect(defaults).toBeChecked();
      const reasoning = page.getByText("Reasoning Effort", { exact: true }).locator("../../..");
      const off = reasoning.getByRole("button", { name: "Off", exact: true });
      const maximum = reasoning.getByRole("button", { name: "Maximum", exact: true });
      for (const [button, effort] of [
        [off, null],
        [maximum, "maximum"],
      ] as const) {
        await button.click();
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect
          .poll(async () => {
            const row = await (await request.get(`/api/connections/${id}`)).json();
            return {
              model: row.model,
              maxContext: row.maxContext,
              effort: JSON.parse(row.defaultParameters).reasoningEffort,
            };
          })
          .toEqual({ model, maxContext: 1_050_000, effort });
        await page.reload();
        await open();
        await expect(button).toHaveAttribute("aria-pressed", "true");
      }
      await maximum.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath("reasoning-saved.png"), animations: "disabled" });
    } finally {
      await page.close();
      await request.delete(`/api/connections/${id}`);
    }
  });
}
