import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedUIState } from "./ui-state-fixture.js";

const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version as string;
test.use({ actionTimeout: 10_000 });
test.beforeEach(async ({ page }) => {
  await page.route("**/api/app-settings/ui", (route) =>
    route.fulfill({ json: route.request().method() === "GET" ? { value: null } : { success: true } }),
  );
  await page.addInitScript((appVersion) => {
    localStorage.setItem("marinara:whats-new:seen-version", appVersion);
  }, version);
  await seedUIState(
    page,
    {
      hasCompletedOnboarding: true,
      sidebarOpen: false,
      rightPanelOpen: false,
      chatHelpSeenModes: ["conversation", "roleplay", "game"],
      appAccentColor: "#16a6b6",
      professorMariNavigationEnabled: false,
    },
    "if-missing",
  );
});

async function openSection(editor: Locator, label: string) {
  const compact = editor.getByRole("button", { name: "Editor sections", exact: true });
  if (await compact.isVisible()) {
    await compact.click();
    await editor.getByRole("menuitemradio", { name: label, exact: true }).click();
  } else {
    await editor
      .getByRole("navigation", { name: "Editor sections" })
      .getByRole("button", { name: label, exact: true })
      .click();
  }
}

async function openEditor(page: Page, kind: string, id: string) {
  await page.evaluate(
    async ({ kind, id }) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState()[`open${kind}Detail`](id);
    },
    { kind, id },
  );
  await expect(page.locator(".mari-editor-shell")).toBeVisible();
}

test("UX sweep: narrow desktop windows use the overlay shell before sidebar topbar controls collide", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"), "Desktop window and docked-sidebar transition.");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.setState({
      sidebarWidth: 400,
      rightPanelWidth: 400,
      sidebarOpen: true,
      rightPanelOpen: true,
      rightPanel: "settings",
    });
  });
  const center = page.locator('[data-component="CenterContent"]');
  await expect(center).not.toHaveAttribute("data-shell-overlay-mode", "true");
  await page.setViewportSize({ width: 1100, height: 900 });
  await expect(center).toHaveAttribute("data-shell-overlay-mode", "true");
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();
  const buttons = await page
    .locator('[data-component="TopBar"] button[data-topbar-hover-key]')
    .evaluateAll((elements) =>
      elements.map((el) => {
        const rect = el.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
    );
  for (let i = 0; i < buttons.length; i++) {
    expect(buttons[i]!.left).toBeGreaterThanOrEqual(0);
    expect(buttons[i]!.right).toBeLessThanOrEqual(1100);
    for (let j = i + 1; j < buttons.length; j++)
      expect(buttons[i]!.right <= buttons[j]!.left || buttons[j]!.right <= buttons[i]!.left).toBe(true);
  }
  await page.locator('[data-topbar-hover-key="chats"]').click();
  await expect(page.locator('[data-component="ChatSidebarPanel"]')).toBeVisible();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toHaveCount(0);
  await page.locator('[data-tour="panel-settings"]').click();
  await expect(page.locator('[data-component="RightPanelMobile"]')).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect(center).not.toHaveAttribute("data-shell-overlay-mode", "true");
  await expect(page.locator('[data-component="RightPanelDesktop"]')).toBeVisible();
});

test("UX sweep: achievement highlights stay inside the widget with padding", async ({ page }, testInfo) => {
  await page.addInitScript(() =>
    localStorage.setItem("marinara:home:widget-visibility:v2", JSON.stringify(["achievements"])),
  );
  await page.goto("/");
  const widget = page.locator('[data-home-widget-id="achievements"]');
  await expect(widget.getByRole("button", { name: "Open Achievements" })).toBeVisible();
  for (const width of testInfo.project.name.includes("mobile") ? [320, 390] : [1440, 1100]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(async () =>
        widget.evaluate((el) => {
          const outer = el.getBoundingClientRect();
          const highlights = Array.from(el.querySelectorAll("[data-achievement-highlight]"));
          return (
            highlights.length === 2 &&
            highlights.every((row) => {
              const rect = row.getBoundingClientRect();
              return rect.left >= outer.left + 12 && rect.right <= outer.right - 12 && rect.bottom <= outer.bottom - 12;
            })
          );
        }),
      )
      .toBe(true);
    await widget.screenshot({ path: testInfo.outputPath(`achievements-${width}.png`) });
  }
});

for (const spec of [
  { kind: "Character", path: "/api/characters", sections: 9, last: "Advanced", lastId: "advanced" },
  { kind: "Persona", path: "/api/characters/personas", sections: 8, last: "Stats", lastId: "stats" },
  { kind: "Lorebook", path: "/api/lorebooks", sections: 2, last: "Entries", lastId: "entries" },
  { kind: "Preset", path: "/api/prompts", sections: 4, last: "Regex", lastId: "regex" },
]) {
  test(`UX sweep: ${spec.kind} sections scroll and leaving saves without discarding a failed draft`, async ({
    page,
    request,
  }, testInfo) => {
    const name = `UX ${spec.kind} ${Date.now()}`;
    const created = await request.post(spec.path, {
      data:
        spec.kind === "Character" ? { data: { name, description: "Saved text" } } : { name, description: "Saved text" },
    });
    expect(created.ok()).toBeTruthy();
    const entity = (await created.json()) as { id: string };
    try {
      await page.goto("/");
      await openEditor(page, spec.kind, entity.id);
      const editor = page.locator(".mari-editor-shell");
      const title =
        spec.kind === "Lorebook"
          ? editor.locator('[data-editor-section="overview"] input').first()
          : editor.locator(".mari-editor-title-input");
      await expect(title).toHaveValue(name);
      await expect(editor.locator("[data-editor-section]")).toHaveCount(spec.sections);
      await openSection(editor, spec.last);
      await expect.poll(() => editor.locator(".mari-editor-content").evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      const last = editor.locator(`[data-editor-section="${spec.lastId}"]`);
      await expect(last).toBeInViewport();
      await expect
        .poll(() => editor.locator(".mari-editor-navigation-tabs [data-active]").getAttribute("aria-label"))
        .toBe(spec.last);
      await editor.locator(".mari-editor-content").evaluate((el) => el.scrollTo({ top: 0, behavior: "instant" }));
      await expect
        .poll(() => editor.locator(".mari-editor-navigation-tabs [data-active]").getAttribute("aria-label"))
        .not.toBe(spec.last);
      await title.fill(`${name} edited`);
      await page.route(`**${spec.path}/${entity.id}`, (route) =>
        route.request().method() === "PATCH" || route.request().method() === "PUT"
          ? route.fulfill({ status: 500, json: { error: "Synthetic autosave failure" } })
          : route.continue(),
      );
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().closeAllDetails();
      });
      await expect(page.getByText(/Synthetic autosave failure|Could not save|Failed to save/i).first()).toBeVisible();
      await expect(title).toHaveValue(`${name} edited`);
      await page.unroute(`**${spec.path}/${entity.id}`);
      await page.screenshot({ path: testInfo.outputPath(`${spec.kind.toLowerCase()}-continuous.png`) });
      await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().closeAllDetails();
      });
      await expect(editor).toHaveCount(0);
      const saved = await (await request.get(`${spec.path}/${entity.id}`)).json();
      const savedName =
        spec.kind === "Character"
          ? (typeof saved.data === "string" ? JSON.parse(saved.data) : saved.data).name
          : saved.name;
      expect(savedName).toBe(`${name} edited`);
      await openEditor(page, spec.kind, entity.id);
      await expect(title).toHaveValue(`${name} edited`);
    } finally {
      await request.delete(`${spec.path}/${entity.id}`);
    }
  });
}

test("UX sweep: Appearance groups, quick access, width and hidden-panel state", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  const modes = page.getByRole("group", { name: "Appearance by chat mode" });
  await expect(modes.locator("button")).toHaveCount(4);
  expect(
    await modes
      .locator("button")
      .evaluateAll((buttons) =>
        buttons.every(
          (button) => button.scrollWidth <= button.clientWidth && getComputedStyle(button).whiteSpace === "nowrap",
        ),
      ),
  ).toBe(true);
  await expect(modes.getByRole("button", { name: "App", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Appearance", exact: true }).locator('[id^="settings-section-"]'),
  ).toHaveCount(4);
  await modes.getByRole("button", { name: "Roleplay", exact: true }).click();
  const panel = page.getByRole("tabpanel", { name: "Appearance", exact: true });
  await expect(panel.locator("#settings-section-roleplay-tracker")).toBeVisible();
  await expect(panel.locator("#settings-section-chat-display")).toHaveCount(0);
  await expect(panel.locator("#settings-section-roleplay-tracker fieldset")).toBeVisible();
  await page.getByPlaceholder("Search settings").fill("Backgrounds");
  await page.getByRole("button", { name: /Backgrounds Section/ }).click();
  await expect(modes.getByRole("button", { name: "App", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator("#settings-section-chat-backgrounds")).toBeInViewport();
  await expect(modes).not.toBeInViewport();
  for (const mode of ["Conversation", "Game"]) {
    await modes.getByRole("button", { name: mode, exact: true }).click();
    await expect(panel.locator("#settings-section-roleplay-tracker")).toHaveCount(0);
    await expect(panel.getByRole("heading", { name: mode, exact: true })).toBeVisible();
  }
  await modes.getByRole("button", { name: "App", exact: true }).click();
  const slider = panel.getByLabel("Desktop sidebar width", { exact: true });
  await slider.fill("280");
  await modes.scrollIntoViewIfNeeded();
  expect(
    await modes
      .locator("button")
      .evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth)),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("appearance-narrow.png") });
  await slider.fill("480");
  await expect(slider).toHaveValue("480");
  await page.screenshot({ path: testInfo.outputPath("appearance-groups.png") });
  await page.getByRole("tab", { name: "General", exact: true }).click();
  await page.getByPlaceholder("Search settings").fill("width draft preserved");
  await page.locator('[data-tour="panel-personas"]').click();
  await page.locator('[data-tour="panel-settings"]').click();
  await expect(page.getByPlaceholder("Search settings")).toHaveValue("width draft preserved");
  await page.reload();
  await page.evaluate(async () => {
    const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
    useUIStore.getState().openRightPanel("settings");
  });
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await expect(page.getByLabel("Desktop sidebar width", { exact: true })).toHaveValue("480");
});

test("UX sweep: Background library mobile toolbar, accent marker and settled modal", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.locator('[data-tour="panel-settings"]').click();
  await page.getByRole("tab", { name: "Appearance", exact: true }).click();
  await page.getByPlaceholder("Search settings").fill("Backgrounds");
  await page.getByRole("button", { name: /Backgrounds Section/ }).click();
  await page.getByRole("button", { name: "Browse library", exact: true }).click();
  const library = page.getByRole("dialog", { name: "Background Library" });
  await expect(library).toBeVisible();
  await expect(library.locator(".mari-modal-panel")).toHaveCSS("transform", "none");
  const search = library.getByPlaceholder("Search backgrounds");
  const sort = library.getByLabel("Sort backgrounds");
  const searchBox = (await search.boundingBox())!;
  const sortBox = (await sort.boundingBox())!;
  expect(searchBox.x + searchBox.width).toBeLessThanOrEqual(sortBox.x);
  if (testInfo.project.name.includes("mobile")) {
    expect(searchBox.width).toBeGreaterThan(190);
    expect(sortBox.width).toBeLessThanOrEqual(44);
  }
  const card = library.locator("[data-background-id]").first();
  await card.locator("[data-background-default-toggle]").click();
  await expect(card.locator("[data-background-default-toggle]")).toHaveAttribute("aria-pressed", "true");
  const useButton = card.getByRole("button", { name: /Use .* for this chat/ });
  await useButton.click();
  await expect(library).toBeHidden();
  await expect(page.getByRole("button", { name: "Clear selection", exact: true })).toHaveAttribute(
    "class",
    (await page.getByRole("button", { name: "Browse library", exact: true }).getAttribute("class"))!,
  );
  await page.getByRole("button", { name: "Browse library", exact: true }).click();
  await expect(library).toHaveCSS("opacity", "1");
  await expect(library.locator(".mari-modal-panel")).toHaveCSS("transform", "none");
  const marker = card.locator("[data-background-selection-indicator]");
  await expect(marker).toBeVisible();
  const markerBox = (await marker.boundingBox())!;
  const cardBox = (await card.boundingBox())!;
  expect(markerBox.x + markerBox.width).toBeGreaterThan(cardBox.x + cardBox.width);
  expect(markerBox.y).toBeLessThan(cardBox.y);
  await page.screenshot({ path: testInfo.outputPath("background-library.png") });
  if (testInfo.project.name === "mobile-webkit") {
    await expect(library.locator(".mari-modal-backdrop")).toHaveCSS("backdrop-filter", "none");
    await expect(library.locator(".mari-modal-panel")).toHaveCSS(
      "background-color",
      await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor),
    );
  }
});

test("UX sweep: home library cards fit equally and widgets open their destinations without hijacking drag handles", async ({
  page,
  request,
}, testInfo) => {
  const characters = await Promise.all(
    ["Daily library fixture", "A character with a much longer name", "Short", "Another daily character"].map(
      async (name, index) =>
        (await (
          await request.post("/api/characters", {
            data: {
              data: {
                name,
                description: "Ready for a conversation. ".repeat(index * 10 + 1),
                creator: index ? "A creator with a long display name" : "",
                tags: ["Long character tag", "Another tag"],
              },
            },
          })
        ).json()) as { id: string },
    ),
  );
  try {
    await page.goto("/");
    await expect(page.locator('[data-home-widget-id="character-library"]')).toHaveCount(0);
    const bookmarks = page.getByRole("button", { name: "Open bookmarks", exact: true });
    if (testInfo.project.name.includes("mobile")) await bookmarks.click();
    await page.getByRole("button", { name: "Widgets", exact: true }).click();
    const libraryOption = page.getByRole("switch", { name: /Show Character Library/ });
    await libraryOption.click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Home Widgets" })).toBeHidden();
    const widget = page.locator('[data-home-widget-id="character-library"]');
    await expect(widget).toBeVisible();
    await expect(widget.locator("[data-card-library-card]")).toHaveCount(4);
    await expect(widget.getByRole("button", { name: /Browse full library|Chat with/ })).toHaveCount(0);
    await expect(widget.locator(".mari-home-widget__drag-handle")).toBeVisible();
    const initialOrder = await widget.getAttribute("style");
    await widget.locator(".mari-home-widget__drag-handle").press("ArrowLeft");
    await expect(widget).not.toHaveAttribute("style", initialOrder!);
    await widget.locator(".mari-home-widget__drag-handle").press("ArrowRight");
    await widget.locator(".mari-home-widget__drag-handle").click();
    await expect(widget.locator(".mari-home-widget__drag-handle")).toBeFocused();
    await expect(page.locator('[data-component="CharacterLibraryView"]')).toHaveCount(0);
    await widget.scrollIntoViewIfNeeded();
    const recent = page.locator('[data-home-widget-id="recent"]');
    expect(Math.abs((await widget.boundingBox())!.height - (await recent.boundingBox())!.height)).toBeLessThan(2);
    expect(Math.abs((await widget.boundingBox())!.width - (await recent.boundingBox())!.width)).toBeLessThan(2);
    const layout = await widget.locator("[data-home-library-grid]").evaluate((grid) => {
      const bounds = grid.getBoundingClientRect();
      return {
        overflow: grid.scrollHeight - grid.clientHeight,
        cards: Array.from(grid.querySelectorAll("[data-card-library-card]"), (card) => {
          const box = card.getBoundingClientRect();
          return {
            width: box.width,
            height: box.height,
            fits: box.bottom <= bounds.bottom + 1 && box.right <= bounds.right + 1,
          };
        }),
      };
    });
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.cards.every((card) => card.fits)).toBe(true);
    expect(
      Math.max(...layout.cards.map((card) => card.height)) - Math.min(...layout.cards.map((card) => card.height)),
    ).toBeLessThan(1);
    expect(
      Math.max(...layout.cards.map((card) => card.width)) - Math.min(...layout.cards.map((card) => card.width)),
    ).toBeLessThan(1);
    await page.screenshot({ path: testInfo.outputPath("character-library-widget.png") });
    const ids = await widget
      .locator("[data-home-library-character]")
      .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-home-library-character")));
    await page.reload();
    await expect(widget).toBeVisible();
    await expect
      .poll(() =>
        widget
          .locator("[data-home-library-character]")
          .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-home-library-character"))),
      )
      .toEqual(ids);
    const selectedId = ids[0]!;
    // Keep the selected character out of the first library page to prove a
    // shortcut reaches it without downloading every intervening page.
    await page.route("**/api/characters/catalog?**", async (route) => {
      if (!new URL(route.request().url()).searchParams.has("sort")) return route.continue();
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({
        response,
        json: { ...data, items: data.items.filter((card: { id: string }) => card.id !== selectedId), hasMore: true },
      });
    });
    await widget.locator(`[data-card-library-card="${selectedId}"]`).click();
    const library = page.locator('[data-component="CharacterLibraryView"]');
    await expect(library).toBeVisible();
    await expect(library.locator(`[data-card-library-card="${selectedId}"]`)).toBeInViewport();
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().characterLibrarySelectedId;
        }),
      )
      .toBe(selectedId);
    await expect(
      library.getByRole("button", { name: "Chat Now", exact: true }).filter({ visible: true }),
    ).toBeVisible();
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 400 });
    for (let attempt = 0; attempt < 2; attempt++) {
      const currentId = await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        return useUIStore.getState().characterLibraryInitialId;
      });
      const nextId = await library.locator("[data-card-library-card]").evaluateAll((cards, current) => {
        const offscreen = cards.find((card) => {
          const bounds = card.getBoundingClientRect();
          return (
            card.getAttribute("data-card-library-card") !== current &&
            (bounds.bottom < 0 || bounds.top >= window.innerHeight)
          );
        });
        return offscreen?.getAttribute("data-card-library-card");
      }, currentId);
      expect(nextId, "The small window must contain an offscreen card to exercise a new scroll target").toBeTruthy();
      await page.evaluate(async (id) => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        useUIStore.getState().openCharacterLibrary(id!);
      }, nextId);
      await expect(library.locator(`[data-card-library-card="${nextId}"]`)).toBeInViewport();
    }
    await page.setViewportSize(viewport);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeCharacterLibrary();
    });
    await expect(widget).toBeVisible();
    await widget.scrollIntoViewIfNeeded();
    const libraryOpen = widget.getByRole("button", { name: "Open Character Library", exact: true });
    if (testInfo.project.name.includes("mobile")) await libraryOpen.tap({ position: { x: 24, y: 48 } });
    else await libraryOpen.click({ position: { x: 24, y: 48 } });
    await expect(library).toBeVisible();
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeCharacterLibrary();
    });
    await recent.scrollIntoViewIfNeeded();
    const recentOpen = recent.getByRole("button", { name: "Open Chats tab", exact: true });
    if (testInfo.project.name.includes("mobile")) await recentOpen.tap({ position: { x: 24, y: 48 } });
    else await recentOpen.click({ position: { x: 24, y: 48 } });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().sidebarOpen;
        }),
      )
      .toBe(true);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().setSidebarOpen(false);
    });
    await recent.getByRole("button", { name: "Open Chats tab", exact: true }).press("Enter");
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          return useUIStore.getState().sidebarOpen;
        }),
      )
      .toBe(true);
  } finally {
    for (const character of characters) await request.delete(`/api/characters/${character.id}`);
  }
});

for (const mode of ["roleplay", "game", "conversation"] as const) {
  test(`UX sweep: ${mode} uses the existing background picker only where supported`, async ({
    page,
    request,
  }, testInfo) => {
    const created = await request.post("/api/chats", {
      data: { name: `UX background ${mode}`, mode, characterIds: [] },
    });
    expect(created.ok()).toBeTruthy();
    const chat = (await created.json()) as { id: string };
    if (mode === "game")
      await request.patch(`/api/chats/${chat.id}/metadata`, {
        data: { gameId: "ux-background-game", gameSessionStatus: "active", gameIntroPresented: true },
      });
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "A quiet afternoon." },
    });
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    try {
      await page.goto("/");
      if (mode === "roleplay") {
        if (!testInfo.project.name.includes("mobile")) {
          const cardColor = await page.evaluate(() => {
            const probe = document.createElement("div");
            probe.style.backgroundColor = "var(--card)";
            document.body.appendChild(probe);
            const color = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return color;
          });
          for (const [trigger, name] of [
            ["Quick Connection Switcher", "Connections"],
            ["Quick Persona Switcher", "Personas"],
          ] as const) {
            await page.getByTitle(trigger, { exact: true }).click();
            const picker = page.getByRole("menu", { name, exact: true });
            await expect(picker).toHaveCSS("background-color", cardColor);
            await picker.screenshot({ path: testInfo.outputPath(`desktop-${name.toLowerCase()}-picker.png`) });
            await picker.press("Escape");
            await expect(picker).toHaveCount(0);
          }
        }
        await page.evaluate(async () => {
          const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
          useChatStore.getState().setShouldOpenWizard(true);
          useChatStore.getState().setShouldOpenSettings(true);
        });
        const wizard = page.locator('[data-component="ChatSetupWizard"]');
        await expect(wizard).toBeVisible();
        await wizard.getByRole("button", { name: "Next", exact: true }).click();
        await expect(wizard.getByRole("heading", { name: "Pick a background", exact: true })).toBeVisible();
        await expect(wizard.locator('img[src*="/api/backgrounds/file/"]')).toBeVisible();
        await wizard.getByRole("button", { name: "Browse library", exact: true }).click();
        await expect(page.getByRole("dialog", { name: "Background Library" })).toBeVisible();
        await page.getByRole("button", { name: "Close Background Library" }).click();
        await page.screenshot({ path: testInfo.outputPath("roleplay-setup-background.png") });
        await wizard.getByRole("button", { name: "Skip", exact: true }).click();
      }
      await page.evaluate(async () => {
        const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
        useChatStore.getState().setShouldOpenSettings(true);
      });
      const drawer = page.locator(".mari-chat-settings-drawer");
      await expect(drawer).toBeVisible();
      if (mode === "conversation") {
        await expect(drawer.locator('[data-chat-settings-section$="-background"]')).toHaveCount(0);
        return;
      }
      const section = drawer.locator(`[data-chat-settings-section="${mode}-background"]`);
      const agents = drawer.locator(`[data-chat-settings-section="${mode}-agents"]`);
      expect(Number(await section.evaluate((el) => getComputedStyle(el).order))).toBeGreaterThan(
        Number(await agents.evaluate((el) => getComputedStyle(el).order)),
      );
      const header = section.locator('[role="button"][aria-expanded]').first();
      await expect(header.locator("svg.lucide-image")).toBeVisible();
      const wasExpanded = await header.getAttribute("aria-expanded");
      await header.getByRole("button", { name: "Show help", exact: true }).click();
      await expect(
        page.getByText(
          "Choose a background for this chat from your library. The preview shows the currently active background.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(header).toHaveAttribute("aria-expanded", wasExpanded!);
      await header.getByRole("button", { name: "Show help", exact: true }).click();
      if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
      await section.getByRole("button", { name: "Browse library", exact: true }).click();
      const library = page.getByRole("dialog", { name: "Background Library" });
      if (mode === "game") await expect(library.locator("[data-background-default-toggle]")).toHaveCount(0);
      else await expect(library.locator("[data-background-default-toggle]").first()).toBeVisible();
      const choice = library.locator('[data-background-id="user:ancient_library.jpg"]');
      await choice.getByRole("button", { name: /Use .* for this chat/ }).click();
      await expect(library).toBeHidden();
      await expect(section.locator('img[src*="ancient_library.jpg"]')).toBeVisible();
      await expect(section.getByRole("button", { name: "Clear selection", exact: true })).toHaveAttribute(
        "class",
        (await section.getByRole("button", { name: "Browse library", exact: true }).getAttribute("class"))!,
      );
      await expect
        .poll(async () => {
          const data = await (await request.get(`/api/chats/${chat.id}`)).json();
          const metadata = typeof data.metadata === "string" ? JSON.parse(data.metadata) : data.metadata;
          return metadata.background;
        })
        .toBe("ancient_library.jpg");
      await page.screenshot({ path: testInfo.outputPath(`${mode}-background-drawer.png`) });
      await page.reload();
      await expect
        .poll(() =>
          page.evaluate(async () => {
            const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
            return useUIStore.getState().chatBackground;
          }),
        )
        .toBe("/api/backgrounds/file/ancient_library.jpg");
    } finally {
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

for (const failed of [false, true]) {
  test(`UX sweep: background picks and clear ${failed ? "reconcile failed saves" : "persist in selection order"}`, async ({
    page,
    request,
  }) => {
    const chat = (await (
      await request.post("/api/chats", { data: { name: "Background save order", mode: "roleplay", characterIds: [] } })
    ).json()) as { id: string };
    expect(
      (await request.patch(`/api/chats/${chat.id}/metadata`, { data: { background: "dark_forest.jpg" } })).ok(),
    ).toBeTruthy();
    await request.post(`/api/chats/${chat.id}/messages`, {
      data: { role: "assistant", content: "A quiet afternoon." },
    });
    await page.addInitScript((id) => localStorage.setItem("marinara-active-chat-id", id), chat.id);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requests: unknown[] = [];
    try {
      await page.goto("/");
      await expect(page.getByText("A quiet afternoon.", { exact: true })).toBeVisible();
      const previous = (await (await request.get(`/api/chats/${chat.id}`)).json()).metadata;
      const previousBackground = (typeof previous === "string" ? JSON.parse(previous) : previous).background;
      expect(previousBackground).toBeTruthy();
      await page.route(`**/api/chats/${chat.id}/metadata`, async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        const data = route.request().postDataJSON();
        if (!Object.hasOwn(data, "background")) return route.continue();
        requests.push(data.background);
        if (requests.length === 1) await gate;
        if (failed) return route.fulfill({ status: 500, json: { error: "Synthetic background save failure" } });
        await route.continue();
      });
      for (const background of ["ancient_library.jpg", "dark_forest.jpg", null]) {
        await page.evaluate(async (name) => {
          const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
          useUIStore.getState().setChatBackground(name ? `/api/backgrounds/file/${name}` : null);
        }, background);
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              const metadata = useChatStore.getState().activeChat?.metadata;
              return (typeof metadata === "string" ? JSON.parse(metadata) : metadata)?.background;
            }),
          )
          .toBe(background);
      }
      // The older request is held before reaching the server. Newer choices must
      // remain queued even though their optimistic UI updates are already visible.
      expect(requests).toEqual(["ancient_library.jpg"]);
      const cleared = page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/chats/${chat.id}/metadata`) &&
          response.request().method() === "PATCH" &&
          response.request().postDataJSON().background === null &&
          (failed ? response.status() === 500 : response.ok()),
      );
      release();
      await cleared;
      expect(requests).toEqual(["ancient_library.jpg", "dark_forest.jpg", null]);
      const saved = (await (await request.get(`/api/chats/${chat.id}`)).json()).metadata;
      expect((typeof saved === "string" ? JSON.parse(saved) : saved).background).toBe(
        failed ? previousBackground : null,
      );
      if (failed) {
        await expect
          .poll(() =>
            page.evaluate(async () => {
              const { useChatStore } = await import("/src/stores/chat.store.ts" as string);
              const metadata = useChatStore.getState().activeChat?.metadata;
              return (typeof metadata === "string" ? JSON.parse(metadata) : metadata)?.background;
            }),
          )
          .toBe(previousBackground);
      }
      await page.reload();
      await expect(page.getByText("A quiet afternoon.", { exact: true })).toBeVisible();
      const restored = await page.evaluate(async () => {
        const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
        const { chatBackground, defaultRoleplayBackground } = useUIStore.getState();
        return { chatBackground, defaultRoleplayBackground };
      });
      expect(restored.chatBackground).toBe(
        failed ? "/api/backgrounds/file/dark_forest.jpg" : restored.defaultRoleplayBackground,
      );
    } finally {
      release();
      await page.unrouteAll({ behavior: "wait" });
      await request.delete(`/api/chats/${chat.id}`);
    }
  });
}

test("UX sweep: leaving a focused preset prompt flushes its pending autosave", async ({ page, request }) => {
  const preset = (await (await request.post("/api/prompts", { data: { name: "Prompt draft" } })).json()) as {
    id: string;
  };
  await request.post(`/api/prompts/${preset.id}/sections`, {
    data: { identifier: "ux-draft", name: "Prompt draft section", content: "Original prompt" },
  });
  try {
    await page.goto("/");
    await openEditor(page, "Preset", preset.id);
    const editor = page.locator(".mari-editor-shell");
    await openSection(editor, "Sections");
    await editor.getByText("Prompt draft section", { exact: true }).click();
    const prompt = editor.locator('[data-editor-section="sections"] textarea').filter({ visible: true });
    await expect(prompt).toHaveValue("Original prompt");
    await prompt.fill("Prompt edited immediately before leaving");
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
    });
    await expect(editor).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (await (await request.get(`/api/prompts/${preset.id}/sections`)).json()).find(
            (s: { identifier: string }) => s.identifier === "ux-draft",
          )?.content,
      )
      .toBe("Prompt edited immediately before leaving");
  } finally {
    await request.delete(`/api/prompts/${preset.id}`);
  }
});

test("UX sweep: pending editor saves cannot discard edits made during the request", async ({ page, request }) => {
  const preset = (await (await request.post("/api/prompts", { data: { name: "Concurrent draft" } })).json()) as {
    id: string;
  };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saveStarted = false;
  try {
    await page.goto("/");
    await openEditor(page, "Preset", preset.id);
    const title = page.locator(".mari-editor-title-input");
    await title.fill("First draft");
    await page.route(`**/api/prompts/${preset.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      saveStarted = true;
      await gate;
      await route.continue();
    });
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
    });
    await expect.poll(() => saveStarted).toBe(true);
    await title.fill("Newer draft");
    release();
    await expect
      .poll(async () => (await (await request.get(`/api/prompts/${preset.id}`)).json()).name)
      .toBe("First draft");
    await expect(title).toHaveValue("Newer draft");
    await page.unroute(`**/api/prompts/${preset.id}`);
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
    });
    await expect(page.locator(".mari-editor-shell")).toHaveCount(0);
    expect((await (await request.get(`/api/prompts/${preset.id}`)).json()).name).toBe("Newer draft");
  } finally {
    release();
    await request.delete(`/api/prompts/${preset.id}`);
  }
});

for (const spec of [
  { kind: "Character", path: "/api/characters" },
  { kind: "Persona", path: "/api/characters/personas" },
]) {
  test(`UX sweep: ${spec.kind} media sections load on approach and remain mounted`, async ({ page, request }) => {
    const entity = (await (
      await request.post(spec.path, {
        data: spec.kind === "Character" ? { data: { name: "Deferred media" } } : { name: "Deferred media" },
      })
    ).json()) as { id: string };
    let galleryRequests = 0;
    page.on("request", (incoming) => {
      if (new URL(incoming.url()).pathname === `${spec.path}/${entity.id}/gallery`) galleryRequests++;
    });
    try {
      await page.goto("/");
      await openEditor(page, spec.kind, entity.id);
      const editor = page.locator(".mari-editor-shell");
      const gallery = editor.locator('[data-editor-section="gallery"]');
      await expect(gallery).toHaveAttribute("aria-busy", "true");
      expect(galleryRequests).toBe(0);
      await openSection(editor, "Gallery");
      await expect(gallery).toHaveAttribute("aria-busy", "false");
      await expect.poll(() => galleryRequests).toBeGreaterThan(0);
      const firstControl = gallery.getByRole("button").first();
      await firstControl.evaluate((element) => element.setAttribute("data-ux-retained", "true"));
      const scroller = editor.locator(".mari-editor-content");
      await scroller.evaluate(async (element) => {
        element.dispatchEvent(new Event("wheel"));
        element.scrollTop = 0;
        (element.firstElementChild as HTMLElement).style.paddingBottom = "1px";
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      expect(await scroller.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(firstControl).toHaveAttribute("data-ux-retained", "true");
    } finally {
      await request.delete(`${spec.path}/${entity.id}`);
    }
  });
}

test("UX sweep: the latest navigation wins while the editor autosave is pending", async ({ page, request }) => {
  const presets = await Promise.all(
    ["Pending origin", "Latest destination"].map(
      async (name) => (await (await request.post("/api/prompts", { data: { name } })).json()) as { id: string },
    ),
  );
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let saveStarted = false;
  try {
    await page.goto("/");
    await openEditor(page, "Preset", presets[0]!.id);
    await page.locator(".mari-editor-title-input").fill("Saved before navigation");
    await page.route(`**/api/prompts/${presets[0]!.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      saveStarted = true;
      await gate;
      await route.continue();
    });
    await page.evaluate(async () => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().closeAllDetails();
    });
    await expect.poll(() => saveStarted).toBe(true);
    await page.evaluate(async (id) => {
      const { useUIStore } = await import("/src/stores/ui.store.ts" as string);
      useUIStore.getState().openPresetDetail(id);
    }, presets[1]!.id);
    const sourceSave = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/prompts/${presets[0]!.id}`) &&
        response.request().method() === "PATCH" &&
        response.ok(),
    );
    release();
    await sourceSave;
    await expect(page.locator(".mari-editor-title-input")).toHaveValue("Latest destination");
    expect((await (await request.get(`/api/prompts/${presets[0]!.id}`)).json()).name).toBe("Saved before navigation");
  } finally {
    release();
    for (const preset of presets) await request.delete(`/api/prompts/${preset.id}`);
  }
});

test("UX sweep: adding a lorebook entry reveals the new row in a long list", async ({ page, request }) => {
  const book = (await (await request.post("/api/lorebooks", { data: { name: "Entry navigation" } })).json()) as {
    id: string;
  };
  try {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        request.post(`/api/lorebooks/${book.id}/entries`, {
          data: { name: `Existing ${index}`, content: "Existing content", order: index },
        }),
      ),
    );
    await page.goto("/");
    await openEditor(page, "Lorebook", book.id);
    const response = page.waitForResponse(
      (r) => r.url().endsWith(`/api/lorebooks/${book.id}/entries`) && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add Entry", exact: true }).click();
    const entry = (await (await response).json()) as { id: string };
    const row = page.locator(`[data-lorebook-entry-row-id="${entry.id}"]`);
    await expect(row).toBeInViewport();
    await expect(row.locator("textarea").first()).toBeVisible();
  } finally {
    await request.delete(`/api/lorebooks/${book.id}`);
  }
});
