// #9492 (Dottore): a modeless dialog keeps clear of the one sidebar only while that sidebar is docked. Below the docking
// width (twice the sidebar plus 384px) and on touch screens up to 1440px wide, the shell draws Chats and the panels as a
// sheet, so the dialog stays centred with 16px on both edges instead of reserving the sidebar's width on one side. At
// desktop width it keeps clear of the docked sidebar, docked on the right or on the left. The chat's profile builder is
// the app's modeless dialog, and it keeps pace with the sidebar while its edge is dragged. Chat Settings is pinned first: on a phone or tablet, opening Chats or a panel closes an
// unpinned Chat Settings, and the builder with it, so only a pinned window keeps the builder open beside the sheet.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const EDGE = 16;

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Each case sets its own viewport; one Chromium run covers it.",
  );
  await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: null } }));
});

async function createChat(request: APIRequestContext) {
  const response = await request.post("/api/chats", {
    data: { name: "Modeless dialog sidebar inset", mode: "conversation", characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as { id: string };
}

/** Opens the chat, then its profile builder in a pinned Chat Settings window, with Chats closed. */
async function openProfileBuilder(page: Page, chatId: string, sidebarSide: "left" | "right" = "right") {
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    sidebarSide,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    chatSettingsMoveTipDismissed: true,
  });
  await page.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara-active-chat-id", chatId);
      localStorage.setItem("marinara:whats-new:seen-version", version);
    },
    { chatId, version },
  );
  await page.goto("/");
  await page.locator("[data-chat-settings-button]:visible").click();
  const settings = page.locator('[data-window="chat-settings"]');
  await expect(settings.locator("[data-chat-settings-section]").first()).toBeVisible();
  const pin = settings.getByRole("button", { name: "Pin window", exact: true });
  await pin.click();
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await settings.getByTitle("New profile from this chat's settings").click();
  const builder = page.getByRole("dialog", { name: "New settings profile", exact: true });
  await expect(builder).toBeVisible();
  return builder;
}

const chatsButton = (page: Page) => page.locator('[data-tour="sidebar-toggle"]:visible');

async function openChats(page: Page) {
  await chatsButton(page).click();
  await expect(chatsButton(page)).toHaveAttribute("aria-pressed", "true");
}

/** The inset AppShell publishes for floating chat UI: the docked sidebar's width on its side, 0 for a sheet. */
const readInset = (page: Page, side: "left" | "right") =>
  page.evaluate(
    (side) => getComputedStyle(document.documentElement).getPropertyValue(`--mari-chat-ui-inset-${side}`).trim(),
    side,
  );

/** The dialog's panel once its opening scale has settled. */
async function panelBox(builder: Locator) {
  const panel = builder.locator(".mari-modal-panel");
  await expect.poll(() => panel.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
  const box = await panel.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

/** The gaps between the dialog's panel and the viewport's left and right edges. */
async function gaps(page: Page, builder: Locator) {
  const box = await panelBox(builder);
  const viewportWidth = page.viewportSize()!.width;
  return { left: Math.round(box.x), right: Math.round(viewportWidth - (box.x + box.width)) };
}

/** Centred: equal gaps (within 2px), at least the 16px edge on both sides. */
async function expectCentred(page: Page, builder: Locator, state: string) {
  await expect
    .poll(
      async () => {
        const { left, right } = await gaps(page, builder);
        return Math.abs(left - right) <= 2 && left >= EDGE - 1 && right >= EDGE - 1 ? "centred" : { left, right };
      },
      { message: `the builder is centred with 16px edges (${state})` },
    )
    .toBe("centred");
}

/** Sheet mode: the shell publishes no inset, and the builder stays centred with Chats or a panel open over it. */
async function expectCentredOverSheet(page: Page, builder: Locator) {
  await expectCentred(page, builder, "Chats closed");
  await openChats(page);
  await expect(builder).toBeVisible();
  // The sheet covers the chat; the shell's docked width is 0 on both sides.
  await expect.poll(() => readInset(page, "right")).toBe("0px");
  await expect.poll(() => readInset(page, "left")).toBe("0px");
  await expectCentred(page, builder, "Chats open as a sheet");
  // A panel takes the sheet's place (the action the top bar's Characters button runs): it reserves nothing either.
  await page.evaluate(async () => {
    const { useUIStore } = (await import("/src/stores/ui.store.ts" as string)) as {
      useUIStore: { getState: () => { openRightPanel: (panel: string) => void } };
    };
    useUIStore.getState().openRightPanel("characters");
  });
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();
  await expect(builder).toBeVisible();
  await expectCentred(page, builder, "the Characters panel open as a sheet");
}

test.describe("below the docking width (900px)", () => {
  test.use({ viewport: { width: 900, height: 800 } });

  test("a modeless dialog stays centred while Chats or a panel is a sheet", async ({ page, request }) => {
    const chat = await createChat(request);
    try {
      const builder = await openProfileBuilder(page, chat.id);
      await expectCentredOverSheet(page, builder);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test.describe("on a 1280px touch screen", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: true, hasTouch: true });

  test("a modeless dialog stays centred while Chats or a panel is a sheet", async ({ page, request }) => {
    const chat = await createChat(request);
    try {
      const builder = await openProfileBuilder(page, chat.id);
      // The touch screen takes the phone and tablet shell, which this case is about.
      expect(
        await page.evaluate(() => matchMedia("(hover: none) and (any-pointer: coarse)").matches),
        "the emulated screen is a coarse pointer without hover",
      ).toBe(true);
      await expectCentredOverSheet(page, builder);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
});

test.describe("on a 1440px desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const side of ["right", "left"] as const) {
    test(`a modeless dialog keeps clear of the sidebar docked on the ${side}`, async ({ page, request }) => {
      const chat = await createChat(request);
      try {
        const builder = await openProfileBuilder(page, chat.id, side);
        await expectCentred(page, builder, "Chats closed");
        await openChats(page);
        const slot = page.locator('[data-component="SidebarSlot"]');
        await expect(slot).toHaveAttribute("data-sidebar-side", side);
        // The shell publishes the docked width once the sidebar has slid in.
        const other = side === "right" ? "left" : "right";
        await expect.poll(() => readInset(page, side)).not.toBe("0px");
        expect(await readInset(page, other)).toBe("0px");
        const inset = Number.parseFloat(await readInset(page, side));
        const sidebar = (await page.locator('[data-component="SidebarSlotPanel"]').boundingBox())!;
        expect(Math.abs(sidebar.width - inset), "the published inset is the sidebar's width").toBeLessThanOrEqual(1);

        const viewportWidth = page.viewportSize()!.width;
        const box = await panelBox(builder);
        if (side === "right") {
          expect(box.x + box.width, "16px clear of the sidebar").toBeLessThanOrEqual(viewportWidth - inset - EDGE + 1);
          expect(box.x + box.width, "not over the sidebar").toBeLessThanOrEqual(sidebar.x + 1);
          expect(box.x, "16px clear of the window's left edge").toBeGreaterThanOrEqual(EDGE - 1);
        } else {
          expect(box.x, "16px clear of the sidebar").toBeGreaterThanOrEqual(inset + EDGE - 1);
          expect(box.x, "not over the sidebar").toBeGreaterThanOrEqual(sidebar.x + sidebar.width - 1);
          expect(viewportWidth - (box.x + box.width), "16px clear of the window's right edge").toBeGreaterThanOrEqual(
            EDGE - 1,
          );
        }
      } finally {
        await request.delete(`/api/chats/${chat.id}?force=true`);
      }
    });

    test(`a modeless dialog keeps pace with the sidebar docked on the ${side} while its edge is dragged`, async ({
      page,
      request,
    }) => {
      const chat = await createChat(request);
      try {
        const builder = await openProfileBuilder(page, chat.id, side);
        await openChats(page);
        await expect(page.locator('[data-component="SidebarSlot"]')).toHaveAttribute("data-sidebar-side", side);
        await panelBox(builder);
        // The handle is grabbed once the sidebar has slid in, so it is where the pointer goes down.
        await expect.poll(() => readInset(page, side)).not.toBe("0px");
        const sidebarPanel = page.locator('[data-component="SidebarSlotPanel"]');
        const before = (await sidebarPanel.boundingBox())!.width;
        const handle = page.getByRole("separator", { name: "Resize sidebar", exact: true });
        const grip = (await handle.boundingBox())!;
        const startX = grip.x + grip.width / 2;
        await page.mouse.move(startX, grip.y + grip.height / 2);
        await page.mouse.down();
        // A hand drags the edge a little every frame. AppShell's published insets wait 220ms for the drag to pause (a
        // root style write restyles the whole app), so only a dialog that measures the sidebar itself keeps pace. The
        // dialog's padding on the sidebar's side must be the sidebar's width plus its 16px edge, read within 180ms of
        // each move: a slow frame could outlast the pause and let a lagging dialog catch up, so those are not counted.
        const { worst, counted } = await page.evaluate(
          async ({ startX, side }) => {
            const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
            const dialog = [...document.querySelectorAll<HTMLElement>(".mari-modal")].find((element) =>
              element.style.getPropertyValue("--dialog-right"),
            )!;
            const sidebar = document.querySelector<HTMLElement>('[data-component="SidebarSlotPanel"]')!;
            let worst = 0;
            let counted = 0;
            for (let step = 1; step <= 40; step += 1) {
              const clientX = side === "right" ? startX - step * 3 : startX + step * 3;
              const movedAt = performance.now();
              window.dispatchEvent(new MouseEvent("mousemove", { clientX, clientY: 400, bubbles: true }));
              await frame();
              await frame();
              const style = getComputedStyle(dialog);
              const padding = Number.parseFloat(side === "right" ? style.paddingRight : style.paddingLeft);
              const width = sidebar.getBoundingClientRect().width;
              if (step > 2 && performance.now() - movedAt < 180) {
                counted += 1;
                worst = Math.max(worst, Math.abs(padding - (width + 16)));
              }
            }
            return { worst, counted };
          },
          { startX, side },
        );
        const during = (await sidebarPanel.boundingBox())!.width;
        await page.mouse.up();
        expect(during - before, "the drag widened the sidebar").toBeGreaterThanOrEqual(60);
        expect(counted, "enough frames came within 180ms of their move to judge").toBeGreaterThanOrEqual(8);
        expect(worst, "the dialog's padding keeps pace with the dragged sidebar").toBeLessThanOrEqual(4);
      } finally {
        await request.delete(`/api/chats/${chat.id}?force=true`);
      }
    });
  }
});
