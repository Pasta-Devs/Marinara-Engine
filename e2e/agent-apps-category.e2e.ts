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

test("standalone apps get their own group in the Agent Organizer and stay out of the Agents panel", async ({
  page,
}, info) => {
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
  // The panel groups agents by the Agent Organizer's store sections since #8546, so the uncatalogued agents sit
  // under More agents. It lists no Home screen app since #8449, folders included: apps open from their Home tab.
  const moreCards = panelSection("More agents (2)").locator("[data-agent-card]");
  await expect(moreCards).toHaveCount(2);
  await expect(moreCards.filter({ hasText: "Scene Painter" })).toHaveCount(1);
  await expect(moreCards.filter({ hasText: "Story Pack" })).toHaveCount(1);
  await expect(agentsPanel.getByRole("button", { name: /^Apps \(/u })).toHaveCount(0);

  const appCard = agentsPanel.locator('[data-agent-card][data-agent-name="Pocket Town"]');
  const modes = agentsPanel.getByRole("group", { name: "Filter agents by supported chat mode" });
  const agentSearch = agentsPanel.getByPlaceholder("Search agents", { exact: true });
  for (const location of ["root", "folder"]) {
    if (location === "folder") {
      foldered = true;
      await page.reload();
      await clickTopbarPanel(page, "agents");
      // Open the folder: it shows no app either.
      const folder = agentsPanel.locator('[data-agent-folder-id="app-folder"] [role="button"][aria-expanded]');
      await expect(folder).toContainText("App folder");
      await folder.click();
      await expect(folder).toHaveAttribute("aria-expanded", "true");
      await expect(moreCards).toHaveCount(2);
    }
    for (const mode of ["All", "Conversation", "Roleplay", "Game"]) {
      await modes.getByRole("button", { name: mode, exact: true }).click();
      await expect(appCard).toHaveCount(0);
      if (mode === "Game")
        await expect(agentsPanel.locator('[data-agent-card][data-agent-name="Story Pack"]')).toBeVisible();
      await agentSearch.fill("Pocket Town");
      await expect(agentsPanel.locator("[data-agent-card]")).toHaveCount(0);
      await agentSearch.fill("");
    }
    await page.screenshot({ path: info.outputPath(`apps-hidden-${location}.png`) });
    await modes.getByRole("button", { name: "All", exact: true }).click();
  }

  // The Agent Organizer (#8440, formerly Download Agents) keeps the Apps group, as a store section.
  await agentsPanel.getByRole("button", { name: "Agent Organizer", exact: true }).click();
  const catalogView = page.locator('[data-component="AgentCatalogView"]');
  const shelf = (title: string) => catalogView.getByRole("region", { name: title, exact: true });
  await expect(shelf("Apps").getByRole("listitem")).toHaveText([/Pocket Town/u]);
  await expect(shelf("More agents").getByRole("listitem")).toHaveText([/Scene Painter/u, /Story Pack/u]);
  // Searching for a group's name finds the packages in it.
  const search = catalogView.getByLabel("Search downloadable agents").filter({ visible: true });
  await search.fill("Apps");
  await expect(catalogView.locator("main li", { hasText: /Pocket Town|Scene Painter|Story Pack/u })).toHaveText([
    /Pocket Town/u,
  ]);
  await search.fill("");
  await shelf("Apps")
    .getByRole("button", { name: /^Pocket Town/u })
    .click();
  const detail = catalogView.locator("main");
  await expect(detail.getByRole("heading", { name: "Pocket Town" })).toBeVisible();
  await expect(detail.getByText("Apps · App", { exact: true })).toBeVisible();
});

test("organizer and agent pages fit the viewport with long content", async ({ page }, info) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        generatedAt: "2026-10-01T00:00:00.000Z",
        packages: PACKAGES.map(({ id, manifest }, index) => ({
          manifest: { ...manifest, description: `Long description ${"unbroken".repeat(60)}` },
          category: "misc",
          store: {
            section: "apps",
            featured: index + 1,
            tagline: "A mobile layout fixture",
            previewUrls: ["https://example.com/layout-preview.svg"],
          },
          artifact: { url: `https://example.com/${id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
        })),
      },
    }),
  );
  await page.route("https://example.com/layout-preview.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="teal"/></svg>',
    }),
  );
  await page.goto("/");
  await clickTopbarPanel(page, "agents");
  await page
    .getByLabel("Agents", { exact: true })
    .getByRole("button", { name: "Agent Organizer", exact: true })
    .click();
  const organizer = page.locator('[data-component="AgentCatalogView"]');
  const main = organizer.locator("main");
  async function fits() {
    await expect
      .poll(() => main.evaluate((element) => element.scrollWidth - element.clientWidth))
      .toBeLessThanOrEqual(1);
    await expect
      .poll(() => organizer.evaluate((element) => element.getBoundingClientRect().right - window.innerWidth))
      .toBeLessThanOrEqual(1);
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(main.getByRole("heading", { name: "Apps", exact: true })).toBeVisible();
    await fits();
    await page.screenshot({ path: info.outputPath(`organizer-${width}.png`) });
  }
  await main
    .getByRole("button", { name: /Pocket Town/ })
    .first()
    .click();
  await expect(main.getByRole("heading", { name: "Pocket Town", exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await fits();
    await page.screenshot({ path: info.outputPath(`agent-${width}.png`), fullPage: true });
  }
});
