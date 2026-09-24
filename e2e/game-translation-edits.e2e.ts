import { test, expect, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function openGame(page: Page, chatId: string) {
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
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
}

const gameMetadata = {
  gameSessionStatus: "active",
  gameIntroPresented: true,
  gameImageAutoGenerationEnabled: false,
  translationOutputTargetLang: "pl",
  translationDisplayOnly: true,
};

for (const automatic of [false, true]) {
  test(`Game ${automatic ? "automatic" : "manual"} translation keeps edited narration aligned`, async ({
    page,
    request,
  }) => {
    const chat = await (
      await request.post("/api/chats", { data: { name: "Edited translation", mode: "game", characterIds: [] } })
    ).json();
    try {
      const original = "The bridge is safe.\n\nA lamp burns.";
      const message = await (
        await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "assistant", content: original } })
      ).json();
      await request.patch(`/api/chats/${chat.id}/messages/${message.id}/extra`, {
        data: { translation: "An outdated translation.", translationSource: original },
      });
      const edited = 'The bridge creaks. "Wait," Alice said.\n \t\nStay here.';
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: {
          ...gameMetadata,
          gameId: chat.id,
          autoTranslate: automatic,
          [`segmentEdit:${message.id}:0`]: { content: edited },
        },
      });
      const requested: string[] = [];
      await page.route("**/api/translate", async (route) => {
        const { text } = route.request().postDataJSON();
        requested.push(text);
        await route.fulfill({ json: { translatedText: text.replace("creaks", "shivers").replace("burns", "glows") } });
      });
      await openGame(page, chat.id);
      const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
      if (!automatic) {
        await expect(panel).toContainText("The bridge creaks.");
        await panel.getByRole("button", { name: "Translate", exact: true }).click();
      }
      await expect.poll(() => requested.length).toBe(1);
      expect(requested[0]).toContain('The bridge creaks. "Wait," Alice said.\nStay here.');
      expect(requested[0]).not.toContain("The bridge is safe.");
      await expect(panel).toContainText('The bridge shivers. "Wait," Alice said.');
      await expect(panel).toContainText("Stay here.");
      await panel.getByRole("button", { name: "Next", exact: true }).click();
      await expect(panel).toContainText("A lamp glows.");
      await expect(panel).not.toContainText("Wait");
      await page.reload();
      await expect(panel).toContainText("A lamp glows.");
      await expect(panel).not.toContainText("A lamp burns.");
      expect(requested).toHaveLength(1);
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { [`segmentDelete:${message.id}:0`]: true },
      });
      await page.reload();
      if (!automatic) await panel.getByRole("button", { name: "Translate", exact: true }).click();
      await expect.poll(() => requested.length).toBe(2);
      expect(requested[1]).toBe("...\n\nA lamp burns.");
      await expect(panel).toContainText("A lamp glows.");
      await expect(panel).not.toContainText("Wait");
    } finally {
      await page.close();
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

test("Game edits discard a translation still in flight before saving its replacement", async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "The active segment editor is a desktop control.");
  const chat = await (
    await request.post("/api/chats", { data: { name: "Translation edit race", mode: "game", characterIds: [] } })
  ).json();
  let pending: Route | undefined;
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { ...gameMetadata, gameId: chat.id } });
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "The bridge is safe." },
      })
    ).json();
    const persisted: unknown[] = [];
    await page.route(`**/api/chats/${chat.id}/messages/${message.id}/extra`, async (route) => {
      persisted.push(route.request().postDataJSON());
      await route.continue();
    });
    const requested: string[] = [];
    await page.route("**/api/translate", async (route) => {
      const { text } = route.request().postDataJSON();
      requested.push(text);
      if (text === "Obsolete queued source.") {
        await route.fulfill({ json: { translatedText: "Obsolete queued translation." } });
      } else {
        pending = route;
      }
    });
    await openGame(page, chat.id);
    const panel = page.locator('[data-component="GameNarration.ActivePanel"]');
    await expect(panel).toContainText("The bridge is safe.");
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect.poll(() => !!pending).toBe(true);
    await prepareViteFixtureDependencies(page);
    await page.evaluate(
      async ({ messageId, chatId }) => {
        const { QueryClient } = await import(window.__viteFixtureDependencyUrl("@tanstack_react-query"));
        const { translateMessage } = await import("/src/hooks/use-translate.ts" as string);
        const { useTranslationStore } = await import("/src/stores/translation.store.ts" as string);
        void translateMessage(
          new QueryClient(),
          messageId,
          "Obsolete queued source.",
          useTranslationStore.getState().config,
          chatId,
        ).then(() => {
          document.documentElement.dataset.queuedTranslationFinished = "true";
        });
      },
      { messageId: message.id, chatId: chat.id },
    );
    await panel.getByRole("button", { name: "Edit", exact: true }).click();
    await panel.locator('textarea[rows="3"]').fill("The river is deep.");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(panel).toContainText("The river is deep.");
    await pending!.fulfill({ json: { translatedText: "Old bridge translation." } });
    pending = undefined;
    await expect(panel.getByRole("button", { name: "Translate", exact: true })).toBeEnabled();
    await expect(page.locator("html")).toHaveAttribute("data-queued-translation-finished", "true");
    expect(requested).toEqual(["The bridge is safe."]);
    expect(persisted).toEqual([]);
    await expect(panel).not.toContainText("Old bridge translation.");
    await panel.getByRole("button", { name: "Translate", exact: true }).click();
    await expect.poll(() => !!pending).toBe(true);
    expect(pending!.request().postDataJSON().text).toBe("The river is deep.");
    await pending!.fulfill({ json: { translatedText: "Rzeka jest głęboka." } });
    pending = undefined;
    await expect(panel).toContainText("Rzeka jest głęboka.");
    expect(persisted).toEqual([
      { translation: "Rzeka jest głęboka.", translationSource: "The river is deep.", translationHidden: false },
    ]);
  } finally {
    await pending?.abort().catch(() => undefined);
    await page.close();
    await request.delete(`/api/chats/${chat.id}?force=true`);
  }
});
