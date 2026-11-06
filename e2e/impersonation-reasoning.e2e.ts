import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

// An impersonated turn streams in a character's box, where its reasoning shows, and is then saved as the persona's
// message. It keeps that reasoning visible there, as a reply does: the thoughts button by default, or the collapsed
// inline disclosure with Show Thinking In Messages on (#8682).
for (const inline of [false, true]) {
  test(`an impersonated turn keeps its reasoning visible after generation${inline ? " inline" : ""}`, async ({
    page,
    request,
    isMobile,
  }) => {
    const created: string[] = [];
    try {
      const characterResponse = await request.post("/api/characters", { data: { data: { name: "Alice" } } });
      expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
      const character = (await characterResponse.json()) as { id: string };
      created.push(`/api/characters/${character.id}`);
      const chatResponse = await request.post("/api/chats", {
        data: {
          name: "Impersonation reasoning",
          mode: "roleplay",
          characterIds: [character.id],
          connectionId: "impersonation-reasoning-connection",
        },
      });
      expect(chatResponse.ok(), await chatResponse.text()).toBeTruthy();
      const chat = (await chatResponse.json()) as { id: string };
      created.unshift(`/api/chats/${chat.id}`);
      const reply = await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", characterId: character.id, content: "Alice opens the door." },
      });
      expect(reply.ok(), await reply.text()).toBeTruthy();

      const content = "I wave at Alice from the doorway.";
      const reasoning = "The persona would greet Alice warmly.";
      let impersonated = false;
      await page.route("**/api/generate", async (route) => {
        impersonated = route.request().postDataJSON().impersonate === true;
        // The server saves an impersonated turn as the persona's message, with the reasoning it was written with.
        const saved = await request.post(`/api/chats/${chat.id}/messages`, {
          data: { role: "user", content, extra: { thinking: reasoning } },
        });
        expect(saved.ok(), await saved.text()).toBeTruthy();
        await route.fulfill({
          contentType: "text/event-stream",
          body: [
            { type: "thinking", data: reasoning },
            { type: "token", data: content },
            { type: "message_saved", data: await saved.json() },
            { type: "done", data: {} },
          ]
            .map((event) => `data: ${JSON.stringify(event)}\n\n`)
            .join(""),
        });
      });
      await isolateSyncedUISettings(page);
      await seedUIState(page, {
        hasCompletedOnboarding: true,
        sidebarOpen: false,
        rightPanelOpen: false,
        chatHelpSeenModes: ["roleplay"],
        showRoleplayThinkingInMessages: inline,
      });
      await page.addInitScript(
        ({ id, version }) => {
          localStorage.setItem("marinara-active-chat-id", id);
          localStorage.setItem("marinara:whats-new:seen-version", version);
        },
        { id: chat.id, version },
      );
      await page.goto("/");

      await page.locator("textarea.mari-chat-input-textarea").fill("/impersonate wave at Alice");
      await page.locator("button.mari-chat-send-btn").click();
      const row = page.locator('[data-message-role="user"]').filter({ hasText: content });
      await expect(row).toBeVisible();
      await expect(page.locator('[data-message-id="__streaming__"]')).toHaveCount(0);
      expect(impersonated).toBe(true);

      if (inline) {
        const disclosure = row.locator("[data-message-thinking-inline]");
        const toggle = disclosure.getByRole("button", { name: /^Thought/u });
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(disclosure).not.toContainText(reasoning);
        await toggle.click();
        await expect(disclosure).toContainText(reasoning);
      } else {
        await expect(row.locator("[data-message-thinking-inline]")).toHaveCount(0);
        if (isMobile) await row.getByText(content, { exact: true }).click();
        else await row.hover();
        const thoughts = isMobile
          ? row.getByRole("button", { name: "View model thoughts" })
          : row.locator('button[title="View model thoughts"]');
        await expect(thoughts).toBeVisible();
        await thoughts.click();
        await expect(page.getByRole("dialog", { name: "Model Thoughts" })).toContainText(reasoning);
      }
    } finally {
      for (const path of created) await request.delete(path).catch(() => undefined);
    }
  });
}
