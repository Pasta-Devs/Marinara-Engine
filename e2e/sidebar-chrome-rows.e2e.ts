// The top bar's Chats button and the sidebars' top rows after the one-sidebar change:
// - A mouse desktop window too narrow to dock the sidebar (below twice its width plus 384px) draws it as a sheet, but
//   keeps the desktop bar, so Chats stays with the panel buttons instead of jumping back beside Home.
// - Hovering Chats lights it like the other icons; only the open Chats wears the logo gradient.
// - The Presets tabs carry icons like Download | Open Library, and every label still fits in the narrowest sidebar.
// - The Chats mode tabs put the icon before the label, so the row keeps the other panels' row height.
// - Every sidebar's action row says Add, Import and Select beside its icons, each word whole inside its button even in
//   the narrowest sidebar, and Chats' Add is written in white like the other sidebars' create buttons.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Each case sets its own viewport; one Chromium run covers it.",
  );
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
});

async function openHome(page: Page, state: Record<string, unknown> = {}) {
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chibiProfessorMariEnabled: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    ...state,
  });
  await page.addInitScript((seen) => localStorage.setItem("marinara:whats-new:seen-version", seen), version);
  await page.goto("/");
}

const background = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);
const iconStroke = (locator: Locator) =>
  locator
    .locator("svg")
    .first()
    .evaluate((icon) => getComputedStyle(icon).stroke);

test.describe("in a 900px desktop window", () => {
  test.use({ viewport: { width: 900, height: 800 } });

  test("Chats stays with the panel buttons and hovers like them", async ({ page }) => {
    // A running accent animation paints every top-bar icon itself and would hide a hover gradient; reduced motion
    // stops it, as the Accent Pulse setting being off does.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openHome(page);
    await expect(page.locator('[data-shell-overlay-mode="true"]'), "the sidebar is drawn as a sheet").toHaveCount(1);
    await expect(page.locator("html")).not.toHaveAttribute("data-marinara-accent-animation", /.*/u);

    const topbar = page.locator('[data-component="TopBar"]');
    const chats = topbar.locator('[data-tour="sidebar-toggle"]');
    const characters = topbar.locator('[data-tour="panel-characters"]');
    await expect(chats).toBeVisible();
    await expect(topbar.locator('[data-tour="panel-buttons"] [data-tour="sidebar-toggle"]')).toHaveCount(1);
    expect(
      await chats.evaluate((button) => (button.nextElementSibling as HTMLElement | null)?.dataset.tour),
      "Chats comes first among the panel buttons",
    ).toBe("panel-characters");

    const idle = await background(chats);
    await characters.hover();
    // The hover light comes from React state, which renders a moment after the pointer arrives.
    await expect.poll(() => background(characters)).not.toBe(idle);
    const charactersHover = await background(characters);
    await chats.hover();
    await expect.poll(() => background(chats)).toBe(charactersHover);
    expect(await iconStroke(chats), "a hovered Chats keeps the plain icon").not.toMatch(/^url\(/u);
  });
});

test.describe("in a docked sidebar", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Each Presets tab's icon width (0 when it stepped aside) and whether its whole label shows after it. */
  async function presetTabs(page: Page) {
    const tabs = page.getByRole("group", { name: "Presets", exact: true }).getByRole("button");
    await expect(tabs).toHaveCount(4);
    return Promise.all(
      (await tabs.all()).map((tab) =>
        tab.evaluate((button) => {
          const icon = button.querySelector("svg")?.getBoundingClientRect();
          const label = button.querySelector("[data-fit-label]")!;
          // The text's own width, which the label box clips when it is too narrow.
          const range = document.createRange();
          range.selectNodeContents(label);
          const text = range.getBoundingClientRect();
          const box = button.getBoundingClientRect();
          return {
            label: label.textContent,
            iconWidth: icon?.width ?? 0,
            iconBeforeLabel: !icon || icon.right <= text.left,
            labelFits: text.width <= label.getBoundingClientRect().width + 0.5 && text.right <= box.right,
          };
        }),
      ),
    );
  }

  test("the Presets tabs show an icon before each whole label, and drop it before cutting the label", async ({
    page,
  }) => {
    // The default width: icon and label both fit in every tab.
    await openHome(page, { sidebarWidth: 320, rightPanelWidth: 320 });
    await page.locator('[data-tour="panel-presets"]').click();
    for (const tab of await presetTabs(page)) {
      expect(tab.iconWidth, tab.label!).toBeGreaterThan(0);
      expect(tab, tab.label!).toMatchObject({ iconBeforeLabel: true, labelFits: true });
    }
    // The narrowest width has room for the label only, so the icons step aside.
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setRightPanelWidth(280);
    });
    await expect.poll(async () => (await presetTabs(page)).map((tab) => tab.iconWidth)).toEqual([0, 0, 0, 0]);
    for (const tab of await presetTabs(page)) expect(tab.labelFits, tab.label!).toBe(true);
  });

  test("the Chats mode tabs put the icon before the label, at the Download | Open Library height", async ({ page }) => {
    await openHome(page, { sidebarWidth: 280, rightPanelWidth: 280, sidebarOpen: true });
    const modes = page.locator("[data-chat-mode-tab]");
    await expect(modes).toHaveCount(3);
    for (const mode of await modes.all()) {
      const iconBeforeLabel = await mode.evaluate((button) => {
        const icon = button.querySelector("svg")!.getBoundingClientRect();
        // The icon's wrapper is aria-hidden; the label is the next span.
        const label = button.querySelector(":scope > span:not([aria-hidden])")!.getBoundingClientRect();
        return icon.right <= label.left && Math.abs(icon.top + icon.height / 2 - (label.top + label.height / 2)) <= 2;
      });
      expect(iconBeforeLabel, await mode.innerText()).toBe(true);
    }
    const modeHeight = await modes.first().evaluate((button) => button.getBoundingClientRect().height);

    await page.locator('[data-tour="panel-characters"]').click();
    const download = page
      .locator('[data-component="CharacterLibraryActions"]')
      .getByRole("button", { name: "Download", exact: true });
    await expect(download).toBeVisible();
    const downloadHeight = await download.evaluate((button) => button.getBoundingClientRect().height);
    expect(Math.abs(modeHeight - downloadHeight)).toBeLessThanOrEqual(1);
  });
});

test.describe("the sidebars' action rows", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** The visible action row in `scope`: its words, whether each shows whole, and whether the row fits its sidebar. */
  const actionRow = (page: Page, scope: string) =>
    page.locator(scope).evaluate((root) => {
      const labels = Array.from(root.querySelectorAll("button > [data-fit-label]")).filter(
        (label) => label.getClientRects().length > 0 && ["Add", "Import", "Select"].includes(label.textContent ?? ""),
      );
      const row = labels[0]?.closest("button")?.parentElement;
      if (!row) return null;
      const range = document.createRange();
      const rowRight = row.getBoundingClientRect().right;
      return {
        words: labels.map((label) => label.textContent),
        whole: labels.every((label) => {
          range.selectNodeContents(label);
          const text = range.getBoundingClientRect();
          return text.width <= label.getBoundingClientRect().width + 0.5 && text.right <= rowRight + 0.5;
        }),
        fits: Array.from(row.children).every((child) => child.getBoundingClientRect().right <= rowRight + 0.5),
      };
    });

  for (const width of [280, 320]) {
    test(`every sidebar labels Add, Import and Select, whole, at ${width}px`, async ({ page }) => {
      await openHome(page, { sidebarWidth: width, rightPanelWidth: width, sidebarOpen: true });
      const sidebars: [string, string | null][] = [
        ["chats", null],
        ["characters", null],
        ["personas", null],
        ["lorebooks", null],
        ["presets", "Prompts"],
        ["presets", "Regexes"],
        ["presets", "Tools"],
        ["presets", "Profiles"],
        ["agents", null],
      ];
      let open = "chats";
      for (const [panel, tab] of sidebars) {
        // A top-bar button toggles its panel, so it is pressed only to change panels.
        if (panel !== open) await page.locator(`[data-tour="panel-${panel}"]`).click();
        open = panel;
        if (tab)
          await page.getByRole("group", { name: "Presets", exact: true }).getByRole("button", { name: tab }).click();
        const scope = panel === "chats" ? '[data-component="ChatSidebar"]' : '[data-component="RightPanel"]';
        const where = `${panel}${tab ? `/${tab}` : ""}`;
        await expect
          .poll(() => actionRow(page, scope), where)
          .toMatchObject({
            words: ["Add", "Import", "Select"],
            whole: true,
            fits: true,
          });
      }
    });
  }

  test("Chats' Add is written in white, like the other sidebars' create buttons", async ({ page }) => {
    await openHome(page, { sidebarOpen: true });
    const add = page
      .locator('[data-component="ChatSidebar"] button:has(> [data-fit-label])')
      .filter({ hasText: /^Add$/ });
    // Light enough to read on the mode's colour: every channel well above the old dark inks (#062426 and the like).
    const channels = (color: string) => (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    for (const mode of ["conversation", "roleplay", "game"]) {
      await page.locator(`[data-chat-mode-tab="${mode}"]`).click();
      const colors = await add.evaluate((button) => [
        getComputedStyle(button.querySelector("[data-fit-label]")!).color,
        getComputedStyle(button.querySelector("svg") ?? button).color,
      ]);
      for (const color of colors) expect(Math.min(...channels(color)), `${mode}: ${color}`).toBeGreaterThan(230);
    }
  });
});
