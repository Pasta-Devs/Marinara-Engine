import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Jobs remain available without accounts and show inherited account warnings", async ({ page }, info) => {
  let state = "empty";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json:
        state === "empty"
          ? []
          : [
              {
                id: "jobs-model",
                name: "Warning model",
                model: "gpt-5.5",
                provider: "openai",
                accountId: "jobs-account",
                isDefault: true,
                defaultForAgents: state === "agents",
              },
            ],
    }),
  );
  await page.route("**/api/connection-accounts", (route) =>
    route.fulfill({
      json:
        state === "empty"
          ? []
          : [
              {
                id: "jobs-account",
                name: "Warning account",
                provider: "openai",
                baseUrl: "https://example.invalid/v1",
                state: state === "key" ? "needs_key" : "off",
                enabled: false,
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
  const panel = page.locator("[data-connections-panel]").filter({ visible: true });
  const row = (key: string) => panel.locator(`[data-defaults-role="${key}"]`);
  for (const current of ["empty", "main", "agents", "key"]) {
    state = current;
    await page.goto("/");
    await expect(row("main")).toBeVisible();
    if (current === "empty") {
      await expect(panel.getByRole("button", { name: "Import a backup", exact: true })).toBeVisible();
      await expect(panel.locator('a[href="https://linkapi.ai/"]')).toHaveCount(0);
    } else {
      const followers = current === "agents" ? ["mari"] : ["agents", "impersonate", "mari"];
      for (const key of followers) {
        await expect(row(key)).toContainText("Warning model");
        await expect(row(key).getByText(current === "key" ? "Needs key" : "Off", { exact: true })).toBeVisible();
      }
    }
    await expect(row("quick")).not.toContainText("Follows");
    if (info.project.name === "desktop-chromium") {
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 960 });
        await page.screenshot({ path: `.tmp/connections-jobs/${current}-${width}.png`, fullPage: true });
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      }
    }
  }
  expect(errors).toEqual([]);
});
