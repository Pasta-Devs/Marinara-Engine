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
  const chatResponse = await request.post("/api/chats", {
    data: { name: "Profile editor proof", mode: "roleplay", characterIds: [] },
  });
  expect(chatResponse.ok()).toBeTruthy();
  const chat = (await chatResponse.json()) as { id: string };
  const personaResponse = await request.post("/api/characters/personas", { data: { name: "Profile editor persona" } });
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
      const source = page.locator("[draggable=true]").filter({ hasText: "Profile editor persona" }).first();
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
    await editor.getByLabel("Profile name", { exact: true }).fill("Sidebar proof profile");
    await editor.getByRole("button", { name: "Save and choose chats…", exact: true }).click();
    await expect(page.getByRole("dialog", { name: /Sidebar proof profile/ })).toBeVisible();
    const profilesResponse = await request.get("/api/chat-presets?mode=roleplay");
    const profiles = (await profilesResponse.json()) as Array<{
      id: string;
      name: string;
      settings: { personaId?: string; metadata?: { activeToolIds?: string[] } };
    }>;
    const saved = profiles.find((profile) => profile.name === "Sidebar proof profile");
    expect(saved?.settings.personaId).toBe(persona.id);
    expect(saved?.settings.metadata?.activeToolIds).toContain("set_expression");
    expect(saved?.settings.metadata?.activeToolIds).not.toContain("roll_dice");
    expect(errors).toEqual([]);
  } finally {
    await testInfo.attach("browser diagnostics", {
      body: JSON.stringify({ errors, consoleErrors, failedRequests }),
      contentType: "application/json",
    });
    const list = await request.get("/api/chat-presets?mode=roleplay");
    if (list.ok()) {
      const profiles = (await list.json()) as Array<{ id: string; name: string }>;
      for (const profile of profiles.filter((profile) => profile.name === "Sidebar proof profile")) {
        await request.delete(`/api/chat-presets/${profile.id}`);
      }
    }
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/characters/personas/${persona.id}`);
  }
});
