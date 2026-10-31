import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsDrawer, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const mode of ["roleplay", "game"] as const) {
  test(`World Maps attachment requires an updated package in ${mode}`, async ({ page }, testInfo) => {
    let minor = 392;
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
    await page.route("**/api/capability-packages/agents", (route) =>
      route.fulfill({
        json: [
          {
            id: "hierarchical-maps",
            packageId: "hierarchical-maps",
            name: "World Maps",
            description: "Map fixture",
            category: "tracker",
            phase: "post_processing",
            enabledByDefault: false,
            runtimeDisabled: true,
            execution: "feature",
            defaultPromptTemplate: "",
            defaultSettings: {},
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/installed", (route) =>
      route.fulfill({
        json: [
          {
            id: "hierarchical-maps",
            version: "1.7.0",
            status: "active",
            readiness: "ready",
            error: null,
            installedAt: "2026-10-23T00:00:00Z",
            legacy: false,
            manifest: {
              schemaVersion: 2,
              id: "hierarchical-maps",
              name: "World Maps",
              version: "1.7.0",
              description: "Map fixture",
              engine: { min: "2.5.1", maxExclusive: "3.0.0" },
              kind: ["agent", "maps"],
              capabilityApi: { major: 1, minor },
              builtAgainst: { engineVersion: "2.5.1", engineCommit: "a".repeat(40) },
              entrypoints: { client: "client.js", agents: "agents.json" },
              permissions: ["ui"],
              restartRequired: false,
              files: [{ path: "client.js", sha256: "0".repeat(64), bytes: 1 }],
            },
          },
        ],
      }),
    );
    await page.route("**/api/capability-packages/hierarchical-maps/client?*", (route) =>
      route.fulfill({ contentType: "text/javascript", body: "export {};" }),
    );
    await page.addInitScript(() => {
      customElements.define(
        "marinara-capability-hierarchical-maps",
        class extends HTMLElement {
          connectedCallback() {
            this.textContent = "Map settings fixture";
          }
        },
      );
    });
    const response = await page.request.post("/api/chats", {
      data: { name: "Map reference compatibility", mode, characterIds: [] },
    });
    expect(response.ok()).toBeTruthy();
    const { id } = await response.json();
    try {
      const saved = await page.request.patch(`/api/chats/${id}/metadata`, {
        data: {
          enableAgents: true,
          activeAgentIds: ["hierarchical-maps"],
          ...(mode === "game"
            ? { gameId: `fixture-${id}`, gameSessionStatus: "active", gameIntroPresented: true }
            : {}),
        },
      });
      expect(saved.ok()).toBeTruthy();
      await page.request.post(`/api/chats/${id}/messages`, {
        data: { role: "assistant", content: "A map reference fixture." },
      });
      await seedUIState(
        page,
        {
          hasCompletedOnboarding: true,
          sidebarOpen: false,
          rightPanelOpen: false,
          appAccentPulseMode: false,
          chatHelpSeenModes: ["conversation", "roleplay", "game"],
        },
        "if-missing",
      );
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id, version },
      );
      const open = async () => {
        await openChatSettings(page);
        const toggle = drawerToggle(chatSettingsDrawer(page, "agents"));
        if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
      };
      await page.goto("/");
      await open();
      const hint = page.locator('[data-agent-lorebook-package-update="hierarchical-maps"]');
      const attachment = page.locator('[data-agent-lorebook-attachment="hierarchical-maps"]');
      await expect(hint).toBeVisible();
      await expect(attachment).toHaveCount(0);
      minor = 379;
      await page.reload();
      await open();
      await expect(hint).toHaveCount(0);
      await expect(attachment).toBeVisible();
      await expect(
        attachment.getByRole("checkbox", { name: "Attach lorebook for the specific agent" }),
      ).not.toBeChecked();
      await attachment.scrollIntoViewIfNeeded();
      const bounds = await attachment.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      await testInfo.attach(`maps-reference-${mode}`, {
        body: await page.screenshot({ path: testInfo.outputPath(`maps-reference-${mode}.png`) }),
        contentType: "image/png",
      });
    } finally {
      await page.request.delete(`/api/chats/${id}`, { params: { force: "1" } });
    }
  });
}
