import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openChatSettings } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

// Roleplay messages paint the chat persona's names in its name color (#8688, slice C).
const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const LOIS = { color: "#ef4444", rgb: "rgb(239, 68, 68)" };
const CLARK = { color: "#3b82f6", rgb: "rgb(59, 130, 246)" };

test("Roleplay messages color the persona's names, and the persona switch turns it off", async ({
  page,
  request,
}, testInfo) => {
  // The mobile projects share one server, so each project gets its own cards.
  const suffix = testInfo.project.name;
  const lois = `Lois ${suffix}`;
  const clark = `Clark ${suffix}`;
  const ids: { character?: string; persona?: string; chat?: string } = {};
  try {
    const character = await request.post("/api/characters", {
      data: { data: { name: lois, extensions: { nameColor: LOIS.color } } },
    });
    expect(character.ok(), await character.text()).toBeTruthy();
    ids.character = (await character.json()).id;
    const persona = await request.post("/api/characters/personas", {
      // The persona also lists the character's name: the character keeps its color.
      data: { name: clark, nameColor: CLARK.color, nameAliases: ["Kal-El", "Mr. Kent", lois] },
    });
    expect(persona.ok(), await persona.text()).toBeTruthy();
    ids.persona = (await persona.json()).id;
    const chat = await request.post("/api/chats", {
      data: { name: `Inline names ${suffix}`, mode: "roleplay", characterIds: [ids.character], personaId: ids.persona },
    });
    expect(chat.ok()).toBeTruthy();
    ids.chat = (await chat.json()).id;
    const meta = await request.patch(`/api/chats/${ids.chat}/metadata`, {
      data: { colorInlineNames: true, windowLayout: null, chatSettingsHintDismissed: true, enableAgents: false },
    });
    expect(meta.ok()).toBeTruthy();
    const posted = await request.post(`/api/chats/${ids.chat}/messages`, {
      data: {
        role: "assistant",
        characterId: ids.character,
        content: `${lois} looks up at ${clark}. Kal-El or Mr. Kent, she thinks, he is late again.`,
      },
    });
    expect(posted.ok()).toBeTruthy();

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatSettingsMoveTipDismissed: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      chatSettingsExpandedSections: { "roleplay-persona": true },
    });
    await page.addInitScript(
      ({ chatId, v }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", v);
      },
      { chatId: ids.chat!, v: version },
    );
    await page.goto("/");
    const message = page.locator("[data-message-id]").filter({ hasText: "he is late again" }).last();
    await expect(message).toBeVisible();
    const painted = (text: string) =>
      message.locator("span", { hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
    // The switch is unset, so it follows Color Character Names in Text (on).
    for (const name of [clark, "Kal-El", "Mr. Kent"]) {
      await expect(painted(name).first(), name).toHaveCSS("color", CLARK.rgb);
    }
    await expect(painted(lois).first()).toHaveCSS("color", LOIS.rgb);
    await message.screenshot({ path: testInfo.outputPath("persona-colored.png"), animations: "disabled" });

    const settings = await openChatSettings(page);
    const section = settings.locator('[data-chat-settings-section="roleplay-persona"]');
    const toggle = section.getByRole("checkbox", { name: "Color Persona Name in Text" });
    await expect(toggle).toBeChecked();
    await section.screenshot({ path: testInfo.outputPath("persona-section.png"), animations: "disabled" });
    await section.getByText("Color Persona Name in Text", { exact: true }).click();
    await expect(toggle).not.toBeChecked();
    await expect
      .poll(async () => {
        const current = await (await request.get(`/api/chats/${ids.chat}`)).json();
        const parsed = typeof current.metadata === "string" ? JSON.parse(current.metadata) : current.metadata;
        return parsed.colorPersonaInlineNames;
      })
      .toBe(false);
    await expect(painted("Kal-El")).toHaveCount(0);
    await expect(painted(lois).first()).toHaveCSS("color", LOIS.rgb);
  } finally {
    if (ids.chat) await request.delete(`/api/chats/${ids.chat}?force=true`).catch(() => undefined);
    if (ids.character) await request.delete(`/api/characters/${ids.character}`).catch(() => undefined);
    if (ids.persona) await request.delete(`/api/characters/personas/${ids.persona}`).catch(() => undefined);
  }
});
