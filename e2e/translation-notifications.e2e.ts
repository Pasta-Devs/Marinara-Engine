import { expect, test, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
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
    let generation: Route | undefined;
    let translation: Route | undefined;
    let persistence: Route | undefined;
    let translationRequests = 0;
    try {
      const character = await create("/api/characters", { data: { name: "Alice", first_mes: "" } });
      const connection = await create("/api/connections", {
        name: "Alert fixture",
        provider: "custom",
        baseUrl: "http://127.0.0.1:9/v1",
        model: "fixture",
        apiKey: "fixture",
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
          translationProvider: "google",
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
      await page.route("**/api/generate", (route) => {
        generation = route;
      });
      await page.route("**/api/translate", (route) => {
        translationRequests += 1;
        translation = route;
      });
      await page.route(`**/api/chats/${chat.id}/messages/*/extra`, (route) => {
        persistence = route;
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
        persistence = undefined;
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
        const response = await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "assistant", characterId: character.id, content },
        });
        const message = await response.json();
        await generation!.fulfill({
          contentType: "text/event-stream",
          body: [
            { type: "token", data: content },
            { type: "message_saved", data: message },
            { type: "done", data: {} },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
        });
      };
      await run("The archive is quiet.");
      await expect.poll(() => !!translation).toBe(true);
      expect(await counts()).toEqual({ browser: 0, native: 0, sound: 0 });
      await translation!.fulfill({ json: { translatedText: "W archiwum panuje cisza." } });
      await expect.poll(() => !!persistence).toBe(true);
      expect(await counts()).toEqual({ browser: 0, native: 0, sound: 0 });
      await persistence!.continue();
      await expect.poll(counts).toEqual({ browser: 1, native: 1, sound: 1 });

      await run("The experiment continues.");
      await expect.poll(() => !!translation).toBe(true);
      expect(await counts()).toEqual({ browser: 1, native: 1, sound: 1 });
      await translation!.fulfill({ status: 500, json: { error: "Synthetic translation failure" } });
      await expect.poll(counts).toEqual({ browser: 2, native: 2, sound: 2 });

      await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: false } });
      await page.reload();
      await installSpies();
      await run("Ready without translation.");
      await expect.poll(counts).toEqual({ browser: 1, native: 1, sound: 1 });
      expect(translationRequests).toBe(2);
      await info.attach("completion-alert-counts", {
        body: JSON.stringify(await counts()),
        contentType: "application/json",
      });
    } finally {
      await page.unrouteAll({ behavior: "ignoreErrors" });
      for (const path of paths) await request.delete(path).catch(() => {});
    }
  });
}
