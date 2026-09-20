import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
for (const mode of ["conversation", "roleplay", "game"] as const) {
  test(`${mode}: completion alerts wait for translation persistence and survive translation failure`, async ({
    page,
    request,
  }, info) => {
    const paths: string[] = [];
    const create = async (path: string, data: unknown) => {
      const response = await request.post(path, { data });
      expect(response.ok(), await response.text()).toBeTruthy();
      const value = await response.json();
      paths.unshift(`${path}/${value.id}`);
      return value;
    };
    let generation: ServerResponse | undefined;
    let translation: ServerResponse | undefined;
    let translationRequests = 0;
    const provider = createServer(async (req, res) => {
      if (req.method !== "POST") {
        req.resume();
        res.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.model === "translation-fixture") {
        translationRequests += 1;
        translation = res;
      } else generation = res;
    });
    await new Promise<void>((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const address = provider.address();
    if (!address || typeof address === "string") throw new Error("Fixture did not bind");
    const releaseGeneration = (content: string) => {
      generation!.writeHead(200, { "content-type": "text/event-stream" });
      generation!.end(
        `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
      );
    };
    const releaseTranslation = (content: string) => {
      translation!.writeHead(200, { "content-type": "application/json" });
      translation!.end(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }));
    };
    try {
      const character = await create("/api/characters", { data: { name: "Alice", first_mes: "" } });
      const connection = await create("/api/connections", {
        name: "Alert fixture",
        provider: "custom",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "fixture",
        apiKey: "fixture",
        treatAsLocalEndpoint: true,
      });
      const translator = await create("/api/connections", {
        name: "Translation alert fixture",
        provider: "custom",
        apiKey: "fixture",
        baseUrl: `http://127.0.0.1:${address.port}/v1`,
        model: "translation-fixture",
        treatAsLocalEndpoint: true,
      });
      const chat = await create("/api/chats", {
        name: "Alert fixture",
        mode,
        characterIds: [character.id],
        connectionId: connection.id,
      });
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          enableAgents: false,
          enableTools: false,
          autoTranslate: true,
          translationProvider: "ai",
          translationConnectionId: translator.id,
          translationOutputTargetLang: "pl",
          ...(mode === "game"
            ? {
                gameId: chat.id,
                gameSessionStatus: "active",
                gameIntroPresented: true,
                gameImageAutoGenerationEnabled: false,
              }
            : {}),
        },
      });
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay", "conversation", "game"],
        streamingSpeed: 100,
        gameInstantTextReveal: true,
        enterToSendRP: true,
        enterToSendConvo: true,
        generationBrowserNotifications: true,
        generationMobileNotifications: true,
        convoNotificationSound: true,
        rpNotificationSound: true,
        gameNotificationSound: true,
        notificationSoundsOnlyWhenUnfocused: false,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");
      const installSpies = () =>
        page.evaluate(async () => {
          const counts = { browser: 0, native: 0, sound: 0 };
          Object.assign(window, {
            __notificationCounts: counts,
            MarinaraAndroid: {
              getNotificationPermission: () => "granted",
              showNotification: () => {
                counts.native += 1;
              },
            },
          });
          Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
          Object.defineProperty(window, "Notification", {
            configurable: true,
            value: class {
              static permission = "granted";
              constructor() {
                counts.browser += 1;
              }
              close() {}
            },
          });
          Object.defineProperty(window, "AudioContext", {
            configurable: true,
            value: class {
              state = "running";
              currentTime = 0;
              destination = {};
              createGain() {
                return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
              }
              createOscillator() {
                return {
                  frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
                  connect(node: unknown) {
                    return node;
                  },
                  start() {
                    counts.sound += 0.5;
                  },
                  stop() {},
                };
              }
            },
          });
        });
      await installSpies();
      const counts = () =>
        page.evaluate(
          () =>
            (window as unknown as { __notificationCounts: { browser: number; native: number; sound: number } })
              .__notificationCounts,
        );
      const run = async (content: string) => {
        generation = undefined;
        translation = undefined;
        await page.evaluate(async (id) => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setActiveChatId(id);
        }, chat.id);
        const composer =
          mode === "game"
            ? page.getByRole("textbox", { name: "What do you do?", exact: true })
            : page.locator("textarea[data-chat-composer]");
        await composer.fill("Continue.");
        if (mode === "game") await page.getByRole("button", { name: "Send game turn", exact: true }).click();
        else await composer.press("Enter");
        await expect.poll(() => !!generation).toBe(true);
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setActiveChatId(null);
        });
        releaseGeneration(content);
      };
      await run("The archive is quiet.");
      await expect.poll(() => !!translation).toBe(true);
      expect(await counts()).toEqual({ browser: 0, native: 0, sound: 0 });
      releaseTranslation("W archiwum panuje cisza.");
      await expect.poll(counts).toEqual({ browser: 1, native: 1, sound: 1 });

      await run("The experiment continues.");
      await expect.poll(() => !!translation).toBe(true);
      expect(await counts()).toEqual({ browser: 1, native: 1, sound: 1 });
      releaseTranslation(""); // An empty provider response is a translation failure, not a failed chat turn.
      await expect.poll(counts).toEqual({ browser: 2, native: 2, sound: 2 });

      await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: false } });
      await page.reload();
      await installSpies();
      await run("Ready without translation.");
      await expect.poll(counts).toEqual({ browser: 1, native: 1, sound: 1 });
      expect(translationRequests).toBe(2);
      const messages = () => request.get(`/api/chats/${chat.id}/messages`).then((response) => response.json());
      const savedTranslation = async (content: string) => {
        const message = (await messages()).find((row: { content: string }) => row.content === content);
        return message ? JSON.parse(message.extra || "{}").translation : undefined;
      };
      expect(await savedTranslation("The archive is quiet.")).toBe("W archiwum panuje cisza.");
      expect(await savedTranslation("The experiment continues.")).toBeUndefined();
      await info.attach("completion-alert-counts", {
        body: JSON.stringify(await counts()),
        contentType: "application/json",
      });
      await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: true } });
      translation = undefined;
      await page.reload();
      if (mode === "game") {
        // Game Narration also backfills its visible untranslated row when auto-translation is enabled.
        await expect.poll(() => !!translation).toBe(true);
        releaseTranslation("Tłumaczenie wcześniejszej wiadomości.");
        await expect
          .poll(() => savedTranslation("Ready without translation."))
          .toBe("Tłumaczenie wcześniejszej wiadomości.");
      }
      generation = undefined;
      translation = undefined;
      const send = async (target: Page) => {
        const composer =
          mode === "game"
            ? target.getByRole("textbox", { name: "What do you do?", exact: true })
            : target.locator("textarea[data-chat-composer]");
        await composer.fill("Continue after the page closes.");
        if (mode === "game") await target.getByRole("button", { name: "Send game turn", exact: true }).click();
        else await composer.press("Enter");
      };
      await send(page);
      await expect.poll(() => !!generation).toBe(true);
      await page.close();
      releaseGeneration("The page can close safely.");
      await expect.poll(() => !!translation).toBe(true);
      releaseTranslation("Tłumaczenie zapisane bez otwartej strony.");
      await expect
        .poll(() => savedTranslation("The page can close safely."))
        .toBe("Tłumaczenie zapisane bez otwartej strony.")
        .catch(async (error) => {
          const rows = await messages();
          const row = rows.find((entry: { content: string }) => entry.content === "The page can close safely.");
          await info.attach("background-translation-state", {
            body: JSON.stringify({
              row,
              swipes: row && (await (await request.get(`/api/chats/${chat.id}/messages/${row.id}/swipes`)).json()),
            }),
            contentType: "application/json",
          });
          throw error;
        });
      expect(translationRequests).toBe(mode === "game" ? 4 : 3);
    } finally {
      if (!page.isClosed()) await page.unrouteAll({ behavior: "ignoreErrors" });
      provider.closeAllConnections();
      await new Promise<void>((resolve) => provider.close(() => resolve()));
      for (const path of paths) await request.delete(path).catch(() => {});
    }
  });
}
