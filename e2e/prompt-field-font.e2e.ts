import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const APP_FONT = "Prompt Font Fixture";

const fontOf = (field: Locator) => field.evaluate((node) => getComputedStyle(node).fontFamily);
const expectMonospace = (field: Locator) => expect.poll(() => fontOf(field)).toMatch(/^ui-monospace,/u);
// The app stack keeps its "Straight Quotes" face first, so ASCII quotes stay straight in prompt fields too.
const expectAppFont = (field: Locator) =>
  expect.poll(() => fontOf(field)).toMatch(/^["']?Straight Quotes["']?, ["']?Prompt Font Fixture["']?,/u);
const openExpanded = async (page: Page, field: Locator) => {
  // A DOM click: after scrolling, mobile WebKit reports the character editor's metadata section over the button.
  const expand = field.locator("xpath=..").getByRole("button", { name: "Expand editor" });
  await expand.evaluate((button: HTMLButtonElement) => button.click());
  return page.locator('[data-component="ExpandedMacroEditor"]');
};

async function openDetail(page: Page, kind: "preset" | "character", id: string) {
  await page.evaluate(
    async ({ kind, id }) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      if (kind === "preset") useUIStore.getState().openPresetDetail(id);
      else useUIStore.getState().openCharacterDetail(id);
    },
    { kind, id },
  );
  const editor = page.locator(".mari-editor-shell");
  await expect(editor.locator(".mari-editor-title-input")).toBeVisible();
  return editor;
}

// #7438: preset prompts and Example Dialogue stayed monospace after the user picked an app font.
test("prompt fields stay monospace by default and follow the app font once one is set", async ({ page, request }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: false, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), APP_VERSION);
  const preset = (await (await request.post("/api/prompts", { data: { name: "Prompt font fixture" } })).json()) as {
    id: string;
  };
  const sectionName = "Prompt font section";
  const sectionResponse = await request.post(`/api/prompts/${preset.id}/sections`, {
    data: { identifier: "prompt_font_section", name: sectionName, content: "Hello.", role: "system" },
  });
  expect(sectionResponse.ok(), await sectionResponse.text()).toBeTruthy();
  const characterResponse = await request.post("/api/characters", {
    data: { data: { name: "Prompt Font Character", mes_example: "<START>\n{{char}}: Hi." } },
  });
  expect(characterResponse.ok(), await characterResponse.text()).toBeTruthy();
  const character = (await characterResponse.json()) as { id: string };
  try {
    await page.goto("/");
    const presetEditor = await openDetail(page, "preset", preset.id);
    await presetEditor.locator('[data-editor-section="sections"]').getByText(sectionName, { exact: true }).click();
    const sectionContent = presetEditor.getByPlaceholder("Prompt content… (supports", { exact: false });
    const presetFields = [
      sectionContent,
      presetEditor.getByPlaceholder("Leave empty to use Marinara's built-in conversation prompt."),
      presetEditor.getByPlaceholder("Leave empty to use Marinara's built-in game prompt."),
    ];
    for (const field of presetFields) await expectMonospace(field);

    await page.evaluate(async (family) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setFontFamily(family);
    }, APP_FONT);
    for (const field of presetFields) await expectAppFont(field);
    const expanded = await openExpanded(page, sectionContent);
    await expectAppFont(expanded.locator("textarea"));
    await expanded.getByRole("button", { name: "Close Edit: Prompt font section", exact: true }).click();

    const characterEditor = await openDetail(page, "character", character.id);
    await expectAppFont(characterEditor.getByPlaceholder("〈START〉 {{user}}: Hello!", { exact: false }));
    // A field that was never monospace inline keeps its monospace Expand window, as before #7438.
    const firstMessage = characterEditor.getByPlaceholder(
      "What is the character's first message when a new chat starts?",
    );
    const firstMessageExpanded = await openExpanded(page, firstMessage);
    await expectMonospace(firstMessageExpanded.locator("textarea"));
    await firstMessageExpanded.getByRole("button", { name: "Close First Message", exact: true }).click();
  } finally {
    await request.delete(`/api/characters/${character.id}`);
    await request.delete(`/api/prompts/${preset.id}`);
  }
});
