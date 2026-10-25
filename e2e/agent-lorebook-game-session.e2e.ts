import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsDrawer, drawerToggle, openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const theme of ["dark", "light"] as const) {
  for (const session of ["reused", "carried"] as const) {
    test(`agent reference survives ${session} Game session (${theme})`, async ({ page }, testInfo) => {
      const chatIds: string[] = [];
      let bookId = "";
      let holdDetail = false;
      let releaseDetail!: () => void;
      const detailGate = new Promise<void>((resolve) => {
        releaseDetail = resolve;
      });
      await page.route(/\/api\/chats\/[^/?]+$/, async (route) => {
        if (holdDetail && route.request().method() === "GET") await detailGate;
        await route.continue();
      });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
      await page.route("**/api/capability-packages/agents", (route) =>
        route.fulfill({
          json: [
            {
              id: "hierarchical-maps",
              packageId: "hierarchical-maps",
              name: "World Maps",
              description: "Fixture",
              phase: "post_processing",
              category: "tracker",
              execution: "feature",
              modeAllowlist: ["roleplay", "game"],
              runtimeDisabled: true,
              enabledByDefault: false,
              defaultPromptTemplate: "Write clearly.",
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
                capabilityApi: { major: 1, minor: 380 },
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
      try {
        const bookResponse = await page.request.post("/api/lorebooks", { data: { name: "Game reference" } });
        expect(bookResponse.ok()).toBeTruthy();
        bookId = (await bookResponse.json()).id;
        const gameId = `reference-${session}-${theme}-${Date.now()}`;
        const presetsResponse = await page.request.get("/api/prompts");
        expect(presetsResponse.ok()).toBeTruthy();
        const promptPresetId = (await presetsResponse.json())[0].id;
        const created = await page.request.post("/api/chats", {
          data: { name: "Reference — Session 1", mode: "game", characterIds: [], groupId: gameId, promptPresetId },
        });
        expect(created.ok()).toBeTruthy();
        const chatId = (await created.json()).id;
        chatIds.push(chatId);
        const configured = await page.request.patch(`/api/chats/${chatId}/metadata`, {
          data: {
            gameId,
            gameSessionStatus: "concluded",
            gameSessionNumber: 1,
            gameIntroPresented: true,
            enableAgents: true,
            activeAgentIds: ["hierarchical-maps"],
            agentLorebookAttachments: { "hierarchical-maps": { enabled: true, lorebookId: bookId } },
          },
        });
        expect(configured.ok()).toBeTruthy();
        await page.request.post(`/api/chats/${chatId}/messages`, {
          data: { role: "assistant", content: "The lantern rests beside the gate." },
        });
        // Another window may already have started the session while this window still
        // shows its concluded snapshot. Exercise the real idempotent reuse response.
        await page.route("**/api/game/session/start", async (route) => {
          if (session === "reused") {
            const changed = await page.request.patch(`/api/chats/${chatId}/metadata`, {
              data: { gameSessionStatus: "active" },
            });
            expect(changed.ok()).toBeTruthy();
          }
          const response = await route.fetch();
          const body = await response.json();
          expect(response.ok()).toBeTruthy();
          expect(typeof body.sessionChat.metadata).toBe("string");
          expect(JSON.parse(body.sessionChat.metadata).agentLorebookAttachments["hierarchical-maps"]).toEqual({
            enabled: true,
            lorebookId: bookId,
          });
          if (body.sessionChat.id !== chatId) chatIds.push(body.sessionChat.id);
          holdDetail = true;
          await route.fulfill({ response });
        });
        await seedUIState(
          page,
          {
            hasCompletedOnboarding: true,
            rightPanelOpen: false,
            sidebarOpen: false,
            appAccentPulseMode: false,
            theme,
            gameInstantTextReveal: true,
            chatHelpSeenModes: ["conversation", "roleplay", "game"],
          },
          "if-missing",
        );
        await page.addInitScript(
          ({ id, version }) => {
            localStorage.setItem("marinara-active-chat-id", id);
            localStorage.setItem("marinara:whats-new:seen-version", version);
          },
          { id: chatId, version },
        );
        await page.goto("/", { waitUntil: "domcontentloaded" });
        const started = page.waitForResponse(
          (response) => response.url().endsWith("/api/game/session/start") && response.request().method() === "POST",
        );
        await page.getByRole("button", { name: "New Session", exact: true }).click();
        const body = await (await started).json();
        expect(body.sessionChat.id === chatId).toBe(session === "reused");
        await openChatSettings(page);
        const drawer = drawerToggle(chatSettingsDrawer(page, "agents"));
        if ((await drawer.getAttribute("aria-expanded")) !== "true") await drawer.click();
        const attachment = page.locator('[data-agent-lorebook-attachment="hierarchical-maps"]').first();
        await expect(attachment).toBeVisible();
        expect(
          await page.evaluate(async (id) => {
            const { queryClient } = await import("/src/lib/query-client.ts" as string);
            const cached = queryClient.getQueryData(["chats", "detail", id]) as { metadata: unknown } | undefined;
            return typeof cached?.metadata;
          }, body.sessionChat.id),
        ).toBe("string");
        await attachment.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath("game-session-reference.png") });
        const toggle = attachment.getByRole("checkbox", { name: "Attach lorebook for the specific agent" });
        await expect(toggle).toBeChecked();
        await expect(attachment.getByRole("combobox", { name: "Reference lorebook" })).toHaveValue(bookId);
        const saved = page.waitForRequest(
          (request) =>
            request.method() === "PATCH" &&
            request.url().endsWith(`/api/chats/${body.sessionChat.id}/metadata`) &&
            Object.hasOwn(request.postDataJSON(), "agentLorebookAttachments"),
        );
        await attachment.getByText("Attach lorebook for the specific agent", { exact: true }).click();
        expect((await saved).postDataJSON().agentLorebookAttachments).toEqual({
          "hierarchical-maps": { enabled: false },
        });
        await expect
          .poll(
            async () =>
              (await (await page.request.get(`/api/chats/${body.sessionChat.id}`)).json()).metadata
                .agentLorebookAttachments["hierarchical-maps"],
          )
          .toEqual({ enabled: false, lorebookId: bookId });
      } finally {
        holdDetail = false;
        releaseDetail();
        for (const id of chatIds) await page.request.delete(`/api/chats/${id}`).catch(() => undefined);
        if (bookId) await page.request.delete(`/api/lorebooks/${bookId}`).catch(() => undefined);
      }
    });
  }
}
