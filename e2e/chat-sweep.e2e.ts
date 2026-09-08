import { test, expect, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Game translation follows changed narration and remains manually accessible", async ({ page, request }) => {
  page.setDefaultTimeout(10_000);
  const chat = await (
    await request.post("/api/chats", { data: { name: "Translation sweep", mode: "game", characterIds: [] } })
  ).json();
  const chatIds: string[] = [chat.id];
  try {
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            gameId: chat.id,
            gameSessionStatus: "active",
            gameIntroPresented: true,
            gameImageAutoGenerationEnabled: false,
            translationOutputTargetLang: "pl",
          },
        })
      ).ok(),
    ).toBeTruthy();
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The bridge is safe." },
      })
    ).json();
    const requested: string[] = [];
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      expect(body.targetLanguage).toBe("pl");
      requested.push(body.text);
      await route.fulfill({
        json: {
          translatedText: body.text.includes("Note:")
            ? "[Note: Zapisana wiadomość.]"
            : body.text.includes("river")
              ? "Rzeka jest głęboka."
              : "Most jest bezpieczny.",
        },
      });
    });
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      chibiProfessorMariEnabled: false,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["game"],
      gameInstantTextReveal: true,
    });
    await page.addInitScript(
      ({ id, version }) => {
        localStorage.setItem("marinara-active-chat-id", id);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { id: chat.id, version },
    );
    await page.goto("/");
    const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(panel).toContainText("The bridge is safe.");
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(panel).toContainText("Most jest bezpieczny.");
    const extra = async () => {
      const messages = await (await request.get(`/api/chats/${chat.id}/messages`)).json();
      const row = messages.find((entry: { id: string }) => entry.id === message.id);
      return typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra;
    };
    await expect.poll(async () => (await extra()).translationSource).toBe("The bridge is safe.");
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/messages/${message.id}`, { data: { content: "The river is deep." } })
      ).ok(),
    ).toBeTruthy();
    expect(
      (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: true } })).ok(),
    ).toBeTruthy();
    await page.reload();
    await expect(panel).toContainText("The river is deep.");
    await expect(panel).toContainText("Rzeka jest głęboka.");
    await expect(panel).not.toContainText("Most jest bezpieczny.");
    await expect.poll(async () => (await extra()).translationSource).toBe("The river is deep.");
    expect(requested).toEqual(["The bridge is safe.", "The river is deep."]);
    await panel.getByRole("button", { name: "Hide translation", exact: true }).click();
    await expect(panel).not.toContainText("Rzeka jest głęboka.");
    await expect.poll(async () => (await extra()).translationHidden).toBe(true);
    await page.reload();
    await expect(panel).toContainText("The river is deep.");
    await expect(panel).not.toContainText("Rzeka jest głęboka.");
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(panel).toContainText("Rzeka jest głęboka.");
    expect(requested).toEqual(["The bridge is safe.", "The river is deep.", "The river is deep."]);

    const otherChat = await (
      await request.post("/api/chats", { data: { name: "Other translation chat", mode: "game", characterIds: [] } })
    ).json();
    chatIds.push(otherChat.id);
    await request.patch(`/api/chats/${otherChat.id}/metadata`, {
      data: {
        gameId: otherChat.id,
        gameSessionStatus: "active",
        gameIntroPresented: true,
        gameImageAutoGenerationEnabled: false,
      },
    });
    await request.post(`/api/chats/${otherChat.id}/messages`, {
      data: { role: "assistant", content: "A different story." },
    });
    let pendingTranslation: Route | undefined;
    await page.route(
      "**/api/translate",
      (route) => {
        pendingTranslation = route;
      },
      { times: 1 },
    );
    await panel.getByRole("button", { name: "Hide translation", exact: true }).click();
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect.poll(() => Boolean(pendingTranslation)).toBe(true);
    const switchChat = async (id: string) => {
      await page.evaluate(async (id) => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setActiveChatId(id);
      }, id);
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
            return useTranslationStore.getState().config.chatId;
          }),
        )
        .toBe(id);
    };
    await switchChat(otherChat.id);
    await expect(panel).toContainText("A different story.");
    await pendingTranslation!.fulfill({ json: { translatedText: "Opóźnione tłumaczenie." } });
    await expect.poll(async () => (await extra()).translation).toBe("Opóźnione tłumaczenie.");
    expect(
      await page.evaluate(async (id) => {
        const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
        const state = useTranslationStore.getState();
        return {
          translation: state.translations[id],
          source: state.translationSources[id],
          translating: state.translating[id],
        };
      }, message.id),
    ).toEqual({ translation: undefined, source: undefined, translating: undefined });
    await switchChat(chat.id);
    await expect(panel).toContainText("Opóźnione tłumaczenie.");
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { autoTranslate: false } });
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "[Note: A written message.]" },
    });
    await page.reload();
    await expect(panel).toContainText("You find a note...");
    await page.locator("div.fixed.inset-y-0").filter({ hasText: "A written message." }).getByRole("button").click();
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect(panel).toContainText("Zapisana wiadomość.");
  } finally {
    await Promise.all(chatIds.map((id) => request.delete(`/api/chats/${id}`)));
  }
});

test("Notification position is selectable, moves errors, and survives reload", async ({ page }) => {
  page.setDefaultTimeout(10_000);
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      chibiProfessorMariEnabled: false,
      sidebarOpen: false,
      rightPanelOpen: true,
      rightPanel: "settings",
      settingsTab: "general",
    },
    "if-missing",
  );
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  await page.goto("/");
  const selector = page.getByRole("combobox", { name: /Notification position/ });
  await page.getByPlaceholder("Search settings").fill("notification position");
  await page
    .locator(".mari-settings-search-header button")
    .filter({ hasText: "Notification position" })
    .first()
    .click();
  await expect(selector).toBeFocused();
  await expect(selector).toHaveValue("top");
  await selector.selectOption("bottom");
  const error = async () =>
    page.evaluate(async () => {
      const moduleUrl = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .find((url) => new URL(url).pathname.endsWith("/sonner.js"));
      if (!moduleUrl) throw new Error("The app's notification module was not loaded");
      const { toast } = await import(moduleUrl);
      toast.error("Notification position fixture", { duration: Infinity });
    });
  await error();
  await expect(page.locator('[data-sonner-toaster][data-y-position="bottom"]')).toContainText(
    "Notification position fixture",
  );
  await page.reload();
  await expect(selector).toHaveValue("bottom");
  await error();
  await expect(page.locator('[data-sonner-toaster][data-y-position="bottom"] [data-sonner-toast]')).toBeVisible();
  await selector.selectOption("top");
  await expect(page.locator('[data-sonner-toaster][data-y-position="top"] [data-sonner-toast]')).toBeVisible();
});
