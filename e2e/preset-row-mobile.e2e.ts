// #8993: on a phone, a preset section's row shows its token count alone ("~200"), so the section's name keeps room;
// "tokens" stays for screen readers and in the count's title, and wider screens show "~200 tokens" as before.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test("a preset section row keeps room for its name on a phone", async ({ page, request }, testInfo) => {
  const suffix = Date.now().toString(36);
  const preset = (await (
    await request.post("/api/prompts", { data: { name: `Row ${suffix}`, description: "Row fixture." } })
  ).json()) as { id: string };
  const section = await request.post(`/api/prompts/${preset.id}/sections`, {
    data: {
      identifier: `row_${suffix}`,
      name: "Main Prompt: Narrative style",
      content: "x ".repeat(400),
      role: "system",
    },
  });
  expect(section.ok()).toBeTruthy();
  const chat = (await (
    await request.post("/api/chats", {
      data: { name: "Preset row", mode: "roleplay", characterIds: [], promptPresetId: preset.id },
    })
  ).json()) as { id: string };
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      theme: "dark",
      chatHelpSeenModes: ["roleplay", "conversation", "game"],
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { chatId: chat.id, version },
    );
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Chat Settings", exact: true }).first()).toBeAttached();
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const drawer = page.locator(".mari-chat-settings-drawer");
    await drawer.getByText("Prompt Preset", { exact: true }).click();
    await drawer.locator("[data-prompt-preset-quick-editor-disclosure] > button").click();
    const row = drawer.locator('[data-touch-reorder-item="preset-section"]').first();
    await expect(row).toBeVisible();
    const tokens = row.locator("[data-preset-section-tokens]");
    await expect(tokens).toHaveAttribute("title", "~200 tokens");
    await expect(tokens).toContainText("~200 tokens", { useInnerText: false });
    const full = tokens.getByText("~200 tokens", { exact: true });
    const short = tokens.getByText("~200", { exact: true });
    if (testInfo.project.name.includes("mobile")) {
      await expect(short).toBeVisible();
      // Still read by screen readers, but drawn nowhere.
      await expect.poll(async () => (await full.boundingBox())?.width ?? 0).toBeLessThanOrEqual(1);
      await row.screenshot({ path: testInfo.outputPath("row-phone.png") });
    } else {
      await expect(full).toBeVisible();
      await expect(short).toBeHidden();
    }
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/prompts/${preset.id}`);
  }
});
