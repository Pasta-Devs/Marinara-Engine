// A Chat Settings section popped out into its own window must always have a way back. Phones and tablets in the new
// layout have no windows, bubbles or tools menu for those sections, so a section popped out there (or on a computer
// for the same chat) used to vanish from the sheet and from Edit, with nothing to bring it back: a playtester lost
// Advanced Parameters that way. Edit also lost its "Drag a row…" banner, whose Reset left popped-out sections alone.
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";
import { chatSettingsWindow } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const ADVANCED = "drawer:chat-settings:advanced-parameters";

async function createChat(request: APIRequestContext, name: string) {
  const character = await request.post("/api/characters", { data: { data: { name: "Popout Ari", first_mes: "" } } });
  expect(character.ok()).toBeTruthy();
  const { id: characterId } = (await character.json()) as { id: string };
  const chat = await request.post("/api/chats", { data: { name, mode: "roleplay", characterIds: [characterId] } });
  expect(chat.ok()).toBeTruthy();
  return ((await chat.json()) as { id: string }).id;
}

/** Saves the chat's window layout with Advanced Parameters popped out, as a computer or an older build left it. */
async function popOutAdvancedParameters(request: APIRequestContext, chatId: string) {
  const windowLayout = {
    version: 1,
    windows: { [ADVANCED]: { x: 24, y: 60, width: 320, height: 360, pinned: false, locked: false, minimized: true } },
    detached: [ADVANCED],
  };
  expect((await request.patch(`/api/chats/${chatId}/metadata`, { data: { windowLayout } })).ok()).toBeTruthy();
}

async function openChat(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", id);
    },
    { id: chatId, version: APP_VERSION },
  );
  await page.goto("/");
  const skipTour = page.getByRole("button", { name: "Skip Tutorial" });
  await page.addLocatorHandler(skipTour, () => skipTour.click());
  await page.locator('[data-window-opener="chat-settings"]').first().click();
  const settings = chatSettingsWindow(page);
  await expect(settings.locator(".ov-edbtn")).toBeVisible();
  return settings;
}

async function detachedIds(page: Page) {
  return page.evaluate(async () => {
    const module = (await import("/src/stores/floating-window.store.ts" as string)) as {
      useFloatingWindowStore: { getState(): { detached: Record<string, true> } };
    };
    return Object.keys(module.useFloatingWindowStore.getState().detached);
  });
}

async function resetView(page: Page) {
  await chatSettingsWindow(page).locator('[data-chat-settings-control="reset-view"]').click();
  const dialog = page.getByRole("dialog", { name: "Are you sure you want to reset the view?" });
  await dialog.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("Chat Settings popped-out sections on a computer", () => {
  // A window as big as the screen reads as fullscreen (F11), where the top bar slides over the docked pane.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window.screen, "height", { get: () => 4000 }));
  });

  test("Edit lists a popped-out section, puts it back, and Reset View brings back hidden and popped-out sections", async ({
    page,
    request,
  }, info) => {
    test.skip(info.project.name !== "desktop-chromium", "Sections pop out into windows on a computer");
    const chatId = await createChat(request, "Popped-out sections desktop");
    const settings = await openChat(page, chatId);
    await settings.locator(".ov-edbtn").click();
    // The banner and its Reset are gone; Reset View sits in the title bar, docked or floating.
    await expect(settings.locator(".ov-cs-edit__hint")).toHaveCount(0);
    await expect(settings.getByText("Drag a row to reorder it.")).toHaveCount(0);
    await expect(settings.locator('[data-chat-settings-control="reset-view"]')).toBeVisible();

    const row = settings.locator(".ov-cs-edit__row", { hasText: "Advanced Parameters" });
    await row.getByRole("button", { name: "Open Advanced Parameters in its own window" }).click();
    await expect.poll(() => detachedIds(page)).toEqual([ADVANCED]);
    // Still in the list, marked, with Put back.
    await expect(row).toContainText("In its own window");
    await row.getByRole("button", { name: "Put Advanced Parameters back in Chat Settings" }).click();
    await expect.poll(() => detachedIds(page)).toEqual([]);
    await expect(row).not.toContainText("In its own window");

    // Pop it out again and hide another section: Reset View undoes both.
    await row.getByRole("button", { name: "Open Advanced Parameters in its own window" }).click();
    await expect.poll(() => detachedIds(page)).toEqual([ADVANCED]);
    const persona = settings.locator(".ov-cs-edit__row", { hasText: "Persona" }).first();
    await persona.getByRole("button", { name: "Hide Persona" }).click();
    await expect(persona).toHaveClass(/is-hidden/);
    await resetView(page);
    await expect.poll(() => detachedIds(page)).toEqual([]);
    await expect(persona).not.toHaveClass(/is-hidden/);
    await expect(row).not.toContainText("In its own window");

    // A popped-out section stays popped out after a reload (it saves with the chat).
    await row.getByRole("button", { name: "Open Advanced Parameters in its own window" }).click();
    await expect.poll(() => detachedIds(page)).toEqual([ADVANCED]);
    await expect
      .poll(async () => {
        const stored = (await (await request.get(`/api/chats/${chatId}`)).json()) as { metadata: unknown };
        const metadata = (typeof stored.metadata === "string" ? JSON.parse(stored.metadata) : stored.metadata) as {
          windowLayout?: { detached?: string[] };
        };
        return metadata.windowLayout?.detached ?? [];
      })
      .toEqual([ADVANCED]);
    await page.reload();
    await expect.poll(() => detachedIds(page)).toEqual([ADVANCED]);
  });
});

test.describe("Chat Settings popped-out sections on a phone", () => {
  test("phones show a popped-out section in place and offer no pop-out", async ({ page, request }, info) => {
    test.skip(info.project.name === "desktop-chromium", "The new layout's phone sheet");
    const chatId = await createChat(request, `Popped-out sections ${info.project.name}`);
    await popOutAdvancedParameters(request, chatId);
    const settings = await openChat(page, chatId);
    // The saved layout is kept for the computer, but the phone shows the section as one of its rows.
    expect(await detachedIds(page)).toEqual([ADVANCED]);
    await expect(settings.locator('[data-drawer="advanced-parameters"]')).toHaveCount(1);
    await expect(page.locator(`.mari-window[data-window="${ADVANCED}"]`)).toHaveCount(0);

    await settings.locator(".ov-edbtn").click();
    await expect(settings.locator(".ov-cs-edit__hint")).toHaveCount(0);
    await expect(settings.locator(".ov-cs-edit__row", { hasText: "Advanced Parameters" })).toHaveCount(1);
    await expect(settings.locator(".ov-cs-edit__pop")).toHaveCount(0);
    // Reset View shows in Edit and clears the saved pop-out too.
    await resetView(page);
    await expect.poll(() => detachedIds(page)).toEqual([]);
  });
});
