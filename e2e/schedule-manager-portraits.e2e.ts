// The Character Schedule Manager shows each character's saved portrait crop in a small round slot, so a large
// cropped portrait can neither lose its framing nor grow over the window's controls.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { CONVERSATION_SCHEDULE_DAYS, type WeekSchedule } from "@marinara-engine/shared";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
const avatarPath = "/api/avatars/file/schedule-manager-portrait.png";
const schedule: WeekSchedule = {
  weekStart: "2026-01-05T00:00:00.000Z",
  talkativeness: 50,
  inactivityThresholdMinutes: 60,
  days: Object.fromEntries(
    CONVERSATION_SCHEDULE_DAYS.map((day) => [day, [{ time: "00:00-00:00", activity: "Mapping", status: "online" }]]),
  ),
};
// A large portrait with saved crops in the current and legacy formats.
const seededCharacters = [
  { suffix: "cropped", crop: { srcX: 0.25, srcY: 0.1, srcWidth: 0.5, srcHeight: 1 / 3 }, schedule },
  { suffix: "zoomed", crop: { zoom: 2.5, offsetX: 10, offsetY: -5 }, schedule: undefined },
];

async function seed(page: Page, request: APIRequestContext, prefix: string) {
  await page.route(`**${avatarPath}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800"><rect width="1200" height="1800" fill="#526679"/><circle cx="600" cy="500" r="300" fill="#e2b78b"/></svg>',
    }),
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
  const ids: string[] = [];
  for (const character of seededCharacters) {
    const response = await request.post("/api/characters", {
      data: {
        avatarPath,
        data: {
          name: `${prefix} ${character.suffix}`,
          extensions: { avatarCrop: character.crop, ...(character.schedule ? { conversationSchedule: schedule } : {}) },
        },
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    ids.push(((await response.json()) as { id: string }).id);
  }
  await seedUIState(page, { hasCompletedOnboarding: true, sidebarOpen: true, rightPanelOpen: false });
  await page.addInitScript((version) => localStorage.setItem("marinara:whats-new:seen-version", version), version);
  return ids;
}

/** Where a portrait sits in its slot, in slot sizes. */
function placement(portrait: Locator) {
  return portrait.evaluate((img: HTMLImageElement) => {
    const slot = img.parentElement!.getBoundingClientRect();
    const bounds = img.getBoundingClientRect();
    return {
      width: bounds.width / slot.width,
      left: (bounds.left - slot.left) / slot.width,
      top: (bounds.top - slot.top) / slot.height,
    };
  });
}

/** The current crop shows the middle half of the portrait's width from 10% down; the legacy one zooms 2.5x and shifts. */
function expectCroppedPlacement(placed: { width: number; left: number; top: number }) {
  expect(placed.width).toBeCloseTo(2, 1);
  expect(placed.left).toBeCloseTo(-0.5, 1);
  expect(placed.top).toBeCloseTo(-0.3, 1);
}
function expectZoomedPlacement(placed: { width: number; left: number; top: number }) {
  // scale(2.5) about the centre after translate(10%, -5%): 2.5 wide, starting half a slot left and 0.875 up.
  expect(placed.width).toBeCloseTo(2.5, 1);
  expect(placed.left).toBeCloseTo(-0.5, 1);
  expect(placed.top).toBeCloseTo(-0.875, 1);
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

test("Character Schedule Manager keeps cropped portraits in their slots", async ({ page, request }, info) => {
  const prefix = `Schedule portrait ${info.project.name} ${Date.now().toString(36)}`;
  let ids: string[] = [];
  try {
    ids = await seed(page, request, prefix);
    await page.goto("/");
    await page.getByRole("button", { name: "Character Schedule Manager", exact: true }).click();
    const manager = page.getByRole("dialog", { name: "Character Schedule Manager", exact: true });
    const search = manager.getByPlaceholder("Search characters", { exact: true });
    await search.fill(prefix);
    const [cropped, zoomed] = seededCharacters.map((character) => `${prefix} ${character.suffix}`);

    const portraits = manager.locator(`img[src$="${avatarPath}"]`);
    await expect(portraits).toHaveCount(2);
    for (const portrait of await portraits.all()) {
      await expect.poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1200);
      const box = (await portrait.boundingBox())!;
      expect(box.width, "portrait width").toBeLessThan(120);
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

    // The saved crops are used: the current crop shows the middle half of the portrait, the legacy one zooms in.
    const croppedRow = manager.getByRole("button", { name: `Edit ${cropped} schedule`, exact: true }).locator("..");
    expectCroppedPlacement(await placement(croppedRow.locator("img")));
    const zoomedRow = manager.getByRole("button", { name: `Edit ${zoomed} schedule`, exact: true }).locator("..");
    expectZoomedPlacement(await placement(zoomedRow.locator("img")));

    const list = manager.getByRole("heading", { name: /^Characters with schedules/ }).locator("xpath=../..");
    await expectReachable([
      search,
      manager.getByRole("button", { name: "Close Character Schedule Manager", exact: true }),
      manager.getByRole("button", { name: "Select visible", exact: true }),
      manager.getByRole("button", { name: "Clear selection", exact: true }),
      manager.getByRole("button", { name: "Generate schedules", exact: true }),
      manager.getByRole("button", { name: "Remove schedules", exact: true }),
      croppedRow.getByRole("checkbox", { name: "Renew weekly", exact: true }),
      ...[cropped, zoomed].flatMap((name) => [
        manager.getByRole("button", { name: `Select ${name}`, exact: true }),
        manager.getByRole("button", { name: `Edit ${name} schedule`, exact: true }),
      ]),
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    expect(await list.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: info.outputPath("schedule-manager-portraits.png"), animations: "disabled" });

    await manager.getByRole("button", { name: `Select ${cropped}`, exact: true }).click();
    await expect(manager.getByText("1 selected", { exact: true })).toBeVisible();
    await manager.getByRole("button", { name: `Select ${zoomed}`, exact: true }).click();
    await expect(manager.getByText("2 selected", { exact: true })).toBeVisible();

    // The schedule editor opened from the window shows the same crop, in both formats.
    await manager.getByRole("button", { name: `Edit ${cropped} schedule`, exact: true }).click();
    const editor = page.getByRole("dialog", { name: `Edit ${cropped} Schedule`, exact: true });
    expectCroppedPlacement(await placement(editor.locator(`img[src$="${avatarPath}"]`)));
    await editor.getByRole("button", { name: `Close Edit ${cropped} Schedule`, exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(manager).toBeVisible();
    await manager.getByRole("button", { name: `Edit ${zoomed} schedule`, exact: true }).click();
    const zoomedEditor = page.getByRole("dialog", { name: `Edit ${zoomed} Schedule`, exact: true });
    expectZoomedPlacement(await placement(zoomedEditor.locator(`img[src$="${avatarPath}"]`)));
  } finally {
    for (const id of ids) await request.delete(`/api/characters/${id}`);
  }
});
