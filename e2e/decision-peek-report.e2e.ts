import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("Peek Prompt lists decision statements the per-turn limit drops apart from unanswered ones", async ({
  page,
  request,
}, testInfo) => {
  const ids: { character?: string; chat?: string; chatConnection?: string; preset?: string } = {};
  // No global setting is changed, so projects sharing a server cannot disturb each other:
  // 33 statements go one past the default Decision statements per turn (32), and Peek
  // Prompt never asks, so the first 32 are unanswered and the last is dropped.
  const statements = [
    "Mira draws a sword in the latest message",
    ...Array.from({ length: 31 }, (_, index) => `Filler statement ${index + 1} holds`),
    "Mira is soaked by rain in the latest message",
  ];
  try {
    const character = await request.post("/api/characters", { data: { data: { name: "Mira" } } });
    expect(character.ok(), await character.text()).toBeTruthy();
    ids.character = ((await character.json()) as { id: string }).id;
    // Peek Prompt never calls it; it only needs a connection to build the whole prompt.
    const chatConnection = await request.post("/api/connections", {
      data: { name: "Peek chat fixture", provider: "custom", baseUrl: "http://127.0.0.1:9/v1", model: "fixture" },
    });
    expect(chatConnection.ok(), await chatConnection.text()).toBeTruthy();
    ids.chatConnection = ((await chatConnection.json()) as { id: string }).id;
    // A preset section holds the statements; a disabled one is never counted.
    const preset = await request.post("/api/prompts", { data: { name: "Peek decisions", wrapFormat: "none" } });
    expect(preset.ok(), await preset.text()).toBeTruthy();
    ids.preset = ((await preset.json()) as { id: string }).id;
    for (const [order, data] of [
      {
        identifier: "scene",
        name: "Scene",
        role: "system",
        content: statements.map((statement) => `{{#if decision:"${statement}"}}Yes.{{/if}}`).join(" "),
      },
      {
        identifier: "off",
        name: "Disabled",
        role: "system",
        enabled: false,
        content: '{{#if decision:"A disabled section asks this"}}Never.{{/if}}',
      },
      { identifier: "history", name: "History", isMarker: true, markerConfig: { type: "chat_history" } },
    ].entries())
      expect(
        (await request.post(`/api/prompts/${ids.preset}/sections`, { data: { ...data, order } })).ok(),
      ).toBeTruthy();
    const chat = await request.post("/api/chats", {
      data: {
        name: "Peek decision report",
        mode: "roleplay",
        characterIds: [ids.character],
        connectionId: ids.chatConnection,
        promptPresetId: ids.preset,
      },
    });
    expect(chat.ok(), await chat.text()).toBeTruthy();
    ids.chat = ((await chat.json()) as { id: string }).id;
    await request.post(`/api/chats/${ids.chat}/messages`, { data: { role: "user", content: "Mira looks up." } });

    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false, theme: "dark" });
    await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
    await page.addInitScript((chatId) => localStorage.setItem("marinara-active-chat-id", chatId), ids.chat);
    await page.goto("/");
    // `{{prompt}}` previews the next turn's prompt without sending anything.
    await page.locator("textarea.mari-chat-input-textarea").fill("{{prompt}}");
    await page.locator("button.mari-chat-send-btn").click();

    // The unanswered notice reads differently with and without a Decision model, so it
    // is found by the statement it lists.
    const unanswered = page.getByRole("status").filter({ hasText: "Mira draws a sword in the latest message" });
    const dropped = page.getByRole("status").filter({ hasText: "past the per-turn limit, read as no: 1" });
    await expect(unanswered).toContainText(": 32.");
    await expect(dropped).toContainText("Mira is soaked by rain in the latest message");
    await expect(unanswered).not.toContainText("soaked by rain");
    await expect(page.getByText("A disabled section asks this")).toHaveCount(0);
    const path = testInfo.outputPath("peek-decision-report.png");
    await page.screenshot({ path, animations: "disabled" });
    await testInfo.attach("peek-decision-report", { path, contentType: "image/png" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally {
    if (ids.chat) await request.delete(`/api/chats/${ids.chat}`);
    if (ids.character) await request.delete(`/api/characters/${ids.character}`);
    if (ids.chatConnection) await request.delete(`/api/connections/${ids.chatConnection}`);
    if (ids.preset) await request.delete(`/api/prompts/${ids.preset}`);
  }
});
