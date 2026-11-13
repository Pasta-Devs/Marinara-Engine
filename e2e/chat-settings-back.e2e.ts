// Back from a full-page surface opened in Chat Settings reopens Chat Settings (#8973): the drawer closes first, so the
// store remembers it. The desktop shell unmounts the chat under the surface; phones keep it mounted.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openChatSettings, chatSettingsWindow } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test("Back from a character opened in Chat Settings reopens Chat Settings; the ✕ goes to the chat", async ({
  page,
  request,
}, testInfo) => {
  const name = `Settings back ${testInfo.project.name}`;
  const character = await (
    await request.post("/api/characters", { data: { data: { name } }, failOnStatusCode: true })
  ).json();
  const chat = await (
    await request.post("/api/chats", {
      data: { name: `Settings back chat ${testInfo.project.name}`, mode: "roleplay", characterIds: [character.id] },
      failOnStatusCode: true,
    })
  ).json();
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara:whats-new:seen-version", version);
        localStorage.setItem("marinara-active-chat-id", chatId);
      },
      { chatId: chat.id, version: APP_VERSION },
    );
    await page.goto("/");
    const settings = chatSettingsWindow(page);
    const openCharacter = async () => {
      const row = settings.locator("button", { hasText: name }).first();
      if (!(await row.isVisible())) await settings.getByRole("button", { name: "Characters", exact: true }).click();
      await row.click();
    };
    const open = async () => {
      await openChatSettings(page);
      await openCharacter();
      await expect(settings).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Back to chat settings" })).toBeVisible();
    };

    await open();
    await page.getByRole("button", { name: "Back to chat settings" }).click();
    await expect(settings).toBeVisible();

    // The ✕ leaves every surface and does not reopen the drawer.
    await openCharacter();
    await page.getByRole("button", { name: "Close to the chat" }).click();
    await expect(page.locator("[data-chat-settings-button]")).toBeVisible();
    await expect(settings).toHaveCount(0);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/${character.id}`);
  }
});
