import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

// #6943: packages with their own Home tab are standalone apps, so they get an Apps group instead of Misc.
// A Game Mode Experience mounts inside a game rather than as a Home tab, so it stays a Misc agent.
const PACKAGES = [
  {
    id: "pocket-town",
    name: "Pocket Town",
    contributions: { slots: ["home-browser-tab"], homeBrowserTab: { label: "Pocket Town" } },
  },
  { id: "scene-painter", name: "Scene Painter" },
  { id: "story-pack", name: "Story Pack", contributions: { slots: ["game-surface"] } },
].map(({ id, name, contributions }) => ({
  id,
  name,
  manifest: {
    schemaVersion: 1,
    id,
    name,
    version: "1.0.0",
    description: `${name} fixture.`,
    engine: { min: "2.3.0", maxExclusive: "4.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json", ...(contributions ? { client: "client.js" } : {}) },
    ...(contributions ? { contributions } : {}),
    files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  },
}));

test("standalone apps get their own group and appear only under All in Agents", async ({ page }, info) => {
  let foldered = false;
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        generatedAt: "2026-10-01T00:00:00.000Z",
        packages: PACKAGES.map(({ id, manifest }) => ({
          manifest,
          category: "misc",
          artifact: { url: `https://example.com/${id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
        })),
      },
    }),
  );
  await page.route("**/api/capability-packages/installed", (route) =>
    route.fulfill({
      json: PACKAGES.map(({ id, manifest }) => ({
        id,
        version: manifest.version,
        manifest,
        installedAt: "2026-10-01T00:00:00.000Z",
        status: "active",
        error: null,
        readiness: "ready",
        readinessError: null,
        legacy: false,
      })),
    }),
  );
  await page.route("**/api/capability-packages/agents", (route) =>
    route.fulfill({
      json: PACKAGES.map(({ id, name, manifest }) => ({
        id,
        packageId: id,
        name,
        description: manifest.description,
        phase: "pre_generation",
        enabledByDefault: false,
        category: "misc",
        ...(manifest.contributions ? { libraryHidden: true, runtimeDisabled: true, execution: "feature" } : {}),
        defaultPromptTemplate: "",
      })),
    }),
  );
  await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/library-folders/agents", (route) =>
    route.fulfill({
      json: foldered
        ? [
            {
              id: "app-folder",
              scope: "agents",
              name: "App folder",
              collapsed: false,
              sortOrder: 0,
              itemIds: ["pocket-town"],
            },
          ]
        : [],
    }),
  );
  await page.route("**/api/capability-packages/*/client?*", (route) =>
    route.fulfill({ contentType: "text/javascript", body: "export {};" }),
  );

  await page.goto("/");
  await clickTopbarPanel(page, "agents");
  const agentsPanel = page.getByLabel("Agents");
  const panelSection = (title: string) =>
    agentsPanel.getByRole("button", { name: title, exact: true }).locator("xpath=../..");
  await expect(panelSection("Apps").locator("[data-agent-card]")).toHaveAttribute("data-agent-name", "Pocket Town");
  const miscCards = panelSection("Misc Agents").locator("[data-agent-card]");
  await expect(miscCards).toHaveCount(2);
  await expect(miscCards.filter({ hasText: "Scene Painter" })).toHaveCount(1);
  await expect(miscCards.filter({ hasText: "Story Pack" })).toHaveCount(1);

  const appCard = agentsPanel.locator('[data-agent-card][data-agent-name="Pocket Town"]');
  const modes = agentsPanel.getByRole("group", { name: "Filter agents by supported chat mode" });
  const agentSearch = agentsPanel.getByPlaceholder("Search agents", { exact: true });
  for (const location of ["root", "folder"]) {
    if (location === "folder") {
      foldered = true;
      await page.reload();
      await clickTopbarPanel(page, "agents");
      await expect(agentsPanel.getByText("App folder", { exact: true })).toBeVisible();
    }
    await expect(appCard).toBeVisible();
    for (const mode of ["Conversation", "Roleplay", "Game"]) {
      await modes.getByRole("button", { name: mode, exact: true }).click();
      await expect(appCard).toHaveCount(0);
      if (mode === "Game")
        await expect(agentsPanel.locator('[data-agent-card][data-agent-name="Story Pack"]')).toBeVisible();
      await agentSearch.fill("Pocket Town");
      await expect(agentsPanel.locator("[data-agent-card]")).toHaveCount(0);
      await agentSearch.fill("");
    }
    await page.screenshot({ path: info.outputPath(`apps-hidden-in-game-${location}.png`) });
    await modes.getByRole("button", { name: "All", exact: true }).click();
    await agentSearch.fill("Pocket Town");
    await expect(appCard).toBeVisible();
    await page.screenshot({ path: info.outputPath(`apps-visible-in-all-${location}.png`) });
    await agentSearch.fill("");
  }

  await agentsPanel.getByRole("button", { name: "Download Agents", exact: true }).click();
  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  await expect(catalogView.locator("aside h3")).toHaveText(["Apps", "Misc Agents"]);
  const catalogSection = (title: string) => catalogView.locator("aside h3", { hasText: title }).locator("..");
  await expect(catalogSection("Apps").locator("button")).toHaveText([/Pocket Town/u]);
  await expect(catalogSection("Misc Agents").locator("button")).toHaveText([/Scene Painter/u, /Story Pack/u]);
  // Searching for a group's name finds the packages in it.
  const search = catalogView.getByLabel("Search downloadable agents");
  await search.fill("Apps");
  await expect(catalogView.locator("aside button", { hasText: /Pocket Town|Scene Painter|Story Pack/u })).toHaveText([
    /Pocket Town/u,
  ]);
  await search.fill("");
  await catalogSection("Apps")
    .getByRole("button", { name: /Pocket Town/u })
    .click();
  const detail = catalogView.locator("main");
  await expect(detail.getByRole("heading", { name: "Pocket Town" })).toBeVisible();
  await expect(detail.getByText("Apps", { exact: true })).toBeVisible();
});
