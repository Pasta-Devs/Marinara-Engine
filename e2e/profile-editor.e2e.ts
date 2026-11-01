import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings } from "./chat-settings-tools.js";
import { clickTopbarPanel } from "./topbar-navigation.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;

test("profile editor keeps library navigation accessible and saves native selections", async ({
  page,
  request,
}, testInfo) => {
  const fixtureSuffix = `${testInfo.project.name}-${Date.now()}`;
  const profileName = `Sidebar proof profile ${fixtureSuffix}`;
  const personaName = `Profile editor persona ${fixtureSuffix}`;
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Profile editor proof", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const otherChatResponse = await request.post("/api/chats", {
    data: { name: "Profile switch target", mode: "roleplay", characterIds: [] },
  });
  expect(otherChatResponse.ok()).toBeTruthy();
  const otherChat = (await otherChatResponse.json()) as { id: string };
  const personaResponse = await request.post("/api/characters/personas", { data: { name: personaName } });
  expect(personaResponse.ok()).toBeTruthy();
  const persona = (await personaResponse.json()) as { id: string };
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["roleplay", "conversation", "game"],
    appAccentPulseMode: false,
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara-active-chat-id", id);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { id: chat.id, version },
  );
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) =>
    failedRequests.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto("/");
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible()) await skip.click();
    const settings = await openChatSettings(page);
    await settings.getByTitle("New profile from this chat's settings").click();
    const editor = page.getByRole("dialog", { name: "New settings profile", exact: true });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel("Persona", { exact: true }).locator("../..")).toHaveClass(/border-dashed/);
    await expect(editor).not.toHaveAttribute("aria-modal", "true");
    await expect(editor.getByText("Library", { exact: true })).toHaveCount(0);
    await editor.getByLabel("Persona", { exact: true }).selectOption(persona.id);
    await expect(editor.getByLabel("Lorebooks", { exact: true })).toHaveAttribute("multiple", "");
    const tools = editor.getByRole("group", { name: "Tools", exact: true });
    await tools.getByRole("checkbox", { name: "roll_dice", exact: true }).check();
    await tools.getByRole("checkbox", { name: "set_expression", exact: true }).check();
    await tools.getByRole("checkbox", { name: "roll_dice", exact: true }).uncheck();
    await expect(tools.getByRole("checkbox", { name: "set_expression", exact: true })).toBeChecked();
    // The same topbar action must remain clickable while the editor stays open.
    if (testInfo.project.name.includes("desktop")) {
      await clickTopbarPanel(page, "personas");
      await expect(editor).toBeVisible();
      const source = page.locator("[draggable=true]").filter({ hasText: personaName }).first();
      await expect(source).toBeVisible();
      // Clear first, then exercise the real sidebar drag path.
      await editor.getByLabel("Persona", { exact: true }).selectOption("");
      await source.dragTo(editor.getByLabel("Persona", { exact: true }), { timeout: 10_000 });
      await expect(editor.getByLabel("Persona", { exact: true })).toHaveValue(persona.id);
    }
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: testInfo.outputPath(`profile-editor-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }

    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await editor.getByLabel("Profile name", { exact: true }).fill(profileName);
    await editor.getByRole("button", { name: "Save and choose chats…", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /Sidebar proof profile/ })).toBeVisible();
    const profilesResponse = await request.get("/api/chat-presets?mode=roleplay");
    const profiles = (await profilesResponse.json()) as Array<{
      id: string;
      name: string;
      isDefault?: boolean;
      settings: { personaId?: string; metadata?: { activeToolIds?: string[] } };
    }>;
    const saved = profiles.find((profile) => profile.name === profileName);
    expect(saved?.settings.personaId).toBe(persona.id);
    expect(saved?.settings.metadata?.activeToolIds).toContain("set_expression");
    expect(saved?.settings.metadata?.activeToolIds).not.toContain("roll_dice");
    if (testInfo.project.name.includes("desktop")) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page
        .getByRole("dialog", { name: /Sidebar proof profile/ })
        .getByRole("button", { name: /^Close/ })
        .click();
      const reopenedSettings = await openChatSettings(page);
      if (!saved) throw new Error("Expected the saved profile");
      const defaultProfile = profiles.find((profile) => profile.isDefault);
      if (!defaultProfile) throw new Error("Expected the default profile");
      await reopenedSettings.getByLabel("Profile", { exact: true }).selectOption(saved.id);
      await expect(reopenedSettings.getByTitle("Edit this profile's slots")).toBeEnabled();
      await reopenedSettings.getByTitle("Edit this profile's slots").click();
      const editDialog = page.getByRole("dialog", { name: "Edit settings profile", exact: true });
      await editDialog.getByLabel("Profile name", { exact: true }).fill("Pinned draft");
      await reopenedSettings.getByLabel("Profile", { exact: true }).selectOption(defaultProfile.id);
      await expect(reopenedSettings.getByLabel("Profile", { exact: true })).toHaveValue(defaultProfile.id);
      await expect(editDialog.getByLabel("Profile name", { exact: true })).toHaveValue("Pinned draft");
      await editDialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await reopenedSettings.getByTitle("New profile from this chat's settings").click();
      await expect(editor).toBeVisible();
      await page.evaluate(async (id) => {
        const { useChatStore } = (await import("/src/stores/chat.store.ts" as string)) as {
          useChatStore: { getState: () => { setActiveChatId: (id: string) => void } };
        };
        useChatStore.getState().setActiveChatId(id);
      }, otherChat.id);
      await expect(editor).toBeHidden();
    }
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("browser diagnostics", {
      body: JSON.stringify({ errors, consoleErrors, failedRequests }),
      contentType: "application/json",
    });
    const list = await request.get("/api/chat-presets?mode=roleplay");
    if (list.ok()) {
      const profiles = (await list.json()) as Array<{ id: string; name: string }>;
      for (const profile of profiles.filter((profile) => profile.name === profileName)) {
        await request.delete(`/api/chat-presets/${profile.id}`);
      }
    }
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/chats/${otherChat.id}`);
    await request.delete(`/api/characters/personas/${persona.id}`);
  }
});
