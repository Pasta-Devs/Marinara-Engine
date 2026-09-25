import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Experience startup waits for its persisted world before the first GM turn", async ({
  page,
  request,
}, testInfo) => {
  const chatIds: string[] = [];
  const createChat = async (name: string, experienceId: string | null) => {
    const chat = await (await request.post("/api/chats", { data: { name, mode: "game", characterIds: [] } })).json();
    chatIds.push(chat.id);
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            gameId: chat.id,
            gameSessionStatus: "ready",
            gameIntroPresented: false,
            gameExperienceId: experienceId,
            gameWorldOverview: "A new adventure.",
            enableAgents: false,
            gameImageAutoGenerationEnabled: false,
            gameBackgroundAutoGenerationEnabled: false,
          },
        })
      ).ok(),
    ).toBeTruthy();
    return chat;
  };
  try {
    const first = await createChat("Earlier experience", "startup-fixture");
    const second = await createChat("Prepared experience", "startup-fixture");
    const classic = await createChat("Classic game", null);
    const unflagged = await createChat("Unflagged experience", "legacy-startup-fixture");
    const packages = ["startup-fixture", "legacy-startup-fixture"].map((id) => ({
      id,
      version: "1.0.0",
      status: "active",
      readiness: "ready",
      installedAt: "2026-09-14T00:00:00Z",
      manifest: {
        schemaVersion: 2,
        id,
        name: "Startup fixture",
        version: "1.0.0",
        capabilityApi: { major: 1, minor: 17 },
        kind: ["agent"],
        entrypoints: { client: "client.mjs" },
        contributions: { slots: ["game-surface"], gameSurface: { prepareBeforeStart: id === "startup-fixture" } },
        permissions: ["ui", "chat-read", "chat-write"],
      },
    }));
    await page.route("**/api/capability-packages/installed", (route) => route.fulfill({ json: packages }));
    let failClientLoad = true;
    await page.route("**/api/capability-packages/*/client?*", (route) => {
      if (failClientLoad && route.request().url().includes("/startup-fixture/")) {
        failClientLoad = false;
        return route.fulfill({ status: 503, contentType: "text/javascript", body: "" });
      }
      return route.fulfill({
        contentType: "text/javascript",
        body: `
        const { api } = await import('/src/lib/api-client.ts');
        const fixtures = window.__startupFixture ??= { callbacks: new Map(), builds: new Map(), contexts: new Map() };
        for (const id of ['startup-fixture', 'legacy-startup-fixture']) {
          if (customElements.get('marinara-capability-' + id)) continue;
          customElements.define('marinara-capability-' + id, class extends HTMLElement {
            connectedCallback() {
              this.addEventListener('marinara-capability-props', () => this.render());
              this.render();
            }
            render() {
              const p = this.capabilityProps;
              if (!p?.chatId || p.layer === 'underlay') return;
              fixtures.callbacks.set(p.chatId, p.setStartupReady);
              const context = p.chatMeta.fixtureWorldContext ?? fixtures.contexts.get(p.chatId);
              if (typeof context === 'string') {
                p.setStartupReady?.(context);
                this.innerHTML = '<section aria-label="Prepared Experience world" style="background:var(--card);color:var(--card-foreground);padding:24px">Prepared world</section>';
                return;
              }
              p.setStartupReady?.(null);
              if (!fixtures.builds.has(p.chatId)) fixtures.builds.set(p.chatId, 1);
              this.innerHTML = '<section aria-label="Experience preparation" style="height:100%;display:grid;align-content:center;justify-items:center;gap:16px;background:var(--background);color:var(--foreground)"><p>Preparing the actual world</p><button type="button">Simulate preparation failure</button><button type="button">Finish preparation</button></section>';
              this.querySelector('button').onclick = () => {
                this.querySelector('p').textContent = 'Preparation failed';
                const retry = this.querySelector('button');
                retry.textContent = 'Retry preparation';
                retry.onclick = () => {
                  fixtures.builds.set(p.chatId, fixtures.builds.get(p.chatId) + 1);
                  this.render();
                };
              };
              this.querySelectorAll('button')[1].onclick = async () => {
                const prepared = 'Prepared world: Copper Harbor. Starting cast: Ada, the observatory keeper.';
                await api.patch('/chats/' + p.chatId + '/metadata', { fixtureWorldContext: prepared });
                fixtures.contexts.set(p.chatId, prepared);
                this.render();
              };
            }
          });
        }
      `,
      });
    });
    const generations: Record<string, unknown>[] = [];
    await page.route("**/api/generate", async (route) => {
      const body = route.request().postDataJSON();
      generations.push(body);
      const message = await (
        await request.post(`/api/chats/${body.chatId}/messages`, {
          data: { role: "assistant", content: "Copper Harbor welcomes you." },
        })
      ).json();
      await route.fulfill({
        contentType: "text/event-stream",
        body: `event: token\ndata: ${JSON.stringify(message.content)}\n\nevent: message_saved\ndata: ${JSON.stringify(message)}\n\nevent: done\ndata: {}\n\n`,
      });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
      theme: testInfo.project.name === "desktop-chromium" ? "light" : "dark",
    });
    await page.addInitScript(
      ({ id, version }) => {
        if (!localStorage.getItem("marinara-active-chat-id")) localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: first.id, version },
    );
    const switchChat = (chatId: string) =>
      page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setActiveChatId(id);
      }, chatId);
    await page.goto("/");
    const start = page.getByRole("button", { name: "Start Game", exact: true });
    const loadError = page.locator(
      '[data-capability-package-id="startup-fixture"][data-capability-client-state="error"]',
    );
    await expect(loadError).toBeVisible();
    await expect(start).toBeDisabled();
    await loadError.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("region", { name: "Experience preparation" })).toBeVisible();
    await expect(start).toBeDisabled();
    await switchChat(second.id);
    await expect.poll(() => page.evaluate((id) => window.__startupFixture?.callbacks.has(id), second.id)).toBe(true);
    await page.evaluate((id) => window.__startupFixture.callbacks.get(id)?.("Stale earlier world"), first.id);
    await expect(start).toBeDisabled();
    await page.evaluate((id) => window.__startupFixture.callbacks.get(id)?.("x".repeat(8_001)), second.id);
    await expect(page.getByRole("alert")).toContainText("at most 8000 characters");
    await expect(start).toBeDisabled();
    await page.evaluate((id) => window.__startupFixture.callbacks.get(id)?.(null), second.id);
    await page.getByRole("button", { name: "Simulate preparation failure", exact: true }).click();
    await expect(page.getByText("Preparation failed", { exact: true })).toBeVisible();
    await expect(start).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath("experience-preparation-retry.png") });
    await page.getByRole("button", { name: "Retry preparation", exact: true }).click();
    await page.getByRole("button", { name: "Finish preparation", exact: true }).click();
    await expect(start).toBeEnabled();
    await start.click();
    await expect.poll(() => generations.length).toBe(1);
    expect(generations[0]!.generationGuideSource).toBe("game_start");
    expect(generations[0]!.generationGuide).toContain("Prepared world: Copper Harbor");
    expect(generations[0]!.generationGuide).toContain("Ada, the observatory keeper");
    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    await expect(page.getByRole("region", { name: "Prepared Experience world" })).toBeVisible();
    expect(await page.evaluate((id) => window.__startupFixture.builds.get(id), second.id)).toBe(2);
    await expect
      .poll(async () => {
        const chat = await (await request.get(`/api/chats/${second.id}`)).json();
        const metadata = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
        return metadata.gameIntroPresented;
      })
      .toBe(true);
    await page.reload();
    await expect(page.getByRole("region", { name: "Prepared Experience world" })).toBeVisible();
    expect(await page.evaluate((id) => window.__startupFixture.builds.get(id) ?? 0, second.id)).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("experience-ready-world.png") });
    await switchChat(classic.id);
    await expect(start).toBeEnabled();
    await start.click();
    await expect.poll(() => generations.length).toBe(2);
    expect(generations[1]!.generationGuide).not.toContain("Prepared world:");
    await switchChat(unflagged.id);
    await expect(start).toBeEnabled();
    await expect(page.locator('marinara-capability-legacy-startup-fixture[view="surface"]')).toHaveCount(0);
  } finally {
    await page.close();
    for (const id of chatIds.reverse()) await request.delete(`/api/chats/${id}?force=true`).catch(() => undefined);
  }
});

declare global {
  interface Window {
    __startupFixture: {
      callbacks: Map<string, ((context: string | null) => void) | undefined>;
      builds: Map<string, number>;
      contexts: Map<string, string>;
    };
  }
}
