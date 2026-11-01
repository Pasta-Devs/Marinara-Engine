import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Jobs expand settings inline and retain inherited Main without changing follow state", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const patches: unknown[] = [];
  let starred = false;
  await page.route("**/api/decision/options", (route) =>
    route.fulfill({
      json: {
        selected: "local-primary",
        options: [
          {
            id: "local-primary",
            label: "Built-in model",
            group: "local",
            slot: "primary",
            selected: true,
            thinking: "auto",
          },
        ],
      },
    }),
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        {
          id: "inline-main",
          name: "Inline Main",
          model: "gpt-5.5",
          provider: "openai",
          accountId: "inline-account",
          isDefault: true,
          defaultForAgents: false,
          pinnedModels: starred ? ["gpt-5.5"] : [],
        },
      ],
    }),
  );
  await page.route("**/api/connections/inline-main", async (route) => {
    patches.push(route.request().postDataJSON());
    await route.fulfill({ json: { id: "inline-main" } });
  });
  await page.route("**/api/connection-accounts", (route) =>
    route.fulfill({
      json: [
        {
          id: "inline-account",
          name: "Inline account",
          provider: "openai",
          state: "ok",
          enabled: true,
          modelCount: 1,
        },
      ],
    }),
  );
  await page.route("**/api/app-settings/feature-model-connections", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/sidecar/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      json: { ...body, config: { ...body.config, useAsMainDefault: false, useAsAgentsDefault: false } },
    });
  });
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: true,
    rightPanel: "connections",
    connectionsCollapsed: [],
    chibiProfessorMariEnabled: false,
  });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
  await page.goto("/");
  const panel = page.locator("[data-connections-panel]").filter({ visible: true });
  for (const key of ["agents", "decision"]) {
    const row = panel.locator(`[data-defaults-role="${key}"]`);
    const gear = row.getByRole("button", { name: /settings/i });
    await expect(gear).toHaveAttribute("aria-expanded", "false");
    await gear.focus();
    await page.keyboard.press("Enter");
    await expect(gear).toHaveAttribute("aria-expanded", "true");
    const region = row.getByRole("region");
    await expect(region).toBeVisible();
    await expect(region).toHaveAttribute("id", (await gear.getAttribute("aria-controls")) as string);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    if (key === "agents") {
      await expect(region.getByRole("button", { name: /reset/i })).toBeVisible();
      const toggle = region.getByRole("checkbox");
      const before = await toggle.isChecked();
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toBeChecked({ checked: !before });
    }
    if (key === "decision") {
      await expect(region.getByRole("spinbutton")).toBeVisible();
      await expect(region.getByRole("combobox")).toBeVisible();
    }
    await region.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `.tmp/connections-inline/${key}-${page.viewportSize()!.width}.png` });
    await gear.click();
    await expect(region).toBeHidden();
  }
  expect(await panel.locator("button button, button input, button select").count()).toBe(0);
  const agents = panel.locator('[data-defaults-tile="agents"]');
  await agents.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const main = dialog.locator('[data-switcher-section="connection"] [data-switcher-entry="inline-main"]');
  await expect(main).toBeVisible();
  await expect(main).toHaveAttribute("aria-current", "true");
  await main.click();
  await expect(dialog).toBeHidden();
  expect(patches).toEqual([]);
  await expect(agents).toContainText("Follows Main");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.setState({ connectionsGroupBy: "folder" });
  });
  await agents.click();
  await expect(dialog.locator('[data-switcher-section="folder"] [data-switcher-entry="inline-main"]')).toBeVisible();
  await page.keyboard.press("Escape");
  starred = true;
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.setState({ connectionsGroupBy: "connection" });
    const { queryClient } = await import("/src/lib/query-client.ts" as string);
    await queryClient.invalidateQueries({ queryKey: ["connections"] });
  });
  await agents.click();
  await expect(dialog.locator('[data-switcher-section="starred"] [data-switcher-entry="inline-main"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await agents.click();
  await dialog.locator('[data-switcher-section="now"] [data-switcher-entry="inline-main"]').click();
  await expect(dialog).toBeHidden();
  expect(patches).toEqual([]);
  await expect(agents).toContainText("Follows Main");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  if (info.project.name === "desktop-chromium") {
    await page.setViewportSize({ width: 768, height: 960 });
    await page.reload();
    const row = panel.locator('[data-defaults-role="agents"]');
    await row.getByRole("button", { name: /settings/i }).click();
    await row.getByRole("region").scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".tmp/connections-inline/agents-768.png" });
  }
  expect(errors).toEqual([]);
});
