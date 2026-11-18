// #9468: a multi-pick preset variable shown as a list (displayMode "listbox", or 8+ options) was the app's last native
// <select multiple>. It now opens the shared multi-pick window, and the picks are listed under the field.
import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { openChatSettings } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

test("a multi-pick preset variable in list mode picks through the shared multi-pick window", async ({
  page,
  request,
}, testInfo) => {
  const preset = (await (await request.post("/api/prompts", { data: { name: "Multi-pick toppings" } })).json()) as {
    id: string;
  };
  const variable = await request.post(`/api/prompts/${preset.id}/variables`, {
    data: {
      variableName: "toppings",
      question: "Choose the toppings",
      multiSelect: true,
      displayMode: "listbox",
      options: [
        { id: "a", label: "Basil", value: "basil" },
        { id: "b", label: "Olives", value: "olives" },
        { id: "c", label: "Pineapple", value: "pineapple" },
      ],
    },
  });
  expect(variable.ok()).toBeTruthy();
  const chat = (await (
    await request.post("/api/chats", {
      data: { name: "Multi-pick toppings", mode: "roleplay", characterIds: [], promptPresetId: preset.id },
    })
  ).json()) as { id: string };
  try {
    await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
    await seedUIState(page, {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["roleplay", "conversation", "game"],
    });
    await page.addInitScript(
      ({ chatId, version }) => {
        localStorage.setItem("marinara-active-chat-id", chatId);
        localStorage.setItem("marinara:whats-new:seen-version", version);
      },
      { chatId: chat.id, version: APP_VERSION },
    );
    await page.goto("/");
    const settings = await openChatSettings(page);
    await settings.getByText("Prompt Preset", { exact: true }).click();
    await page.getByRole("button", { name: "Edit preset variables", exact: true }).click();
    const modal = page.getByRole("dialog").filter({ hasText: "Choose the toppings" }).last();
    await expect(page.locator("select[multiple]")).toHaveCount(0);
    const field = modal.getByRole("button", { name: "Choose the toppings", exact: true });
    await field.click();
    const picker = page.getByRole("dialog", { name: /^Choose the toppings/u }).last();
    // Picked out of order: the saved value still follows the list.
    for (const topping of ["Pineapple", "Olives", "Basil"]) {
      await picker.locator("[data-pick-row]").filter({ hasText: topping }).click();
    }
    await expect(picker.locator('[data-pick-row][aria-pressed="true"]')).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath("choice-multi-pick-open.png") });
    await page.keyboard.press("Escape");
    await expect(field).toBeFocused();
    // The picks sit under the field, each removable.
    await expect(modal.getByRole("button", { name: "Remove Basil", exact: true })).toBeVisible();
    await modal.getByRole("button", { name: "Remove Olives", exact: true }).click();
    await expect(modal.getByRole("button", { name: "Remove Olives", exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("choice-multi-pick-listed.png") });
    await modal.getByRole("button", { name: /Confirm/u }).click();
    await expect
      .poll(async () => {
        const stored = (await (await request.get(`/api/chats/${chat.id}`)).json()) as { metadata: unknown };
        const metadata = (typeof stored.metadata === "string" ? JSON.parse(stored.metadata) : stored.metadata) as {
          presetChoices?: Record<string, unknown>;
        };
        return metadata.presetChoices?.toppings;
      })
      .toEqual(["basil", "pineapple"]);
  } finally {
    await request.delete(`/api/chats/${chat.id}`);
    await request.delete(`/api/prompts/${preset.id}`);
  }
});
