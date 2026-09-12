import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const granted of [[], ["chat-read"]]) {
  test(`catalog distinguishes installed permissions (${granted.length ? "read-only" : "none"})`, async ({
    page,
  }, testInfo) => {
    page.setDefaultTimeout(10_000);
    const manifest = {
      schemaVersion: 1,
      id: "permission-fixture",
      name: "Permission fixture",
      version: "1.0.0",
      description: "Permission display proof",
      engine: { min: "2.3.0", maxExclusive: "3.0.0" },
      kind: ["agent"],
      entrypoints: { server: "server.mjs" },
      files: [],
      permissions: granted,
      restartRequired: false,
    };
    await page.route("**/api/capability-packages/catalog", (route) =>
      route.fulfill({
        json: {
          schemaVersion: 1,
          generatedAt: "2026-09-09T00:00:00Z",
          packages: [
            {
              category: "misc",
              manifest: { ...manifest, version: "1.1.0", permissions: ["chat-read", "chat-write", "network"] },
              artifact: { url: "https://example.com/fixture.zip", sha256: "a".repeat(64), bytes: 2048 },
            },
          ],
        },
      }),
    );
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          {
            id: manifest.id,
            version: manifest.version,
            manifest,
            installedAt: "2026-09-08T00:00:00Z",
            status: "active",
            readiness: "ready",
            error: null,
            legacy: false,
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/updates", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/capability-packages/agents", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    const open = async () => {
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openAgentCatalog("permission-fixture");
      });
    };
    await page.goto("/");
    await open();
    const view = page.locator('[data-component="AgentCatalogView"]');
    const installed = view.getByRole("heading", { name: "Installed v1.0.0 permissions", exact: true }).locator("..");
    const available = view.getByRole("heading", { name: "Catalog v1.1.0 permissions", exact: true }).locator("..");
    await expect(installed).toBeVisible();
    if (granted.length) await expect(installed).toContainText("chat read");
    else await expect(installed).toContainText("No permissions declared.");
    await expect(installed).not.toContainText("chat write");
    await expect(available).toContainText("chat write");
    await expect(view).toContainText("Chat read/write permissions gate the package persistence API.");
    await expect(view).toContainText("they do not sandbox package code.");
    for (const theme of ["dark", "light"] as const) {
      await page.evaluate(async (theme) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().setTheme(theme);
      }, theme);
      await available.scrollIntoViewIfNeeded();
      await testInfo.attach(`permissions-${granted.length}-${theme}-${testInfo.project.name}.png`, {
        body: await page.screenshot({
          animations: "disabled",
          path: testInfo.outputPath(`permissions-${granted.length}-${theme}.png`),
        }),
        contentType: "image/png",
      });
    }
    await page.reload();
    await open();
    await expect(installed).toBeVisible();
    await expect(installed).not.toContainText("chat write");
  });
}
