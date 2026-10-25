import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { isolateSyncedUISettings, seedUIState } from "./ui-state-fixture.js";
import { openChatSettings } from "./chat-settings-tools.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

async function prepare(page: Page, theme: "dark" | "light", extra: Record<string, unknown> = {}) {
  await isolateSyncedUISettings(page);
  await seedUIState(page, {
    theme,
    hasCompletedOnboarding: true,
    sidebarOpen: false,
    rightPanelOpen: false,
    chatHelpSeenModes: ["conversation", "roleplay", "game"],
    ...extra,
  });
  await page.addInitScript((v) => localStorage.setItem("marinara:whats-new:seen-version", v), version);
}

async function installKeyboardViewport(page: Page) {
  await page.addInitScript(() => {
    const state = { height: 0, offsetTop: 0 };
    const viewport = new EventTarget();
    Object.defineProperties(viewport, {
      height: { get: () => state.height || window.innerHeight },
      offsetTop: { get: () => state.offsetTop },
      pageTop: { get: () => state.offsetTop },
      scale: { get: () => 1 },
      width: { get: () => window.innerWidth },
    });
    Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
    Object.assign(window, {
      __keyboardViewport: (height: number, top: number) => {
        state.height = height;
        state.offsetTop = top;
        viewport.dispatchEvent(new Event("resize"));
        viewport.dispatchEvent(new Event("scroll"));
      },
    });
  });
}

for (const theme of ["dark", "light"] as const) {
  test(`character appearance controls live under Characters and preserve settings (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    const characterResponse = await request.post("/api/characters", {
      data: { data: { name: "Appearance fixture", creator_notes: "<style>.message { color: teal; }</style>" } },
    });
    expect(characterResponse.ok()).toBeTruthy();
    const character = await characterResponse.json();
    const groupResponse = await request.post("/api/characters/groups", {
      data: { name: "Appearance folder", characterIds: [character.id] },
    });
    expect(groupResponse.ok()).toBeTruthy();
    const group = await groupResponse.json();
    const response = await request.post("/api/chats", {
      data: { name: "Appearance settings", mode: "roleplay", characterIds: [character.id] },
    });
    expect(response.ok()).toBeTruthy();
    const chat = await response.json();
    let gameId: string | undefined;
    try {
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { colorInlineNames: false, cardCssMode: "exclusive" },
      });
      await prepare(page, theme, { chatSettingsExpandedSections: { "roleplay-characters": true } });
      await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
      await page.goto("/");
      const settings = await openChatSettings(page);
      const characters = settings.locator('[data-chat-settings-section="roleplay-characters"]');
      await expect(settings.locator('[data-chat-settings-section="roleplay-card-theming"]')).toHaveCount(0);
      const coloring = characters.getByRole("checkbox", { name: "Color Character Names in Text" });
      await expect(coloring).not.toBeChecked();
      const folder = characters.getByRole("button", { name: "Add from Folder", exact: true });
      await expect(folder).toBeVisible();
      expect(
        await characters.evaluate((section) => {
          const folderButton = Array.from(section.querySelectorAll("button")).find((button) =>
            button.textContent?.includes("Add from Folder"),
          );
          const toggle = section.querySelector('input[type="checkbox"]');
          return Boolean(
            folderButton && toggle && folderButton.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
        }),
      ).toBe(true);
      await characters.getByText("Color Character Names in Text", { exact: true }).click();
      await expect(coloring).toBeChecked();
      await expect(characters.getByRole("group", { name: "Card Theming" })).toBeVisible();
      await characters.getByRole("button", { name: "Chat", exact: true }).click();
      await expect(characters.getByRole("button", { name: "Chat", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(characters.getByRole("button", { name: "Exclusive", exact: true })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      const metadata = async () => {
        const current = await (await request.get(`/api/chats/${chat.id}`)).json();
        return typeof current.metadata === "string" ? JSON.parse(current.metadata) : current.metadata;
      };
      await expect.poll(async () => (await metadata()).colorInlineNames).toBe(true);
      await expect.poll(async () => (await metadata()).cardCssMode).toBe("chat");
      await testInfo.attach(`characters-${theme}`, { body: await characters.screenshot(), contentType: "image/png" });
      const gameResponse = await request.post("/api/chats", {
        data: { name: "Game appearance settings", mode: "game", characterIds: [character.id] },
      });
      expect(gameResponse.ok()).toBeTruthy();
      gameId = (await gameResponse.json()).id;
      await request.patch(`/api/chats/${gameId}/metadata`, {
        data: {
          gameId: "appearance-fixture",
          gameSessionStatus: "active",
          gameSessionNumber: 1,
          gameIntroPresented: true,
        },
      });
      await request.post(`/api/chats/${gameId}/messages`, {
        data: { role: "assistant", content: "The appearance test begins." },
      });
      await page.evaluate(async (id) => {
        const ui = await import("/src/stores/ui.store.ts" as string);
        ui.useUIStore.getState().setChatSettingsSectionExpanded("game-party", true);
        const chatStore = await import("/src/stores/chat.store.ts" as string);
        chatStore.useChatStore.getState().setActiveChatId(id);
      }, gameId);
      await expect(page.getByRole("textbox", { name: "What do you do?", exact: true })).toBeVisible();
      const gameSettingsButton = page.locator("[data-chat-settings-button]");
      if ((await gameSettingsButton.getAttribute("aria-expanded")) !== "true") await gameSettingsButton.click();
      const gameSettings = page.locator('[data-window="chat-settings"]');
      await expect(
        gameSettings.locator('[data-chat-settings-section="game-party"]').getByRole("group", { name: "Card Theming" }),
      ).toBeVisible();
      await expect(gameSettings.locator('[data-chat-settings-section="game-card-theming"]')).toHaveCount(0);
    } finally {
      if (gameId) await request.delete(`/api/chats/${gameId}`);
      await request.delete(`/api/chats/${chat.id}`);
      await request.delete(`/api/characters/groups/${group.id}`);
      await request.delete(`/api/characters/${character.id}`);
    }
  });

  test(`extension revision retention requires confirmation and persists (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    // Both mobile projects share one installation; exercise this global setting in WebKit only.
    test.skip(testInfo.project.name === "mobile-chromium", "The mobile WebKit project owns revision retention state.");
    expect(
      (await request.patch("/api/personal-extensions/revision-history", { data: { limit: 10 } })).ok(),
    ).toBeTruthy();
    try {
      await prepare(page, theme, { rightPanelOpen: true, rightPanel: "settings", settingsTab: "addons" });
      await page.goto("/");
      const limit = page.getByLabel("Previous revisions to keep", { exact: true });
      await expect(limit).toHaveValue("10");
      await expect(limit.locator("option")).toHaveCount(11);
      await limit.selectOption("2");
      await expect(page.getByText("Remove older extension revisions?", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(limit).toHaveValue("10");
      expect((await (await request.get("/api/personal-extensions/revision-history")).json()).limit).toBe(10);
      await limit.selectOption("0");
      await page.getByRole("button", { name: "Remove older revisions", exact: true }).click();
      await expect(limit).toHaveValue("0");
      await page.reload();
      await expect(limit).toHaveValue("0");
      await testInfo.attach(`retention-${theme}`, {
        body: await limit.locator("xpath=ancestor::section[1]").screenshot(),
        contentType: "image/png",
      });
      await limit.selectOption("5");
      await expect(limit).toHaveValue("5");
      await expect(page.getByText("Remove older extension revisions?", { exact: true })).toHaveCount(0);
    } finally {
      await request.patch("/api/personal-extensions/revision-history", { data: { limit: 10 } });
    }
  });

  test(`extension revision retention confirms restored surplus before an increase (${theme})`, async ({
    page,
  }, testInfo) => {
    let storedLimit = 3;
    const changes: Array<{ limit: number; confirmPrune?: boolean }> = [];
    await page.route("**/api/personal-extensions/revision-history", async (route) => {
      if (route.request().method() === "PATCH") {
        const input = route.request().postDataJSON() as { limit: number; confirmPrune?: boolean };
        changes.push(input);
        if (!input.confirmPrune) {
          await route.fulfill({ status: 409, json: { error: "Confirmation required", code: "confirmation_required" } });
          return;
        }
        storedLimit = input.limit;
      }
      await route.fulfill({ json: { limit: storedLimit } });
    });
    await prepare(page, theme, { rightPanelOpen: true, rightPanel: "settings", settingsTab: "addons" });
    await page.goto("/");
    const limit = page.getByLabel("Previous revisions to keep", { exact: true });
    await expect(limit).toHaveValue("3");
    await limit.selectOption("5");
    await expect(page.getByText("Remove older extension revisions?", { exact: true })).toBeVisible();
    await expect(page.locator('.mari-modal[role="dialog"]')).toHaveCSS("opacity", "1");
    await expect(page.locator(".mari-modal-panel")).toHaveCSS("opacity", "1");
    if (testInfo.project.name === "mobile-webkit") {
      await expect(page.locator("html")).toHaveAttribute("data-mari-ios-webkit", "");
      await expect(page.locator(".mari-modal-panel")).toHaveCSS(
        "background-color",
        theme === "dark" ? "rgb(5, 3, 18)" : "rgb(250, 248, 255)",
      );
      await expect(page.locator(".mari-modal-panel")).toHaveCSS("background-image", /linear-gradient\(/);
    }
    await testInfo.attach(`retention-restored-surplus-${theme}`, {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(limit).toHaveValue("3");
    expect(changes).toEqual([{ limit: 5 }]);
    await expect(page.getByText("Could not update extension revision history.", { exact: true })).toHaveCount(0);
    await limit.selectOption("5");
    await page.getByRole("button", { name: "Remove older revisions", exact: true }).click();
    await expect(limit).toHaveValue("5");
    expect(changes).toEqual([{ limit: 5 }, { limit: 5 }, { limit: 5, confirmPrune: true }]);
  });

  test(`mobile connection name stays inside the editor after keyboard pan (${theme})`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Software keyboard behavior is a touch-device concern.");
    const created = await request.post("/api/connections", {
      data: { name: "Keyboard fixture", provider: "custom", model: "fixture", baseUrl: "http://127.0.0.1:9/v1" },
    });
    expect(created.ok()).toBeTruthy();
    const connection = await created.json();
    try {
      await prepare(page, theme);
      await installKeyboardViewport(page);
      await page.goto("/");
      await page.evaluate(async (id) => {
        const module = await import("/src/stores/ui.store.ts" as string);
        module.useUIStore.getState().openConnectionDetail(id);
      }, connection.id);
      const name = page.getByPlaceholder("e.g. Claude Sonnet — RP", { exact: true });
      await expect(name).toHaveValue("Keyboard fixture");
      await name.focus();
      await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
      const hidden = await name.evaluate((field) => {
        const scroll = field.closest<HTMLElement>(".mari-editor-content")!;
        scroll.scrollTop = 110;
        const clipped = field.getBoundingClientRect().top < scroll.getBoundingClientRect().top;
        (window as typeof window & { __keyboardViewport: (height: number, top: number) => void }).__keyboardViewport(
          390,
          100,
        );
        return clipped;
      });
      expect(hidden, "Reproduce the keyboard's initial pan above the inner viewport").toBe(true);
      await expect
        .poll(() =>
          name.evaluate((field) => {
            const rect = field.getBoundingClientRect();
            const scroll = field.closest<HTMLElement>(".mari-editor-content")!.getBoundingClientRect();
            return rect.top >= scroll.top && rect.bottom <= Math.min(scroll.bottom, 490);
          }),
        )
        .toBe(true);
      await name.fill("Visible while typing");
      await expect(name).toBeFocused();
      await expect(name).toHaveValue("Visible while typing");
      await testInfo.attach(`connection-keyboard-${theme}`, {
        body: await page.screenshot(),
        contentType: "image/png",
      });
    } finally {
      await request.delete(`/api/connections/${connection.id}`);
    }
  });
}
