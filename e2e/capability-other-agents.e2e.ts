import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

// Capability API 1.819: the package page's Other agents section, before and after the peer is installed.
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

function manifest(id: string, name: string, services: unknown) {
  return {
    schemaVersion: 2,
    capabilityApi: { major: 1, minor: 819 },
    builtAgainst: { engineVersion: "2.3.0", engineCommit: "a".repeat(40) },
    id,
    name,
    version: "1.0.0",
    description: `${name} proof`,
    engine: { min: "2.3.0", maxExclusive: "3.0.0" },
    kind: ["agent"],
    entrypoints: { server: "server.mjs" },
    files: [],
    permissions: [],
    restartRequired: false,
    contributions: { services },
  };
}

const memory = manifest("memory-fixture", "Memory fixture", {
  provides: [
    { key: "memory-fixture:recall", version: 1 },
    { key: "memory-fixture:intake", version: 1, sharedByDefault: false },
  ],
});
const feed = manifest("feed-fixture", "Feed fixture", {
  requires: [
    { key: "memory-fixture:recall", version: 1, description: "Reads memories for posts." },
    { key: "memory-fixture:intake", version: 1, description: "Adds memories to Memory fixture." },
  ],
});
const installedRow = (item: typeof memory) => ({
  id: item.id,
  version: item.version,
  manifest: item,
  installedAt: "2026-11-01T00:00:00Z",
  status: "active",
  readiness: "ready",
  error: null,
  legacy: false,
});

for (const peerInstalled of [false, true]) {
  test(`package page lists other agents (${peerInstalled ? "both installed" : "peer not installed"})`, async ({
    page,
  }, testInfo) => {
    page.setDefaultTimeout(10_000);
    const puts: unknown[] = [];
    let overrides: Array<{ key: string; consumerId: string; shared: boolean }> = [];
    const usage = [
      {
        key: "memory-fixture:recall",
        consumerId: "feed-fixture",
        lastUsedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
        usesThisWeek: 12,
      },
    ];
    await page.route("**/api/capability-packages/catalog", (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          generatedAt: "2026-11-01T00:00:00Z",
          packages: [memory, feed].map((item) => ({
            category: "misc",
            manifest: item,
            artifact: { url: `https://example.com/${item.id}.zip`, sha256: "a".repeat(64), bytes: 2048 },
          })),
        },
      }),
    );
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({ json: [installedRow(memory), ...(peerInstalled ? [installedRow(feed)] : [])] }),
    );
    await page.route("**/api/capability-packages/service-sharing", async (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON() as { key: string; consumerId: string; shared: boolean };
        puts.push(body);
        overrides = [...overrides.filter((entry) => entry.key !== body.key), body];
      }
      await route.fulfill({ json: { overrides, usage } });
    });
    await page.route("**/api/capability-packages/updates", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.goto("/", { timeout: 120_000 });
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openAgentCatalog("memory-fixture");
    });

    const view = page.locator('[data-component="AgentCatalogView"]');
    const section = view.getByRole("heading", { name: "Other agents", exact: true }).locator("..");
    await expect(section).toBeVisible();
    await expect(section).toContainText("Reads memories for posts.");
    await expect(section).toContainText("Adds memories to Memory fixture.");
    const recall = section.getByRole("switch", { name: "Let Feed fixture use recall" });
    const intake = section.getByRole("switch", { name: "Let Feed fixture use intake" });

    if (!peerInstalled) {
      await expect(section.getByRole("button", { name: "Get" })).toHaveCount(2);
      await expect(section.getByRole("switch")).toHaveCount(0);
      await expect(section).not.toContainText("uses this week");
    } else {
      await expect(section.getByRole("button", { name: "Get" })).toHaveCount(0);
      await expect(recall).toBeChecked();
      await expect(intake).not.toBeChecked();
      await expect(section).toContainText("12 uses this week");
      await expect(section).toContainText("Not used yet");
      // The input is visually hidden inside its label, as in the Engine's other switches; a user taps the track.
      await intake.locator("xpath=..").click();
      await expect(intake).toBeChecked();
      expect(puts).toEqual([{ key: "memory-fixture:intake", consumerId: "feed-fixture", shared: true }]);
    }

    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      await section.scrollIntoViewIfNeeded();
      const name = `other-agents-${peerInstalled ? "installed" : "available"}-${theme}`;
      await testInfo.attach(`${name}-${testInfo.project.name}.png`, {
        body: await section.screenshot({ animations: "disabled", path: testInfo.outputPath(`${name}.png`) }),
        contentType: "image/png",
      });
    }
  });
}
