import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const savedPlace = { doc: "agents/memory.md", scrollTop: 99 };
const source = "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/staging/packages/guide-fixture/README.md";
const topics = [
  { id: "overview", title: "Overview", sourceUrl: source },
  { id: "setup", title: "Set up", sourceUrl: source.replace("README.md", "docs/setup.md") },
];
const activate = (page: Page, target: Locator) => (page.viewportSize()!.width < 640 ? target.tap() : target.click());
test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: info.project.name.startsWith("desktop") ? 1440 : 390, height: 900 });
});

async function openFixture(
  page: Page,
  options: {
    theme?: "light" | "dark";
    visualTheme?: "default" | "sillytavern";
    status?: "available" | "cached" | "unavailable";
  } = {},
) {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    theme: options.theme ?? "dark",
    visualTheme: options.visualTheme ?? "default",
  });
  await page.addInitScript(
    ({ version, savedPlace }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-docs-viewer-place", JSON.stringify(savedPlace));
      localStorage.setItem("marinara-tap-timings", "1");
    },
    { version, savedPlace },
  );
  const manifest = {
    schemaVersion: 1,
    id: "guide-fixture",
    name: "Guide fixture",
    version: "1.0.0",
    description: "A package with topic guides.",
    engine: { min: "2.3.0", maxExclusive: "4.0.0" },
    kind: ["agent"],
    entrypoints: { agents: "agents.json" },
    files: [{ path: "agents.json", sha256: "0".repeat(64), bytes: 1 }],
    permissions: ["ui"],
    restartRequired: false,
  };
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({
      json: {
        schemaVersion: 1,
        generatedAt: "2026-11-25T00:00:00.000Z",
        packages: [
          {
            manifest,
            category: "misc",
            artifact: { url: "https://example.org/fixture.zip", sha256: "a".repeat(64), bytes: 100 },
            documentationUrl: source,
          },
        ],
      },
    }),
  );
  for (const endpoint of [
    "capability-packages/installed",
    "capability-packages/agents",
    "agents",
    "library-folders/agents",
  ]) {
    await page.route(`**/api/${endpoint}`, (route) => route.fulfill({ json: [] }));
  }
  await page.route("**/api/capability-packages/guide-fixture/release-notes", (route) =>
    route.fulfill({
      json: Array.from({ length: 8 }, (_, index) => ({
        version: `1.0.${8 - index}`,
        date: "2026-11-25",
        notes: `Fixture release ${index + 1}`,
        highlight: false,
      })),
    }),
  );
  await page.route("**/api/capability-packages/guide-fixture/documentation?*", (route) => {
    const guideId = new URL(route.request().url()).searchParams.get("guide") ?? "overview";
    return route.fulfill({
      json: {
        packageId: manifest.id,
        packageVersion: manifest.version,
        guideId,
        title: guideId === "setup" ? "Set up" : "Overview",
        topics,
        status: options.status ?? "available",
        sourceUrl: topics.find((topic) => topic.id === guideId)!.sourceUrl,
        content:
          options.status === "unavailable"
            ? undefined
            : guideId === "setup"
              ? "# Set up\n\nChoose a character."
              : "# Guide fixture\n\nRead the [Set up](docs/setup.md) guide.\n\n<script>window.__guideExecuted = true</script>",
        retrievedAt: "2026-11-25T00:00:00.000Z",
      },
    });
  });
  await page.goto("/");
  await clickTopbarPanel(page, "agents", page.viewportSize()!.width < 640 ? "tap" : "click");
  await page
    .getByRole("region", { name: "Agents", exact: true })
    .getByRole("button", { name: "Agent Organizer", exact: true })
    .click();
  const catalog = page.locator('[data-component="AgentCatalogView"]');
  await catalog
    .getByRole("button", { name: /Guide fixture A package/u })
    .first()
    .click();
  return catalog;
}

for (const visualTheme of ["default", "sillytavern"] as const)
  for (const theme of ["dark", "light"] as const) {
    test(`agent guides reuse the docs modal, preserve reading place and collapse history (${visualTheme}, ${theme})`, async ({
      page,
    }, info) => {
      const catalog = await openFixture(page, { theme, visualTheme });
      await expect(catalog.getByText("Fixture release 4", { exact: true })).toHaveCount(0);
      await catalog.getByRole("button", { name: "Show older versions" }).click();
      await expect(catalog.getByText("Fixture release 4", { exact: true })).toBeVisible();
      await catalog.getByRole("button", { name: "Show fewer versions" }).click();
      await expect(catalog.getByText("Fixture release 4", { exact: true })).toHaveCount(0);
      await catalog.getByRole("heading", { name: "Permissions", exact: true }).scrollIntoViewIfNeeded();
      await activate(page, catalog.getByRole("button", { name: "Read how this agent works" }));
      const dialog = page.getByRole("dialog", { name: "Guide fixture guides", exact: true });
      await expect(dialog.getByRole("heading", { name: "Guide fixture", exact: true })).toBeVisible();
      await expect(dialog.getByText("Guide language: English", { exact: true })).toBeVisible();
      await activate(page, dialog.getByRole("link", { name: "Set up", exact: true }));
      await expect(dialog.getByText("Choose a character.", { exact: true })).toBeVisible();
      expect(page.context().pages()).toHaveLength(1);
      expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__guideExecuted)).toBeUndefined();
      if (page.viewportSize()!.width < 640) {
        await dialog.getByRole("button", { name: "Back to guide list" }).tap();
        await dialog.getByRole("button", { name: "Overview", exact: true }).tap();
        await expect(dialog.getByRole("heading", { name: "Guide fixture", exact: true })).toBeVisible();
      }
      await page.screenshot({ path: info.outputPath(`${visualTheme}-${theme}-guide.png`) });
      const readings = await page.locator('[data-component="TapTimings"]').innerText();
      await info.attach("tap-timings", { body: readings, contentType: "text/plain" });
      await dialog.getByRole("button", { name: /^Close /u }).click();
      await expect(catalog.getByRole("heading", { name: "Permissions", exact: true })).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("marinara-docs-viewer-place")!))).toEqual(
        savedPlace,
      );
    });
  }

for (const status of ["unavailable", "cached"] as const)
  test(`agent guide ${status} state retains its source`, async ({ page }) => {
    await openFixture(page, { status });
    await page.getByRole("button", { name: "Read how this agent works" }).click();
    const dialog = page.getByRole("dialog", { name: "Guide fixture guides", exact: true });
    if (status === "unavailable") await expect(dialog.getByText(/This guide could not be loaded/u)).toBeVisible();
    else await expect(dialog.getByRole("status")).toContainText("Saved guide, source currently unavailable");
    await expect(dialog.getByRole("link", { name: "View source" })).toHaveAttribute("href", source);
  });
