// On a phone a toast sits below the header rows under the top bar, so it never covers their controls
// (the Chat Settings star, an editor's Save and Close, the chat's buttons). Desktop keeps its place.
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { openChatSettings, openChatTool } from "./chat-settings-tools.js";
import { clickTopbarPanel } from "./topbar-navigation.js";
import { seedUIState } from "./ui-state-fixture.js";
import { prepareViteFixtureDependencies } from "./vite-fixture-dependencies.js";

const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const TOAST_ID = "phone-toast-headers";
const CHAT_NAME_WINDOW = "drawer:chat-settings:chat-name";
// Every header row with controls a phone shows at the top: the top bar, the chat's buttons, a window or
// sheet, the right panel and the chat list (the drawers), and an editor.
const HEADERS = [
  '[data-component="TopBar"]',
  ".mari-window-bubble",
  ".mari-window__header",
  ".mari-right-panel-header",
  ".mari-sidebar-header",
  ".mari-editor-header",
  "[data-chat-window-top-obstacle]",
].join(",");

async function showToast(page: Page, label: string) {
  await prepareViteFixtureDependencies(page, "/src/App.tsx");
  await page.evaluate(
    async ({ id, text }) => {
      const { toast } = await import(window.__viteFixtureDependencyUrl("sonner"));
      toast.success(text, { id, duration: Infinity });
    },
    { id: TOAST_ID, text: label },
  );
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: label });
  await expect(toast).toHaveAttribute("data-mounted", "true");
  return toast;
}

async function dismissToast(page: Page) {
  const exit = sampleHeaderHits(page);
  await page.evaluate(async (id) => {
    const { toast } = await import(window.__viteFixtureDependencyUrl("sonner"));
    toast.dismiss(id);
  }, TOAST_ID);
  expect(await exit, "a departing toast must not intercept header controls").toEqual([]);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
}

/** Hit-testing includes Sonner's invisible hover bridges and the whole entry/exit animation. */
function sampleHeaderHits(page: Page) {
  return page.evaluate(async (selector) => {
    const blocked = new Set<string>();
    const until = performance.now() + 500;
    do {
      for (const header of document.querySelectorAll<HTMLElement>(selector)) {
        if (getComputedStyle(header).visibility !== "visible") continue;
        const controls = header.matches("button") ? [header] : header.querySelectorAll<HTMLElement>("button");
        for (const control of controls) {
          const rect = control.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          for (const x of [rect.left + 1, rect.left + rect.width / 2, rect.right - 1]) {
            for (const y of [rect.top + 1, rect.top + rect.height / 2, rect.bottom - 1]) {
              if (document.elementFromPoint(x, y)?.closest("[data-sonner-toast]")) {
                blocked.add(control.getAttribute("aria-label") || control.textContent?.trim() || control.className);
              }
            }
          }
        }
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    } while (performance.now() < until);
    return [...blocked];
  }, HEADERS);
}

/** Once the toast settles: every visible header (or extra control) it overlaps, and where it sits. */
function headerOverlaps(toast: Locator, extraControls: string[] = []) {
  return toast.evaluate(
    async (element, selector) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
      const box = element.getBoundingClientRect();
      const overlaps = Array.from(document.querySelectorAll<HTMLElement>(selector))
        .filter((header) => header.checkVisibility?.({ visibilityProperty: true }) ?? header.offsetParent !== null)
        .map((header) => ({ header, rect: header.getBoundingClientRect() }))
        .filter(
          ({ rect }) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.left < box.right &&
            rect.right > box.left &&
            rect.top < box.bottom - 0.5 &&
            rect.bottom > box.top + 0.5,
        )
        .map(
          ({ header, rect }) =>
            `${header.className.toString().split(/\s+/)[0] || header.dataset.component}${
              header.dataset.window ? `(${header.dataset.window})` : ""
            } ${Math.round(rect.top)}-${Math.round(rect.bottom)} under toast ${Math.round(box.top)}-${Math.round(box.bottom)}`,
        );
      return { overlaps, top: box.top, bottom: box.bottom, viewport: window.innerHeight };
    },
    [HEADERS, ...extraControls].join(","),
  );
}

async function expectToastClearsHeaders(page: Page, label: string, extraControls: string[] = []) {
  const entry = sampleHeaderHits(page);
  const { overlaps, bottom, viewport } = await headerOverlaps(await showToast(page, label), extraControls);
  expect(await entry, `${label}: an arriving toast intercepts header controls`).toEqual([]);
  expect(overlaps, `${label}: the toast covers header controls`).toEqual([]);
  expect(bottom, `${label}: the toast stays on screen`).toBeLessThan(viewport);
  for (const selector of extraControls) {
    for (const control of await page.locator(selector).all()) {
      if ((await control.isVisible()) && (await control.isEnabled())) await control.click({ trial: true });
    }
  }
  await dismissToast(page);
}

async function createChat(
  request: APIRequestContext,
  mode: "conversation" | "roleplay" | "game",
  characterIds: string[],
  metadata: Record<string, unknown> = {},
) {
  const response = await request.post("/api/chats", {
    data: { name: `Toast headers ${mode}`, mode, characterIds },
    failOnStatusCode: true,
  });
  const { id } = (await response.json()) as { id: string };
  await request.patch(`/api/chats/${id}/metadata`, {
    data: {
      chatSettingsHintDismissed: true,
      enableAgents: false,
      ...metadata,
      ...(mode === "game"
        ? { gameId: "toast-headers-game", gameSessionStatus: "active", gameSessionNumber: 1, gameIntroPresented: true }
        : {}),
    },
    failOnStatusCode: true,
  });
  if (mode === "game") {
    await request.post(`/api/chats/${id}/messages`, {
      data: { role: "assistant", content: "The game begins." },
      failOnStatusCode: true,
    });
  }
  return id;
}

async function prepare(page: Page, chatId: string) {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await seedUIState(page, {
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    notificationPosition: "top",
    chatSettingsMoveTipDismissed: true,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
  });
  await page.addInitScript(
    ({ id, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", id);
    },
    { id: chatId, version: APP_VERSION },
  );
}

test("desktop toasts keep their top-centre place", async ({ page, request }, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The phone placement is covered below.");
  const chatId = await createChat(request, "conversation", []);
  try {
    await prepare(page, chatId);
    await page.goto("/");
    await expect(page.locator("[data-chat-settings-button]")).toBeVisible({ timeout: 60_000 });
    // Sonner's 4rem offset, unchanged by the phone placement.
    const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    expect((await headerOverlaps(await showToast(page, "Desktop toast"))).top).toBeCloseTo(4 * rem, 0);
  } finally {
    await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
  }
});

test.describe("phone toasts", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.includes("desktop"), "Desktop toasts keep their place.");
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("clear phone headers above Sonner's 600px breakpoint", async ({ page, request }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    const chatId = await createChat(request, "conversation", []);
    try {
      await prepare(page, chatId);
      await page.goto("/");
      await openChatSettings(page);
      await expectToastClearsHeaders(page, "Landscape Chat Settings", [
        '[data-chat-settings-control="favorite-layout"]',
        '[data-window="chat-settings"] [data-window-control="close"]',
      ]);
    } finally {
      await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    }
  });

  test("clear a top toolbar that mounts and wraps while the chat is open", async ({ page, request }) => {
    const chatId = await createChat(request, "conversation", []);
    try {
      await prepare(page, chatId);
      await page.goto("/");
      await expect(page.locator("[data-chat-settings-button]")).toBeVisible({ timeout: 60_000 });
      // Exercise the shared top-obstacle contract independently of a particular Game fixture.
      // The initiative suite verifies that the real tactical toolbar publishes this marker.
      await page.evaluate(() => {
        const toolbar = document.createElement("div");
        toolbar.dataset.chatWindowTopObstacle = "true";
        toolbar.style.cssText = `position:fixed;left:0;right:0;top:${document.querySelector('[data-component="TopBar"]')!.getBoundingClientRect().bottom}px;height:96px;z-index:1000;display:grid;place-items:center`;
        const button = document.createElement("button");
        button.textContent = "Toolbar action";
        toolbar.append(button);
        document.body.append(toolbar);
      });
      await expectToastClearsHeaders(page, "Mounted toolbar", ["[data-chat-window-top-obstacle] button"]);
      await page.locator("[data-chat-window-top-obstacle]").evaluate((toolbar) => {
        toolbar.style.height = "132px";
      });
      await expectToastClearsHeaders(page, "Wrapped toolbar", ["[data-chat-window-top-obstacle] button"]);
    } finally {
      await page
        .evaluate(() => document.querySelector("[data-chat-window-top-obstacle]")?.remove())
        .catch(() => undefined);
      await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
    }
  });

  test("clear the chat, window, drawer and editor headers", async ({ page, request }) => {
    test.setTimeout(180_000);
    const character = await request.post("/api/characters", {
      data: { data: { name: "Toast Header Character" } },
      failOnStatusCode: true,
    });
    const { id: characterId } = (await character.json()) as { id: string };
    const lorebook = await request.post("/api/lorebooks", {
      data: { name: "Toast Header Lorebook" },
      failOnStatusCode: true,
    });
    const { id: lorebookId } = (await lorebook.json()) as { id: string };
    // Chat Name is popped out, so a phone lists it in the chat's tools as a drawer window.
    const chatId = await createChat(request, "conversation", [characterId], {
      windowLayout: { version: 1, windows: {}, detached: [CHAT_NAME_WINDOW] },
    });
    try {
      await prepare(page, chatId);
      await page.goto("/");
      await expect(page.locator("[data-chat-settings-button]")).toBeVisible({ timeout: 60_000 });
      await expectToastClearsHeaders(page, "Chat");

      const settings = await openChatSettings(page);
      await expectToastClearsHeaders(page, "Chat Settings", [
        '[data-chat-settings-control="favorite-layout"]',
        '[data-window="chat-settings"] [data-window-control="close"]',
      ]);
      await settings.locator('[data-window-control="close"]').click();
      await expect(settings).toBeHidden();

      const drawer = await openChatTool(page, CHAT_NAME_WINDOW);
      await expect(drawer).toHaveAttribute("data-presentation", "sheet");
      await expectToastClearsHeaders(page, "Popped-out drawer", [
        `[data-window="${CHAT_NAME_WINDOW}"] [data-window-control="close"]`,
      ]);
      await drawer.locator('[data-window-control="close"]').click();
      await expect(drawer).toBeHidden();

      await clickTopbarPanel(page, "characters");
      await expect(page.locator(".mari-right-panel-header")).toBeVisible();
      await expectToastClearsHeaders(page, "Characters panel");

      await page.locator(`[data-character-id="${characterId}"]`).first().click();
      await expect(page.locator(".mari-editor-header")).toBeVisible({ timeout: 60_000 });
      await expectToastClearsHeaders(page, "Character editor", [".mari-editor-header button"]);

      // An editor opened while a toast shows moves the toast below its header too.
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().closeCharacterDetail();
      });
      await expect(page.locator(".mari-editor-header")).toBeHidden();
      const lingering = await showToast(page, "Toast before an editor");
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openCharacterDetail(id);
      }, characterId);
      await expect(page.locator(".mari-editor-header")).toBeVisible({ timeout: 60_000 });
      expect((await headerOverlaps(lingering, [".mari-editor-header button"])).overlaps).toEqual([]);
      await dismissToast(page);

      await clickTopbarPanel(page, "lorebooks");
      await page.getByText("Toast Header Lorebook", { exact: true }).first().click();
      await expect(page.getByRole("heading", { name: "Toast Header Lorebook", exact: true })).toBeVisible();
      await expectToastClearsHeaders(page, "Lorebook editor", [".mari-editor-header button"]);

      await clickTopbarPanel(page, "settings");
      await expect(page.locator(".mari-settings-search-header")).toBeVisible();
      await expectToastClearsHeaders(page, "Settings");

      await page.locator('[data-component="TopBar"] [data-tour="sidebar-toggle"]').click();
      await expect(page.locator(".mari-sidebar-header")).toBeVisible();
      await expectToastClearsHeaders(page, "Chat list");
    } finally {
      await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
      await request.delete(`/api/lorebooks/${lorebookId}`).catch(() => undefined);
      await request.delete(`/api/characters/${characterId}`).catch(() => undefined);
    }
  });

  for (const mode of ["roleplay", "game"] as const) {
    test(`clear the ${mode} chat headers`, async ({ page, request }) => {
      const chatId = await createChat(request, mode, []);
      try {
        await prepare(page, chatId);
        await page.goto("/");
        await expect(page.locator("[data-chat-settings-button]")).toBeVisible({ timeout: 60_000 });
        await expectToastClearsHeaders(page, `${mode} chat`);
        await openChatSettings(page);
        await expectToastClearsHeaders(page, `${mode} Chat Settings`, [
          '[data-chat-settings-control="favorite-layout"]',
        ]);
      } finally {
        await request.delete(`/api/chats/${chatId}?force=true`).catch(() => undefined);
      }
    });
  }
});
