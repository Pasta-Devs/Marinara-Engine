import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// Sonnet 5.5 keeps Off (sent as between_tools natively, low effort elsewhere), unlike Opus 5.5.
for (const provider of ["anthropic", "claude_subscription"] as const) {
  test(`Sonnet 5.5 selection and reasoning Off/max persist for ${provider}`, async ({ page, request }, info) => {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: info.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript((value) => localStorage.setItem("marinara:whats-new:seen-version", value), version);
    const created = await request.post("/api/connections", {
      data: { name: "Sonnet 5.5 fixture", provider, model: "" },
    });
    expect(created.ok()).toBeTruthy();
    const { id } = await created.json();
    const open = async () => {
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openConnectionDetail(id);
      }, id);
      await expect(page.getByPlaceholder("Connection name")).toHaveValue("Sonnet 5.5 fixture");
    };
    try {
      await page.goto("/");
      await open();
      await page.getByText("Select a model…", { exact: true }).click();
      await page.getByPlaceholder("Search models…").fill("sonnet-5-5");
      const choice = page.getByRole("button").filter({ hasText: /claude-sonnet-5-5|Claude Sonnet 5\.5/ });
      await expect(choice).toHaveCount(1);
      await expect(choice).toContainText("1.0M");
      await expect(choice).toContainText("128K");
      await choice.click();
      const defaults = page.getByRole("checkbox", { name: "Use custom defaults for this connection", exact: true });
      await defaults.scrollIntoViewIfNeeded();
      await defaults.press("Space");
      await expect(defaults).toBeChecked();
      const reasoning = page.getByText("Reasoning Effort", { exact: true }).locator("../../..");
      const off = reasoning.getByRole("button", { name: "Off", exact: true });
      const maximum = reasoning.getByRole("button", { name: "max", exact: true });
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
          .toEqual({ model: "claude-sonnet-5-5", maxContext: 1_000_000, effort });
        await page.reload();
        await open();
        await expect(button).toHaveAttribute("aria-pressed", "true");
      }
    } finally {
      await page.close();
      await request.delete(`/api/connections/${id}`);
    }
  });
}
