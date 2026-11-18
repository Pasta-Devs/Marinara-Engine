// #9468: the shared picker popover closes once its field scrolls out of view (it used to follow the field over the
// Chat Settings header), hugs its rows instead of always standing 352 px wide, and lets a row's hint wrap to two
// lines (the library sort's "Manual order" tip was cut off).
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { mockUILanguagePacks } from "./ui-language-fixtures.js";
import { openChatSettings } from "./chat-settings-tools.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

async function prepare(page: Page, chatId: string | null = null) {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    rightPanelOpen: false,
    sidebarOpen: false,
    appAccentPulseMode: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      if (chatId) localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version: APP_VERSION },
  );
  await page.route("**/api/capability-packages/catalog", (route) =>
    route.fulfill({ json: { schemaVersion: 1, generatedAt: "2026-10-21T00:00:00.000Z", packages: [] } }),
  );
}

test("picker/popover closes once its field scrolls out of Chat Settings", async ({ page, request }, testInfo) => {
  test.skip(
    testInfo.project.name.startsWith("mobile"),
    "Chat Settings is a window on desktop; the phone sheet is another layout.",
  );
  const created = await request.post("/api/chats", {
    data: { name: "Picker scroll-away", mode: "conversation", characterIds: [] },
  });
  expect(created.ok()).toBeTruthy();
  const chat = (await created.json()) as { id: string };
  await prepare(page, chat.id);
  await page.goto("/");
  const settings = await openChatSettings(page);
  // A field in the settings' scroll area (the title strip above it never scrolls).
  const scrollArea = settings.locator(".overflow-y-auto.overscroll-contain").first();
  const trigger = scrollArea.locator('[role="combobox"], [aria-haspopup="dialog"]').filter({ visible: true }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  // Whichever picker it opened: the only open picker window.
  const picker = page.locator('[role="dialog"][aria-modal="true"][data-chat-floating-panel]');
  await expect(picker).toBeVisible();
  // The field's own scroll box, scrolled until the field has left it.
  await trigger.evaluate((field) => {
    for (let el = field.parentElement; el; el = el.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(el).overflowY)) {
        // A fresh chat's settings may fit without scrolling; a busy chat's don't.
        const spacer = document.createElement("div");
        spacer.style.height = "2000px";
        el.append(spacer);
        el.scrollTop += field.getBoundingClientRect().bottom - el.getBoundingClientRect().top + 40;
        return;
      }
    }
    throw new Error("no scroll box around the field");
  });
  await expect(picker).toHaveCount(0);
  await testInfo.attach("picker-scrolled-away", { body: await page.screenshot(), contentType: "image/png" });

  // Scrolling the popover's own list never closes it.
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(picker).toBeVisible();
  await picker.locator("[data-picker-list]").evaluate((list) => (list.scrollTop += 40));
  await page.waitForTimeout(100);
  await expect(picker).toBeVisible();
});

test("picker/popover hugs short rows and wraps a row's hint to two lines", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith("mobile"), "Desktop popover; a phone gets the full-width sheet.");
  await prepare(page);
  await mockUILanguagePacks(page);
  await page.goto("/");
  await clickTopbarPanel(page, "settings");
  const language = page.locator("#settings-control-language-select");
  await language.click();
  const languages = page.getByRole("dialog", { name: "Language", exact: true });
  await expect(languages.locator("[data-pick-row]").first()).toBeVisible();
  const field = (await language.boundingBox())!;
  const popup = (await languages.boundingBox())!;
  // At least the field's width, and narrower than the old fixed 352 px for these short names.
  expect(popup.width).toBeGreaterThanOrEqual(Math.floor(field.width));
  expect(popup.width).toBeLessThan(352);
  await testInfo.attach("language-popover", { body: await page.screenshot(), contentType: "image/png" });
  await page.keyboard.press("Escape");

  await clickTopbarPanel(page, "characters");
  const sort = page.getByRole("combobox", { name: "Sort characters" }).first();
  await sort.click();
  const sorts = page.getByRole("dialog", { name: "Sort characters", exact: true });
  const manual = sorts.locator("[data-pick-row]").filter({ hasText: "Manual order" });
  await expect(manual).toBeVisible();
  // The short hint keeps the sort popover narrow too; the keyboard shortcut lives in the docs.
  expect((await sorts.boundingBox())!.width).toBeLessThan(352);
  const hint = manual.getByText("Drag to reorder", { exact: false });
  // The whole hint shows: it wraps instead of clipping.
  expect(
    await hint.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await testInfo.attach("sort-manual-hint", { body: await page.screenshot(), contentType: "image/png" });
});
