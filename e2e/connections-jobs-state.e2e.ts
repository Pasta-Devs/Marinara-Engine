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
        // The warning is its own fix button, so the row has no separate "Off" chip.
        await expect(
          row(key).getByRole("button", { name: current === "key" ? "Add key" : "Turn on", exact: true }),
        ).toBeVisible();
      }
      if (current === "agents") {
        // The warning's fix and the settings gear sit side by side, never on top of each other.
        const fix = await row("agents").getByRole("button", { name: "Turn on", exact: true }).boundingBox();
        const gear = await row("agents")
          .getByRole("button", { name: /settings$/ })
          .boundingBox();
        expect(fix && gear && fix.x + fix.width <= gear.x).toBeTruthy();
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

test("Jobs offer unstarred provider models below starred models", async ({ page }) => {
  // Three reloads and full-page screenshots take about 70 s on CI's Linux WebKit, where every click here waits
  // 2-5 s for the page to hold still; each step passes, only the default 60 s runs out.
  test.setTimeout(120_000);
  let picked = false;
  let assigned = "jobs-model";
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/connections", (route) =>
    route.fulfill({
      json: [
        {
          id: "jobs-model",
          accountId: "jobs-account",
          name: "Assigned unstarred model",
          model: "assigned-model",
          provider: "openai",
          isDefault: assigned === "jobs-model",
          enabled: true,
          pinnedModels: ["starred-model"],
        },
        ...(picked
          ? [
              {
                id: "jobs-picked",
                accountId: "jobs-account",
                provider: "openai",
                model: "unstarred-model",
                name: "Unstarred model",
                isDefault: assigned === "jobs-picked",
                pinnedModels: ["starred-model"],
              },
            ]
          : []),
      ],
    }),
  );
  await page.route("**/api/connection-accounts/jobs-account/for-model", (route) => {
    picked = true;
    return route.fulfill({ json: { connectionId: "jobs-picked" } });
  });
  await page.route("**/api/connections/jobs-picked", (route) => {
    assigned = "jobs-picked";
    return route.fulfill({ json: { id: assigned } });
  });
  await page.route("**/api/connection-accounts", (route) =>
    route.fulfill({
      json: [
        {
          id: "jobs-account",
          name: "Jobs provider",
          provider: "openai",
          state: "ok",
          enabled: true,
          baseUrl: "https://example.invalid/v1",
          modelCount: 2,
        },
      ],
    }),
  );
  await page.route("**/api/connections/*/models*", (route) =>
    route.fulfill({
      json: {
        models: [
          { id: "starred-model", name: "Starred model" },
          { id: "unstarred-model", name: "Unstarred model" },
          ...Array.from({ length: 100 }, (_, index) => ({ id: `zz-bulk/${index}`, name: `Bulk ${index}` })),
        ],
      },
    }),
  );
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
  const mainJob = page.locator('[data-defaults-role="main"]').filter({ visible: true });
  await expect(mainJob).toContainText("Assigned unstarred model");
  await mainJob.locator("button[aria-haspopup=dialog]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-switcher-section="provider"] [aria-current="true"]')).toContainText(
    "Assigned unstarred model",
  );
  await expect(dialog.locator('[data-switcher-section="starred"]')).toContainText("Starred model");
  await expect(dialog.locator('[data-switcher-section="provider"]')).toContainText("Unstarred model");
  await expect(dialog.locator('[data-switcher-section="provider"]')).not.toContainText("Starred model");
  for (const width of [390, 768, 1440]) {
    await dialog.getByRole("button", { name: /^Close Model for Main$/ }).click();
    await expect(dialog).not.toBeVisible();
    await page.setViewportSize({ width, height: 960 });
    await page.reload();
    await mainJob.locator("button[aria-haspopup=dialog]").first().click();
    await expect(dialog.locator('[data-switcher-section="provider"]')).toContainText("Unstarred model");
    await page.screenshot({
      path: `.tmp/connections-jobs/picker-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  }
  await dialog.locator('[data-switcher-section="provider"] button[data-switcher-model="unstarred-model"]').click();
  await expect(dialog).not.toBeVisible();
  await expect(mainJob).toContainText("Unstarred model");
  await mainJob.locator("button[aria-haspopup=dialog]").first().click();
  await expect(dialog.locator('[data-switcher-section="provider"] [aria-current="true"]')).toContainText(
    "Unstarred model",
  );
  await page.evaluate(() => {
    const scope = window as typeof window & { jobsCatalogComparisons: number };
    scope.jobsCatalogComparisons = 0;
    const compare = String.prototype.localeCompare;
    String.prototype.localeCompare = function (
      other: string,
      locales?: Intl.LocalesArgument,
      options?: Intl.CollatorOptions,
    ) {
      if (String(this).startsWith("zz-bulk/") && String(other).startsWith("zz-bulk/")) {
        scope.jobsCatalogComparisons++;
      }
      return compare.call(this, other, locales, options);
    };
  });
  const search = dialog.locator('input[type="text"], input[type="search"]').first();
  await search.fill("no-match-qc");
  await expect(dialog.locator('[data-switcher-section="provider"]')).toHaveCount(0);
  await search.press("ArrowDown");
  await expect
    .poll(() =>
      page.evaluate(() => (window as typeof window & { jobsCatalogComparisons: number }).jobsCatalogComparisons),
    )
    .toBe(0);
});

test("Decisions keep an assigned unstarred model visible without a catalog entry", async ({ page }) => {
  let selected = "decision-row";
  let created = false;
  let tested = 0;
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await page.route("**/api/connections", (route) => {
    if (route.request().method() === "POST") {
      created = true;
      return route.fulfill({ json: { id: "decision-picked" } });
    }
    return route.fulfill({
      json: [
        {
          id: "chat-anchor",
          accountId: "decision-account",
          name: "Starred chat",
          model: "chat-model",
          provider: "openai",
          pinnedModels: [],
        },
        {
          id: "decision-row",
          accountId: "decision-account",
          name: "Assigned decision",
          model: "decision-model",
          provider: "decision",
          defaultForAgents: selected === "decision-row",
        },
        ...(created
          ? [
              {
                id: "decision-picked",
                accountId: "decision-account",
                name: "new-decision-model",
                model: "new-decision-model",
                provider: "decision",
                defaultForAgents: selected === "decision-picked",
              },
            ]
          : []),
      ],
    });
  });
  await page.route("**/api/connections/decision-picked/test", (route) => {
    tested++;
    return route.fulfill({ json: { success: true, logprobs: true } });
  });
  await page.route("**/api/decision/select", (route) => {
    selected = route.request().postDataJSON().id;
    return route.fulfill({ json: { selected } });
  });
  await page.route("**/api/connection-accounts", (route) =>
    route.fulfill({
      json: [{ id: "decision-account", name: "Decision provider", provider: "openai", state: "ok", enabled: true }],
    }),
  );
  await page.route("**/api/decision/options", (route) =>
    route.fulfill({
      json: {
        selected,
        options: [
          {
            id: "decision-row",
            label: "Assigned decision",
            group: "connection",
            slot: null,
            selected: selected === "decision-row",
            unavailable: null,
          },
          ...(created
            ? [
                {
                  id: "decision-picked",
                  label: "new-decision-model",
                  group: "connection",
                  slot: null,
                  selected: selected === "decision-picked",
                  unavailable: null,
                },
              ]
            : []),
        ],
      },
    }),
  );
  await page.route("**/api/connections/*/models*", (route) =>
    route.fulfill({
      json: {
        models: [
          { id: "chat-model", name: "Starred chat" },
          { id: "new-decision-model", name: "New decision", capabilities: { logprobs: true } },
        ],
      },
    }),
  );
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
  const job = page.locator('[data-defaults-role="decision"]').filter({ visible: true });
  await expect(job).toContainText("Assigned decision");
  await job.locator("button[aria-haspopup=dialog]").first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('[data-switcher-section="starred"]')).toBeEmpty();
  await expect(dialog.locator('[data-switcher-section="provider"] [aria-current="true"]')).toContainText(
    "Assigned decision",
  );
  await dialog.locator('[data-switcher-section="provider"] button[data-switcher-model="new-decision-model"]').click();
  await expect(dialog).not.toBeVisible();
  expect(tested).toBe(1);
  await expect(job).toContainText("new-decision-model");
  await job.locator("button[aria-haspopup=dialog]").first().click();
  await expect(dialog.locator('[data-switcher-section="provider"] [aria-current="true"]')).toHaveAttribute(
    "data-switcher-model",
    "new-decision-model",
  );
  await expect(
    dialog.locator('[data-switcher-section="known"] button[data-switcher-model="new-decision-model"]'),
  ).toHaveCount(1);
  await dialog.locator('[data-switcher-section="provider"] button[data-switcher-model="new-decision-model"]').click();
  await expect(dialog).not.toBeVisible();
  expect(tested).toBe(2);
});
