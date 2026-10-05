import { expect, test, type APIRequestContext, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

type ChatMode = "conversation" | "roleplay" | "game";
const APP_VERSION = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;
const TITLE = "Make this chat your own";
const UI_SETTINGS_PATH = "/api/app-settings/ui";

async function createChat(request: APIRequestContext, mode: ChatMode) {
  const response = await request.post("/api/chats", {
    data: { name: `${mode} layout introduction`, mode, characterIds: [] },
  });
  expect(response.ok()).toBeTruthy();
  const chat = (await response.json()) as { id: string };
  if (mode === "game") {
    expect(
      (
        await request.patch(`/api/chats/${chat.id}/metadata`, {
          data: {
            gameId: "chat-window-intro-game",
            gameSessionStatus: "active",
            gameSessionNumber: 1,
            gameIntroPresented: true,
          },
        })
      ).ok(),
    ).toBeTruthy();
  }
  expect(
    (
      await request.post(`/api/chats/${chat.id}/messages`, {
        data: { role: "assistant", content: "A quiet place to arrange your chat." },
      })
    ).ok(),
  ).toBeTruthy();
  return { id: chat.id, mode };
}

async function prepare(target: Page | BrowserContext, chatId: string, theme: "dark" | "light" = "dark") {
  await seedUIState(
    target,
    {
      theme,
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatWindowIntroDismissed: false,
      chatSettingsMoveTipDismissed: true,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
    },
    "if-missing",
  );
  await target.addInitScript(
    ({ chatId, version }) => {
      localStorage.setItem("marinara:whats-new:seen-version", version);
      localStorage.setItem("marinara-active-chat-id", chatId);
    },
    { chatId, version: APP_VERSION },
  );
}

async function waitForSettingsSync(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const module = (await import("/src/stores/ui.store.ts" as string)) as {
          useUIStore: { getState(): { settingsSyncReady: boolean } };
        };
        return module.useUIStore.getState().settingsSyncReady;
      }),
    )
    .toBe(true);
}

async function expectInsideViewport(page: Page, element: Locator) {
  const bounds = await element.boundingBox();
  expect(bounds).not.toBeNull();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
}

for (const [mode, theme] of [
  ["conversation", "light"],
  ["roleplay", "dark"],
  ["game", "dark"],
] as const) {
  test(`${mode}: the one-time layout introduction plays its real video and fits ${theme} mode`, async ({
    page,
    request,
  }, testInfo) => {
    const chat = await createChat(request, mode);
    try {
      await page.route("**/api/app-settings/ui", (route) => route.fulfill({ json: { value: "" } }));
      await prepare(page, chat.id, theme);
      await page.goto("/");
      const dialog = page.getByRole("dialog", { name: TITLE, exact: true });
      await expect(dialog).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const video = dialog.locator("[data-chat-window-intro-video]");
      await expect(video).toBeVisible();
      await expect
        .poll(() => video.evaluate((element: HTMLVideoElement) => `${element.videoWidth}x${element.videoHeight}`))
        .toBe("854x536");
      const media = await video.evaluate((element: HTMLVideoElement) => ({
        src: new URL(element.currentSrc).pathname,
        duration: element.duration,
        controls: element.controls,
        playsInline: element.playsInline,
        error: element.error?.message ?? null,
      }));
      expect(media.src).toBe("/tutorials/chat-layout.mp4");
      expect(media.duration).toBeCloseTo(33.5, 0);
      expect(media.controls).toBe(true);
      expect(media.playsInline).toBe(true);
      expect(media.error).toBeNull();
      await video.evaluate((element: HTMLVideoElement) => element.play());
      await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0.2);
      await video.evaluate((element: HTMLVideoElement) => element.pause());
      await expectInsideViewport(page, dialog);
      await expectInsideViewport(page, video);
      await page.screenshot({
        path: testInfo.outputPath(`chat-window-intro-${mode}-${theme}.png`),
        animations: "disabled",
      });
      const dismiss = dialog.getByRole("button", { name: "Got it", exact: true });
      await dismiss.scrollIntoViewIfNeeded();
      await expect(dismiss).toBeInViewport({ ratio: 1 });
      await dismiss.click();
      await expect(dialog).toHaveCount(0);
      await page.reload();
      await waitForSettingsSync(page);
      await expect(page.locator(`[data-chat-mode="${mode}"]`)).toBeVisible();
      await expect(dialog).toHaveCount(0);
    } finally {
      await request.delete(`/api/chats/${chat.id}?force=true`);
    }
  });
}

test("intro dismissal persists on the server, across modes and fresh browsers despite stale preferences", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("desktop"), "The shared persistence flow needs one real-server proof.");
  const original = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
  const chats = await Promise.all(
    (["roleplay", "conversation", "game"] as const).map((mode) => createChat(request, mode)),
  );
  const freshContext = await browser.newContext({ viewport: page.viewportSize()! });
  let releaseSettings!: () => void;
  const settingsGate = new Promise<void>((resolve) => {
    releaseSettings = resolve;
  });
  const readServerSettings = async () => {
    const saved = (await (await request.get(UI_SETTINGS_PATH)).json()) as { value: string | null };
    return JSON.parse(saved.value || "{}") as Record<string, unknown>;
  };
  try {
    expect(
      (
        await request.put(UI_SETTINGS_PATH, { data: { value: JSON.stringify({ chatWindowIntroDismissed: false }) } })
      ).ok(),
    ).toBeTruthy();
    await page.route("**/api/app-settings/ui", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const response = await route.fetch();
      await settingsGate;
      await route.fulfill({ response });
    });
    await prepare(page, chats[0]!.id);
    const settingsRequest = page.waitForRequest(
      (req) => req.url().endsWith(UI_SETTINGS_PATH) && req.method() === "GET",
    );
    await page.goto("/");
    await settingsRequest;
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    const dialog = page.getByRole("dialog", { name: TITLE, exact: true });
    // The intro cannot flash before saved preferences have finished loading.
    await expect(dialog).toHaveCount(0);
    releaseSettings();
    await expect(dialog).toBeVisible();
    const savedImmediately = await dialog.getByRole("button", { name: "Got it", exact: true }).evaluate((button) => {
      (button as HTMLButtonElement).click();
      return JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "{}").state?.chatWindowIntroDismissed;
    });
    expect(savedImmediately).toBe(true);
    await expect.poll(async () => (await readServerSettings()).chatWindowIntroDismissed).toBe(true);
    for (const chat of chats.slice(1)) {
      await page.evaluate(async (id) => {
        const module = (await import("/src/stores/chat.store.ts" as string)) as {
          useChatStore: { getState(): { setActiveChatId(id: string): void } };
        };
        module.useChatStore.getState().setActiveChatId(id);
      }, chat.id);
      await expect(page.locator(`[data-chat-mode="${chat.mode}"]`)).toBeVisible();
      await expect(dialog).toHaveCount(0);
    }

    // A newer server blob from an older browser cannot undo a permanent dismissal.
    const stale = {
      ...(await readServerSettings()),
      chatWindowIntroDismissed: false,
      __updatedAt: Date.now() + 60_000,
    };
    expect((await request.put(UI_SETTINGS_PATH, { data: { value: JSON.stringify(stale) } })).ok()).toBeTruthy();
    await page.reload();
    await waitForSettingsSync(page);
    await expect(page.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    await expect(dialog).toHaveCount(0);
    await expect.poll(async () => (await readServerSettings()).chatWindowIntroDismissed).toBe(true);

    // A genuinely fresh browser still respects the server dismissal, even with newer unrelated local preferences.
    await prepare(freshContext, chats[0]!.id);
    await freshContext.addInitScript(() => {
      localStorage.setItem("marinara-engine-ui-updated-at", String(Date.now() + 120_000));
    });
    const fresh = await freshContext.newPage();
    await fresh.goto(page.url());
    await waitForSettingsSync(fresh);
    await expect(fresh.locator('[data-chat-mode="roleplay"]')).toBeVisible();
    await expect(fresh.getByRole("dialog", { name: TITLE, exact: true })).toHaveCount(0);
    expect(
      await fresh.evaluate(
        () => JSON.parse(localStorage.getItem("marinara-engine-ui") ?? "{}").state?.chatWindowIntroDismissed,
      ),
    ).toBe(true);
  } finally {
    releaseSettings();
    await freshContext.close();
    await page.close();
    await request.put(UI_SETTINGS_PATH, { data: { value: original.value ?? "" } });
    await Promise.all(chats.map((chat) => request.delete(`/api/chats/${chat.id}?force=true`)));
  }
});
