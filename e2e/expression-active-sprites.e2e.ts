import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const record = (value: unknown): Record<string, any> => (typeof value === "string" ? JSON.parse(value) : (value ?? {}));

for (const presentation of ["classic", "visual-novel"] as const) {
  test(`Expression sprite filtering waits for completed results (${presentation})`, async ({
    page,
    request,
    baseURL,
  }, info) => {
    test.setTimeout(120_000);
    // Mobile projects share a server, and creating a built-in agent updates its global singleton.
    const agentLock = new URL(`../.tmp/playwright-data/expression-${new URL(baseURL!).port}.lock`, import.meta.url);
    await expect(() => mkdir(agentLock)).toPass({ timeout: 60_000 });
    const resources: string[] = [];
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const create = async (path: string, data: unknown) => {
      const response = await request.post(path, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const value = await response.json();
      resources.unshift(`${path}/${value.id}`);
      return value;
    };
    let releaseMain = () => {};
    let releaseExpressions = () => {};
    let mainReady = new Promise<void>((resolve) => {
      releaseMain = resolve;
    });
    let expressionsReady = new Promise<void>((resolve) => {
      releaseExpressions = resolve;
    });
    let mainStarted = false;
    let expressionsStarted = false;
    let expressionOutput: string = "{}";
    const provider = createServer(async (incoming, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      if (!incoming.url?.endsWith("/chat/completions")) {
        response.writeHead(404).end();
        return;
      }
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const isExpression = JSON.stringify(body.messages).includes("<available_sprites>");
      if (isExpression) {
        expressionsStarted = true;
        await expressionsReady;
      } else {
        mainStarted = true;
        await mainReady;
      }
      const content = isExpression ? expressionOutput : "Bob steps into the quiet laboratory.";
      if (body.stream) {
        response.writeHead(200, { "content-type": "text/event-stream", connection: "close" });
        response.end(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        );
      } else {
        response.writeHead(200, { "content-type": "application/json", connection: "close" });
        response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] }));
      }
    });
    try {
      await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
      const address = provider.address();
      if (!address || typeof address === "string") throw new Error("Fixture provider did not bind");
      const connection = await create("/api/connections", {
        name: "Expression visibility fixture",
        provider: "custom",
        model: "fixture",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        apiKey: "fixture",
        treatAsLocalEndpoint: true,
        maxContext: 32768,
      });
      const characters = [];
      const image = readFileSync(
        new URL("../packages/client/public/sprites/mari/Mari_wave.png", import.meta.url),
      ).toString("base64");
      for (const name of ["Alice", "Bob", "Charlie"]) {
        const character = await create("/api/characters", { data: { name, first_mes: "" } });
        characters.push(character);
        expect(
          (
            await request.post(`/api/sprites/${character.id}`, {
              data: { expression: "full_neutral", image: `data:image/png;base64,${image}` },
            })
          ).ok(),
        ).toBeTruthy();
      }
      const [alice, bob, charlie] = characters;
      expressionOutput = JSON.stringify({ expressions: [{ characterId: bob.id, expression: "full_neutral" }] });
      await create("/api/agents", {
        type: "expression",
        name: "Expression Engine",
        phase: "post_processing",
        connectionId: null,
        promptTemplate: "Return the expressions as JSON.",
        settings: { resultType: "sprite_change", enabledTools: [], runInterval: 1 },
      });
      const chat = await create("/api/chats", {
        name: "Active expression sprite proof",
        mode: "roleplay",
        connectionId: connection.id,
        characterIds: [bob.id, alice.id, charlie.id],
      });
      const otherChat = await create("/api/chats", {
        name: "Other expression scene",
        mode: "roleplay",
        connectionId: connection.id,
        characterIds: [],
      });
      await create(`/api/chats/${otherChat.id}/messages`, {
        role: "assistant",
        content: "Waiting in the other roleplay scene.",
      });
      expect(
        (
          await request.patch(`/api/chats/${chat.id}/metadata`, {
            data: {
              enableAgents: true,
              activeAgentIds: ["expression"],
              enableTools: false,
              spriteCharacterIds: characters.map((character) => character.id),
              spriteDisplayModes: ["full-body"],
              fullBodySpriteScale: 0.6,
              roleplayDisplayStyle: presentation,
              groupChatMode: "merged",
              spritePlacements: {
                [alice.id]: { x: 20, y: 85 },
                [bob.id]: { x: 50, y: 85 },
                [charlie.id]: { x: 80, y: 85 },
              },
            },
          })
        ).ok(),
      ).toBeTruthy();
      await create(`/api/chats/${chat.id}/messages`, {
        role: "assistant",
        content: "Alice and Charlie wait for the next scene.",
        extra: {
          spriteExpressions: { [alice.id]: "neutral", [charlie.id]: "neutral" },
          expressionSpriteIds: [alice.id, charlie.id],
        },
      });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay"],
        trackerPanelEnabled: false,
        appAccentPulseMode: false,
        streamingSpeed: 100,
        chatSettingsExpandedSections: { "roleplay-agents": true },
        theme: presentation === "classic" ? "dark" : "light",
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      const reload = async () => {
        // Finish the generation's background cache/status requests before unloading WebKit's document.
        await page.waitForLoadState("networkidle");
        await page.reload();
      };
      const sprites = page.getByRole("img", { name: /full.*sprite/i });
      const sprite = (id: string) => page.locator(`img[alt*="sprite"][src*="${id}"]`);
      await expect(sprites).toHaveCount(3);
      await page.screenshot({ path: info.outputPath("sprites-filter-off.png"), animations: "disabled" });
      const openSettings = async () => {
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setShouldOpenSettings(true);
        });
      };
      await openSettings();
      const drawer = page.locator(".mari-chat-settings-drawer");
      const toggle = drawer.getByRole("checkbox", { name: /^Only show active sprites/ });
      await expect(toggle).not.toBeChecked();
      const toggleLabel = drawer.getByText("Only show active sprites", { exact: true });
      await toggleLabel.scrollIntoViewIfNeeded();
      await toggleLabel.click();
      await expect(toggle).toBeChecked();
      await expect
        .poll(
          async () =>
            record((await (await request.get(`/api/chats/${chat.id}`)).json()).metadata).expressionOnlyActiveSprites,
        )
        .toBe(true);
      await page.screenshot({ path: info.outputPath("expression-toggle.png"), animations: "disabled" });
      await drawer.getByRole("button", { name: "Close Chat Settings" }).click();
      await expect(drawer).toHaveCount(0);
      await expect(sprites).toHaveCount(2);
      await expect(sprite(alice.id)).toBeVisible();
      await expect(sprite(charlie.id)).toBeVisible();
      await reload();
      await expect(sprites).toHaveCount(2);
      await page.locator("textarea[data-chat-composer]").fill("Continue the scene.");
      await page.locator("button.mari-chat-send-btn").click();
      await expect.poll(() => mainStarted).toBe(true);
      await expect(sprites).toHaveCount(2);
      await expect(sprite(alice.id)).toBeVisible();
      releaseMain();
      await expect.poll(() => expressionsStarted).toBe(true);
      await expect(sprites).toHaveCount(2);
      await expect(sprite(charlie.id)).toBeVisible();
      await expect(sprite(charlie.id).locator("..")).toHaveCSS("opacity", "1");
      await page.screenshot({ path: info.outputPath("sprites-expression-pending.png"), animations: "disabled" });
      releaseExpressions();
      const latest = async () =>
        (await (await request.get(`/api/chats/${chat.id}/messages`)).json())
          .filter((message: any) => message.role === "assistant")
          .at(-1);
      await expect.poll(async () => record((await latest()).extra).expressionSpriteIds).toEqual([bob.id]);
      await expect(sprites).toHaveCount(1);
      await expect(sprite(bob.id)).toBeVisible();
      await page.screenshot({ path: info.outputPath("sprites-expression-complete.png"), animations: "disabled" });
      await reload();
      await expect(sprites).toHaveCount(1);
      await expect(sprite(bob.id)).toBeVisible();

      // A regenerated swipe briefly has no expression result. It must keep Bob, not rewind to Alice/Charlie.
      mainStarted = false;
      expressionsStarted = false;
      mainReady = new Promise<void>((resolve) => {
        releaseMain = resolve;
      });
      expressionsReady = new Promise<void>((resolve) => {
        releaseExpressions = resolve;
      });
      if (presentation === "visual-novel") await page.getByRole("button", { name: "Show chat history" }).click();
      await page.getByRole("button", { name: "Regenerate", exact: true }).last().click();
      const confirm = page.getByRole("dialog").getByRole("button", { name: "Regenerate", exact: true });
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
      await expect.poll(() => mainStarted).toBe(true);
      await expect(sprites).toHaveCount(1);
      await expect(sprite(bob.id)).toBeVisible();
      releaseMain();
      await expect.poll(() => expressionsStarted).toBe(true);
      await expect(sprites).toHaveCount(1);
      await expect(sprite(bob.id)).toBeVisible();
      const switchChat = async (id: string) => {
        await page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setActiveChatId(id);
        }, id);
      };
      await switchChat(otherChat.id);
      await expect(page.getByText("Waiting in the other roleplay scene.", { exact: true })).toBeVisible();
      await switchChat(chat.id);
      await expect(sprites).toHaveCount(1);
      await expect(sprite(bob.id)).toBeVisible();
      releaseExpressions();
      await expect
        .poll(async () => ({
          swipe: (await latest()).activeSwipeIndex,
          ids: record((await latest()).extra).expressionSpriteIds,
        }))
        .toEqual({ swipe: 1, ids: [bob.id] });
      await expect
        .poll(() =>
          page.evaluate(async (chatId) => {
            const { useAgentStore } = await import("/src/stores/agent.store.ts" as string);
            return useAgentStore.getState().processingChatIds.includes(chatId);
          }, chat.id),
        )
        .toBe(false);
      const returnToVisualNovel = page.getByRole("button", { name: "Return to Visual Novel" });
      if (await returnToVisualNovel.isVisible()) await returnToVisualNovel.click();

      // A retry must persist its completed set too, including a valid empty result.
      const staleResult = await request.patch(`/api/chats/${chat.id}/messages/${(await latest()).id}/extra`, {
        data: { expressionSpriteIds: [alice.id] },
      });
      expect(staleResult.ok(), await staleResult.text()).toBeTruthy();
      expect(record((await latest()).extra).expressionSpriteIds).toEqual([alice.id]);
      const retry = await request.post("/api/generate/retry-agents", {
        data: { chatId: chat.id, agentTypes: ["expression"] },
      });
      expect(retry.ok(), await retry.text()).toBeTruthy();
      expect(await retry.text()).not.toContain('"type":"error"');
      expect(record((await latest()).extra).expressionSpriteIds).toEqual([bob.id]);
      await create(`/api/chats/${chat.id}/messages`, {
        role: "assistant",
        content: "The room is empty.",
        extra: { spriteExpressions: { [bob.id]: "neutral" }, expressionSpriteIds: [bob.id] },
      });
      await reload();
      await expect(sprites).toHaveCount(1);
      await expect(sprite(bob.id)).toBeVisible();
      expressionOutput = JSON.stringify({ expressions: [] });
      const empty = await request.post("/api/generate/retry-agents", {
        data: { chatId: chat.id, agentTypes: ["expression"] },
      });
      expect(empty.ok(), await empty.text()).toBeTruthy();
      expect(record((await latest()).extra).expressionSpriteIds).toEqual([]);
      expect(record((await latest()).extra).spriteExpressions).toEqual({ [bob.id]: "neutral" });
      await reload();
      await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
      await expect(sprites).toHaveCount(0);
      await openSettings();
      await expect(toggle).toBeChecked();
      await toggleLabel.scrollIntoViewIfNeeded();
      await toggleLabel.click();
      await drawer.getByRole("button", { name: "Close Chat Settings" }).click();
      await expect(sprites).toHaveCount(3);
      expect(errors).toEqual([]);
    } finally {
      releaseMain();
      releaseExpressions();
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
      try {
        for (const path of resources) {
          const response = await request.delete(path);
          expect(response.ok() || response.status() === 404, `Cleanup ${path}`).toBeTruthy();
        }
      } finally {
        await rm(agentLock, { recursive: true, force: true });
      }
    }
  });
}
