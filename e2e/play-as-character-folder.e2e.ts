// #7093: with "Show characters in Persona pickers" on, opening a folder under "Play as a character" let a
// cropped portrait escape its avatar slot and cover the whole picker. Both persona pickers are covered: the
// new-chat setup and Chat Settings.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openChatSettings } from "./chat-settings-tools.js";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const avatarPath = "/api/avatars/file/play-as-character-7093.png";
const longName = "Wandering cartographer of the very long and winding northern coastline";
// A large portrait with saved crops in the current and legacy formats, plus a character with no portrait.
const seededCharacters = [
  { name: "Cropped portrait", avatarPath, crop: { srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 1 / 3 } },
  { name: "Zoomed portrait", avatarPath, crop: { zoom: 2.5, offsetX: 10, offsetY: -5 } },
  { name: longName, avatarPath: null, crop: null },
];

type Seeded = { chatId: string; groupId: string; characterIds: string[]; folderName: string };

async function seed(page: Page, request: APIRequestContext): Promise<Seeded> {
  const folderName = `Play as folder 7093 ${test.info().project.name} ${test.info().title.slice(0, 8)}`;
  await page.route(`**${avatarPath}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#526679"/><circle cx="600" cy="500" r="300" fill="#e2b78b"/></svg>',
    }),
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  const characterIds: string[] = [];
  for (const character of seededCharacters) {
    const response = await request.post("/api/characters", {
      data: {
        ...(character.avatarPath ? { avatarPath: character.avatarPath } : {}),
        data: { name: character.name, ...(character.crop ? { extensions: { avatarCrop: character.crop } } : {}) },
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    characterIds.push(((await response.json()) as { id: string }).id);
  }
  const group = await request.post("/api/characters/groups", { data: { name: folderName, characterIds } });
  expect(group.ok(), await group.text()).toBeTruthy();
  const chat = await request.post("/api/chats", { data: { name: "Play as character 7093", mode: "roleplay" } });
  expect(chat.ok(), await chat.text()).toBeTruthy();
  const seeded = {
    chatId: ((await chat.json()) as { id: string }).id,
    groupId: ((await group.json()) as { id: string }).id,
    characterIds,
    folderName,
  };
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    chatWizardDefaults: {},
    showCharactersInPersonaPickers: true,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId: seeded.chatId, version },
  );
  return seeded;
}

async function cleanUp(request: APIRequestContext, seeded: Seeded | undefined) {
  if (!seeded) return;
  await request.delete(`/api/chats/${seeded.chatId}`);
  await request.delete(`/api/characters/groups/${seeded.groupId}`);
  for (const id of seeded.characterIds) await request.delete(`/api/characters/${id}`);
}

/** Opens Play as a character and the seeded folder, then returns the picker and its character rows. */
async function openFolder(scope: Locator, folderName: string) {
  const playAs = scope.getByRole("button", { name: "Play as a character" });
  // Both pickers put this toggle in their scrolling list, directly inside the picker frame.
  const list = playAs.locator("xpath=..");
  const picker = list.locator("xpath=..");
  await playAs.scrollIntoViewIfNeeded();
  await playAs.click();
  const folder = picker.getByRole("button", { name: new RegExp(folderName) });
  await folder.scrollIntoViewIfNeeded();
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "true");
  const rows = seededCharacters.map((character) => picker.getByRole("button", { name: character.name }));
  for (const row of rows) await expect(row).toBeVisible();
  return { picker, list, playAs, folder, rows };
}

/** Every portrait stays inside its round slot, so it cannot grow past its row. */
async function expectAvatarsInSlots(picker: Locator, count: number) {
  const pickerBox = (await picker.boundingBox())!;
  const portraits = picker.locator(`img[src$="${avatarPath}"]`);
  await expect(portraits).toHaveCount(count);
  for (const portrait of await portraits.all()) {
    await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);
    const box = (await portrait.boundingBox())!;
    expect(box.width, "portrait width").toBeLessThan(Math.min(120, pickerBox.width / 2));
    expect(box.height, "portrait height").toBeLessThan(120);
    const slot = await portrait.evaluate((img: HTMLImageElement) => {
      const parent = img.parentElement!;
      const bounds = parent.getBoundingClientRect();
      return {
        clips: getComputedStyle(parent).overflow === "hidden",
        // An absolutely placed crop must be placed against its own slot, or the slot cannot clip it.
        anchored: getComputedStyle(img).position !== "absolute" || img.offsetParent === parent,
        width: bounds.width,
        height: bounds.height,
      };
    });
    expect(slot, "portrait slot").toMatchObject({ clips: true, anchored: true });
    expect(slot.width).toBeLessThanOrEqual(40);
    expect(slot.height).toBeLessThanOrEqual(40);
  }
}

/** Each control is the topmost element at its centre, so a click reaches it. */
async function expectReachable(controls: Locator[]) {
  for (const control of controls) {
    await control.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        control.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
          return !!hit && element.contains(hit);
        }),
      )
      .toBe(true);
  }
}

/** Neither the page nor the picker list scrolls sideways, so long names truncate inside their rows. */
async function expectNoSidewaysScroll(page: Page, list: Locator) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(await list.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
}

test("new chat setup keeps Play as a character folders usable", async ({ page, request }, info) => {
  let seeded: Seeded | undefined;
  try {
    seeded = await seed(page, request);
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    await page.evaluate(async () => {
      const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
      useChatStore.getState().setShouldOpenWizard(true);
      useChatStore.getState().setShouldOpenSettings(true);
    });
    const wizard = page.locator('[data-component="ChatSetupWizard"]');
    const next = wizard.getByRole("button", { name: "Next", exact: true });
    await next.click();
    await expect(wizard.getByRole("heading", { name: "Pick a Preset", exact: true })).toBeVisible();
    // The default preset asks for its variables first; no preset keeps the walk to the persona step short.
    await wizard.getByRole("combobox", { name: "Preset", exact: true }).click();
    await wizard
      .getByRole("listbox", { name: "Preset", exact: true })
      .getByRole("option", { name: "None", exact: true })
      .click();
    await next.click();
    await expect(wizard.getByRole("heading", { name: "Persona & Characters", exact: true })).toBeVisible();

    const { picker, list, playAs, folder, rows } = await openFolder(wizard, seeded.folderName);
    await expectAvatarsInSlots(picker, 2);
    await expectReachable([picker.getByPlaceholder("Search personas", { exact: true }), playAs, folder, ...rows, next]);
    await expectNoSidewaysScroll(page, list);
    await page.screenshot({ path: info.outputPath("setup-folder-open.png"), animations: "disabled" });

    await rows[0]!.click();
    await expect(rows[0]!).toHaveAttribute("aria-pressed", "true");
    await folder.click();
    await expect(folder).toHaveAttribute("aria-expanded", "false");
    await expect(rows[0]!).toHaveCount(0);
  } finally {
    await cleanUp(request, seeded);
  }
});

test("Chat Settings keeps Play as a character folders usable", async ({ page, request }, info) => {
  let seeded: Seeded | undefined;
  try {
    seeded = await seed(page, request);
    await page.goto("/");
    await expect(page.locator("textarea[data-chat-composer]")).toBeVisible();
    const settings = await openChatSettings(page);
    const section = settings.locator('[data-chat-settings-section="roleplay-persona"]');
    await section.scrollIntoViewIfNeeded();
    const header = section.locator(":scope > .mari-drawer__header [data-drawer-toggle]");
    if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
    await section.getByRole("button", { name: /Choose\s+Persona/ }).click();

    const { picker, list, playAs, folder, rows } = await openFolder(section, seeded.folderName);
    await expectAvatarsInSlots(picker, 2);
    await expectReachable([
      picker.getByPlaceholder("Search personas", { exact: true }),
      picker.getByRole("button", { name: "Close picker" }),
      playAs,
      folder,
      ...rows,
    ]);
    await expectNoSidewaysScroll(page, list);
    await page.screenshot({ path: info.outputPath("settings-folder-open.png"), animations: "disabled" });

    // The chosen character then shows above the picker in the same small round slot.
    await rows[0]!.click();
    await expect(picker).toHaveCount(0);
    const change = section.getByRole("button", { name: /Change\s+Persona/ });
    await expect(change).toBeVisible();
    await expectAvatarsInSlots(section, 1);
    await expectReachable([change]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  } finally {
    await cleanUp(request, seeded);
  }
});
