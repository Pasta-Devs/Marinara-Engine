import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import { chooseOption } from "./select-field.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const NOTE = "PRIVATE_NOTE_FOR_THE_NARRATOR: the door is trapped.";

async function promptFor(request: APIRequestContext, chatId: string, forCharacterId: string) {
  const response = await request.post("/api/generate/dryRun", {
    data: { chatId, returnPrompt: true, forCharacterId },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return JSON.stringify((await response.json()).prompt.messages);
}

test("a message's private note can be shown to one chosen Roleplay character", async ({ page, request }, testInfo) => {
  const connection = await (
    await request.post("/api/connections", {
      data: { name: "Note fixture", provider: "custom", baseUrl: "http://127.0.0.1:9/v1", apiKey: "f", model: "f" },
    })
  ).json();
  const narrator = await (await request.post("/api/characters", { data: { data: { name: "Mira Narrator" } } })).json();
  const bard = await (await request.post("/api/characters", { data: { data: { name: "Tam Bard" } } })).json();
  const chat = await (
    await request.post("/api/chats", {
      data: {
        name: "Private note fixture",
        mode: "roleplay",
        characterIds: [narrator.id, bard.id],
        connectionId: connection.id,
      },
    })
  ).json();
  try {
    await request.patch(`/api/chats/${chat.id}/metadata`, {
      data: { groupChatMode: "individual", roleplayCommandNarratorId: narrator.id },
    });
    const message = await (
      await request.post(`/api/chats/${chat.id}/messages`, { data: { role: "user", content: "I open the door." } })
    ).json();
    const savedExtra = async () => {
      const rows = (await (await request.get(`/api/chats/${chat.id}/messages`)).json()) as any;
      const row = (Array.isArray(rows) ? rows : rows.messages).find((item: any) => item.id === message.id);
      return typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra;
    };

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    });
    await page.addInitScript(
      ({ chatId, appVersion }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", appVersion);
      },
      { chatId: chat.id, appVersion: version },
    );
    await page.goto("/");
    const messageRow = page.locator(`[data-message-id="${message.id}"]`);
    await expect(messageRow).toContainText("I open the door.");
    await messageRow.focus();
    await messageRow.getByRole("button", { name: "Bookmark, pin or note" }).click();
    const menu = page.getByRole("dialog", { name: "Bookmark, pin or note" });
    const noteBox = menu.getByRole("textbox", { name: "Private note" });
    await expect(noteBox).toHaveAttribute("placeholder", "Only you can see this. It is never sent to the model.");
    await noteBox.fill(NOTE);
    await menu.getByRole("button", { name: "Save note" }).click();
    await expect.poll(async () => (await savedExtra()).privateNote).toBe(NOTE);
    expect(await promptFor(request, chat.id, narrator.id)).not.toContain(NOTE);

    const share = menu.getByRole("switch", { name: /^Show the note to the narrator character/ });
    // The switch's native input is visually hidden; people toggle it through its label.
    const shareLabel = menu.getByText("Show the note to the narrator character", { exact: true });
    await shareLabel.click();
    await expect(share).toBeChecked();
    const recipient = menu.getByRole("combobox", { name: "Narrator character" });
    await expect(recipient).toHaveAttribute("data-value", narrator.id);
    await expect(noteBox).toHaveAttribute("placeholder", "Only you and the selected character can see this.");
    await expect.poll(async () => (await savedExtra()).privateNoteRecipientId).toBe(narrator.id);
    await menu.screenshot({ path: testInfo.outputPath("note-shared.png") });
    await testInfo.attach("note-shared", { path: testInfo.outputPath("note-shared.png"), contentType: "image/png" });
    expect(await promptFor(request, chat.id, narrator.id)).toContain(NOTE);
    expect(await promptFor(request, chat.id, bard.id)).not.toContain(NOTE);

    await chooseOption(page, recipient, "Tam Bard");
    await expect.poll(async () => (await savedExtra()).privateNoteRecipientId).toBe(bard.id);
    expect(await promptFor(request, chat.id, bard.id)).toContain(NOTE);
    expect(await promptFor(request, chat.id, narrator.id)).not.toContain(NOTE);

    await shareLabel.click();
    await expect(share).not.toBeChecked();
    await expect(recipient).toHaveCount(0);
    await expect.poll(async () => (await savedExtra()).privateNoteRecipientId ?? null).toBeNull();
    expect(await promptFor(request, chat.id, bard.id)).not.toContain(NOTE);

    // One request writes for every character in a merged group, so a note cannot stay private there:
    // a note shared before the switch is withheld, and sharing can be turned off but not on.
    await shareLabel.click();
    await expect.poll(async () => (await savedExtra()).privateNoteRecipientId).toBe(narrator.id);
    await request.patch(`/api/chats/${chat.id}/metadata`, { data: { groupChatMode: "merged" } });
    const merged = await request.post("/api/generate/dryRun", { data: { chatId: chat.id, returnPrompt: true } });
    expect(merged.ok(), await merged.text()).toBeTruthy();
    expect(JSON.stringify((await merged.json()).prompt.messages)).not.toContain(NOTE);
    await page.reload();
    await expect(messageRow).toContainText("I open the door.");
    await messageRow.focus();
    await messageRow.getByRole("button", { name: "Bookmark, pin or note" }).click();
    await expect(menu).toContainText("Needs a one-character chat, or a group chat with individual replies.");
    await expect(share).toBeChecked();
    await expect(share).toBeEnabled();
    await shareLabel.click();
    await expect(share).not.toBeChecked();
    await expect(share).toBeDisabled();
    await expect.poll(async () => (await savedExtra()).privateNoteRecipientId ?? null).toBeNull();
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/${narrator.id}`);
    await request.delete(`/api/characters/${bard.id}`);
    await request.delete(`/api/connections/${connection.id}`);
  }
});
