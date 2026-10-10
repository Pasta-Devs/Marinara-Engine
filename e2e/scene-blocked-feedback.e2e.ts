import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

for (const width of [390, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`Scene-blocked feedback explains the restriction at ${width}px (${theme})`, async ({
      page,
      request,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      const character = await (await request.post("/api/characters", { data: { data: { name: "Alice" } } })).json();
      const connection = await (
        await request.post("/api/connections", {
          data: { name: "Scene feedback", provider: "custom", model: "fixture", baseUrl: "http://127.0.0.1:1/v1" },
        })
      ).json();
      const origin = await (
        await request.post("/api/chats", {
          data: {
            name: "Scene feedback",
            mode: "conversation",
            characterIds: [character.id],
            connectionId: connection.id,
          },
        })
      ).json();
      const created = await request.post("/api/scene/create", {
        data: {
          originChatId: origin.id,
          connectionId: connection.id,
          plan: {
            name: "Scene: Library",
            description: "A library.",
            scenario: "Find a book.",
            firstMessage: "Welcome.",
            background: null,
            characterIds: [character.id],
            systemPrompt: "Write a scene.",
            rating: "sfw",
            relationshipHistory: "Friends.",
            participationGuide: "Explore.",
          },
        },
      });
      expect(created.ok(), await created.text()).toBeTruthy();
      const sceneId = (await created.json()).chatId;
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
        await seedUIState(page, {
          hasCompletedOnboarding: true,
          chatHelpSeenModes: ["conversation", "roleplay"],
          sidebarOpen: false,
          rightPanelOpen: false,
          theme,
        });
        await page.addInitScript(
          ({ chatId, version }) => {
            localStorage.setItem("marinara-active-chat-id", chatId);
            localStorage.setItem("marinara:whats-new:seen-version", version);
          },
          { chatId: origin.id, version },
        );
        await page.goto("/");
        await page.getByRole("button", { name: "Chats", exact: true }).click();
        const closeChats = page.getByRole("button", { name: "Close chats", exact: true });
        if (await closeChats.isVisible()) await closeChats.click();
        const composer = page.locator("textarea[data-chat-composer]");
        await composer.fill("Can we discuss the scene?");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        const notice = page.locator("[data-sonner-toast]").filter({ hasText: "In an active Scene" });
        await expect(notice).toContainText("end or abandon it to resume replies");
        await expect(page.locator("[data-sonner-toast]").filter({ hasText: /offline/i })).toHaveCount(0);
        await notice.evaluate(async (element) => {
          await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {})));
        });
        await page.screenshot({ path: info.outputPath(`scene-feedback-${width}-${theme}.png`) });
        await request.post("/api/scene/abandon", { data: { sceneChatId: sceneId } });
        // Older servers and genuinely offline characters still use the reason-less event.
        await page.route("**/api/generate", (route) =>
          route.fulfill({
            contentType: "text/event-stream",
            body: 'data: {"type":"offline","characters":["Alice"]}\n\ndata: {"type":"done"}\n\n',
          }),
        );
        await composer.fill("Hello again");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Alice: Offline;" })).toBeVisible();
        expect(errors).toEqual([]);
      } finally {
        await request.delete(`/api/chats/${sceneId}`);
        await request.delete(`/api/chats/${origin.id}`);
        await request.delete(`/api/characters/${character.id}`);
        await request.delete(`/api/connections/${connection.id}`);
      }
    });
  }
}
