// ──────────────────────────────────────────────
// UI check: the screens it opens, and the test data that fills them
// ──────────────────────────────────────────────
// Each screen opens through the app's own store actions (lib/ui-check-hook.ts), the same ones a click runs, so one
// list works on desktop, tablet and phone. `then` opens something on top (a window, a drawer, a menu) with real
// clicks. After opening, the check also walks every tab of the page (an editor's tabs, Settings' tabs).
//
// Adding a page to the app? Add it here. Names stay long on purpose: long names are what break layouts.

import { readFileSync } from "node:fs";

export const LONG_NAME =
  "A Ridiculously Long Name That Goes On And On Because Nobody Could Decide What To Call It v12 FINAL final2";
export const UNBROKEN = "Supercalifragilistic_OneUnbrokenWordWithNoSpacesAtAllThatKeepsGoingAndGoingAndGoing_v3";
const PARAGRAPH =
  "She keeps the lantern lit through the storm, counting the waves against the harbour wall. Nobody remembers when the keeper before her left, or why the logbook stops halfway through a sentence. ";

/** Makes the test data through the API. Returns the ids the screens open. */
export async function seedFixtures(api) {
  const ids = {};
  const character = await api.post("/api/characters", {
    data: {
      name: LONG_NAME,
      description: PARAGRAPH.repeat(8),
      personality: PARAGRAPH.repeat(3),
      scenario: PARAGRAPH.repeat(2),
      first_mes: PARAGRAPH.repeat(4),
      creator_notes: PARAGRAPH.repeat(2),
      tags: [
        UNBROKEN,
        "fantasy",
        "slow burn",
        "lighthouse",
        "mystery",
        "found family",
        "drama",
        "a very long tag name indeed",
      ],
    },
  });
  ids.character = character.id;
  const second = await api.post("/api/characters", { data: { name: UNBROKEN, description: PARAGRAPH } });
  ids.character2 = second.id;
  for (let i = 0; i < 14; i++)
    await api.post("/api/characters", { data: { name: `Harbour regular ${i + 1}`, description: PARAGRAPH } });
  ids.persona = (await api.post("/api/characters/personas", { name: UNBROKEN, description: PARAGRAPH.repeat(4) })).id;
  await api.post("/api/characters/personas", { name: LONG_NAME, description: PARAGRAPH });

  const book = await api.post("/api/lorebooks", { name: LONG_NAME, description: PARAGRAPH });
  ids.lorebook = book.id;
  for (let i = 0; i < 24; i++) {
    await api.post(`/api/lorebooks/${book.id}/entries`, {
      name: i === 0 ? LONG_NAME : `Harbour entry ${i + 1}`,
      content: PARAGRAPH.repeat((i % 3) + 1),
      keys: i === 1 ? [UNBROKEN] : ["harbour", `entry${i}`, "lantern"],
    });
  }
  // Enough books that the game setup's entry picker draws a page of them and offers "Show more" (#9645).
  for (let i = 0; i < 45; i++) {
    const shelf = await api.post("/api/lorebooks", { name: `Harbour shelf ${i + 1}` });
    await api.post(`/api/lorebooks/${shelf.id}/entries`, { name: `Shelf note ${i + 1}`, content: PARAGRAPH, keys: [] });
  }
  const presets = await api.get("/api/prompts");
  ids.preset = presets[0]?.id;
  ids.regex = // A trim string, so the editor shows its "Trim from" row too.
    (
      await api.post("/api/regex-scripts", {
        name: LONG_NAME,
        findRegex: UNBROKEN,
        placement: ["ai_output"],
        trimStrings: ["(OOC:", ")"],
        trimScope: "match",
      })
    ).id;
  ids.tool = (
    await api.post("/api/custom-tools", {
      name: `harbour_tide_table_${Date.now().toString(36)}`,
      description: PARAGRAPH,
      executionType: "static",
      staticResult: "ok",
    })
  ).id;
  // Settings profiles: a long-named one in a folder, so the list shows a folder, both modes and the built-ins.
  ids.profile = (
    await api.post("/api/chat-presets", {
      name: LONG_NAME,
      mode: "roleplay",
      settings: { metadata: { activeToolIds: ["roll_dice"], enableTools: true } },
    })
  ).id;
  await api.post("/api/chat-presets", { name: "Harbour texting", mode: "conversation", settings: {} });
  const profileFolder = await api.post("/api/library-folders/profiles", { name: LONG_NAME });
  await api.post("/api/library-folders/profiles/move", { itemIds: [ids.profile], folderId: profileFolder.id });
  const account = await api.post("/api/connection-accounts", {
    provider: "openai",
    name: `UI check ${LONG_NAME}`,
    apiKey: "fixture-not-a-real-key",
    baseUrl: "http://127.0.0.1:9/v1",
    model: "gpt-5.5",
  });
  ids.connection = account.connectionId;
  ids.account = account.account?.id;
  // An image Model: its editor has no "More" card (every field there is for text Models).
  ids.imageConnection = (
    await api.post("/api/connections", {
      name: "UI check NovelAI",
      provider: "image_generation",
      imageGenerationSource: "novelai",
      imageService: "novelai",
      apiKey: "fixture-not-a-real-key",
      baseUrl: "https://image.novelai.net",
      model: "nai-diffusion-4-5-full",
    })
  ).id;

  for (const mode of ["conversation", "roleplay"]) {
    const chat = await api.post("/api/chats", {
      name: mode === "roleplay" ? LONG_NAME : `Harbour chat`,
      mode,
      characterIds: [character.id],
      connectionId: account.connectionId,
    });
    ids[`${mode}Chat`] = chat.id;
    for (let i = 0; i < 14; i++) {
      await api.post(`/api/chats/${chat.id}/messages`, {
        role: i % 2 ? "assistant" : "user",
        content: i === 3 ? `${UNBROKEN} ${PARAGRAPH.repeat(3)}` : PARAGRAPH.repeat((i % 3) + 1),
        ...(i % 2 ? { characterId: character.id } : {}),
      });
    }
  }
  // A ruleset, so Library › Assets › Rulesets has a row to open. Imports are switched on only for the import.
  await api.patch("/api/agents/import-policy", { enabled: true });
  try {
    const gravewatch = JSON.parse(
      readFileSync(new URL("../../docs/examples/rulesets/gravewatch.json", import.meta.url), "utf8"),
    );
    gravewatch.id = "ui-check-gravewatch";
    ids.ruleset = (await api.post("/api/game-rulesets/import", { definition: JSON.stringify(gravewatch) })).rulesetId;
  } finally {
    await api.patch("/api/agents/import-policy", { enabled: false });
  }
  return ids;
}

/** Library › Assets: switches the page to List (or Gallery) view, when it has the switch. */
async function pickView(page, label) {
  const button = page.getByRole("button", { name: label, exact: true }).filter({ visible: true });
  if (!(await button.count())) return false;
  await button.first().click();
  await page.waitForTimeout(300);
  return true;
}

/**
 * Opens an item on a Library › Assets page with a real click, in Gallery or List view. A click that crashes the app
 * shows the "recoverable UI error" screen, which the check reports as a crash (Nov 22: clicking a background did).
 */
const openAsset =
  ({ view, item, opened }) =>
  async (page) => {
    if (view && !(await pickView(page, view))) return `no ${view} view on this layout`;
    const target = page.locator(item).filter({ visible: true }).first();
    await target.waitFor({ timeout: 10_000 }).catch(() => {});
    if (!(await target.count())) return "nothing to open";
    await target.click();
    await page.locator(`${opened}, [data-app-recovery]`).first().waitFor({ state: "visible", timeout: 10_000 });
  };

const hook = (fn, arg) => [fn.toString(), arg];
/** A screen that opens a piece of test data: skipped when the data isn't there (--url without --seed). */
const needsData = (run) => [...run, "needs-data"];

/** Store actions run in the page. `h` is window.__marinaraUiCheck. */
const open = {
  library: (section) =>
    hook((section) => {
      const h = window.__marinaraUiCheck;
      h.openLibrarySection(section);
      if (!h.overhaul.getState().desktop) h.overhaul.getState().setMobileSidePageOpen(false);
    }, section),
  settings: (tab) =>
    hook((tab) => {
      const h = window.__marinaraUiCheck;
      h.openLibrarySection("settings");
      h.overhaul.getState().setSettingsTab(tab);
    }, tab),
  detail: (action, id) =>
    needsData(
      hook(
        ([action, id]) => {
          window.__marinaraUiCheck.ui.getState()[action](id);
        },
        [action, id],
      ),
    ),
  chat: (key) =>
    needsData(
      hook((id) => {
        const h = window.__marinaraUiCheck;
        h.chat.getState().setActiveChatId(id);
        // Phones: the chat, not the Chats page over it.
        h.overhaul.getState().setMobileSidePageOpen(false);
      }, key),
    ),
  mari: (folded) =>
    hook((folded) => {
      const h = window.__marinaraUiCheck;
      h.ui.getState().setProfessorMariSuggestionsCollapsed?.(folded);
      h.overhaul.getState().openMari();
      // Phones: Mari's page, not the Chats page over it.
      h.overhaul.getState().setMobileSidePageOpen(false);
    }, folded),
  sidePane: (pane) =>
    hook((pane) => {
      const h = window.__marinaraUiCheck;
      h.overhaul.getState().setSidePane(pane);
      if (!h.overhaul.getState().desktop) h.overhaul.getState().setMobileSidePageOpen(true);
    }, pane),
};

const SETTINGS_TABS = [
  "general",
  "chatting",
  "appearance",
  "conversation",
  "roleplay",
  "game",
  "media",
  "data",
  "advanced",
];

/**
 * id: stable name in reports. group: "core" screens also run in every theme.
 * run: [function source, argument] for page.evaluate, or null (Home). ids: fixture key the argument comes from.
 * then: real clicks after the page shows (the windows and drawers that open on top).
 * ready: a selector to wait for after run, for a screen that takes several steps to show.
 */
export function screenList(ids) {
  return [
    { id: "home", group: "core", run: null },
    {
      id: "home-large-text",
      group: "core",
      // Settings > Appearance text size 20 (large text): Home's text unclamps and wraps, the layout it has to survive.
      run: hook(() => window.__marinaraUiCheck.ui.getState().setFontSize(20)),
    },
    {
      id: "settings-home-widgets",
      // Settings › General › Home, where the new layout chooses Home's widgets (every size).
      run: open.settings("general"),
      then: async (page) => {
        const section = page.locator("#settings-section-home").first();
        // Phones list the Settings tabs first; General opens as its own page.
        if (!(await section.count())) {
          const general = page.getByRole("button", { name: /^General\b/ }).filter({ visible: true });
          if (await general.count()) await general.first().click();
          await section.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
        }
        if (!(await section.count())) return "not on this layout";
        await section.scrollIntoViewIfNeeded();
      },
    },
    { id: "chats-list", group: "core", run: open.sidePane("chats") },
    { id: "library-pane", run: open.sidePane("library") },
    { id: "characters", group: "core", run: open.library("characters") },
    { id: "personas", run: open.library("personas") },
    { id: "lorebooks", run: open.library("lorebooks") },
    { id: "presets", run: open.library("presets") },
    { id: "profiles", run: open.library("profiles") },
    { id: "regex", run: open.library("regex") },
    {
      // The regex Import window: several files at once, results listed in the window.
      id: "regex-import",
      run: open.library("regex"),
      then: async (page) => {
        const button = page.getByRole("button", { name: "Import", exact: true }).filter({ visible: true });
        if (!(await button.count())) return "not on this layout";
        await button.first().click();
        await page.locator("[data-import-regex-modal]").first().waitFor({ state: "visible", timeout: 8000 });
      },
    },
    {
      // The chat Import window with its "Open as" row (Roleplay or Conversation).
      id: "chat-import",
      run: open.sidePane("chats"),
      then: async (page) => {
        const name = "Import SillyTavern or Marinara chat JSONL";
        const direct = page.getByRole("button", { name, exact: true }).filter({ visible: true });
        // Phones and portrait tablets: it sits in the Chats list's menu.
        const menu = page
          .getByRole("button", { name: "More chat list options", exact: true })
          .filter({ visible: true });
        // The tablet shell can settle a moment after the list opens.
        await direct
          .or(menu)
          .first()
          .waitFor({ state: "visible", timeout: 8000 })
          .catch(() => {});
        if (await direct.count()) {
          await direct.first().click();
        } else {
          if (!(await menu.count())) return "not on this layout";
          await menu.first().click();
          const item = page.getByRole("menuitem").filter({ hasText: "Import" }).filter({ visible: true });
          await item
            .first()
            .waitFor({ state: "visible", timeout: 5000 })
            .catch(() => {});
          if (!(await item.count())) return "not on this layout";
          await item.first().click();
        }
        await page.locator("[data-import-chat-modal]").first().waitFor({ state: "visible", timeout: 8000 });
      },
    },
    {
      // Settings > Import from SillyTavern folder: the window before a folder is picked.
      id: "st-folder-import",
      run: hook(() => window.__marinaraUiCheck.ui.getState().openModal("st-bulk-import")),
    },
    {
      // The keyboard shortcuts list, with the ←/→ row dimmed while its setting is off.
      id: "keyboard-shortcuts",
      run: hook(() => window.__marinaraUiCheck.ui.getState().openModal("keyboard-shortcuts")),
    },
    { id: "connections", group: "core", run: open.library("connections") },
    // The Add account menu as Home's "Connect a model" opens it (centred, not the old tile grid), and its key step
    // for a service at an address that already has an account ("You already have …").
    {
      id: "add-connection",
      run: hook(() => window.__marinaraUiCheck.ui.getState().openModal("create-connection")),
      ready: "[data-add-connection-step]",
    },
    {
      id: "add-connection-existing",
      run: needsData(
        // The fixture's OpenAI account (ids.account) sits at this address; the id only marks the data as needed.
        hook(
          () =>
            window.__marinaraUiCheck.ui
              .getState()
              .openModal("create-connection", { service: "openai", baseUrl: "http://127.0.0.1:9/v1" }),
          ids.account,
        ),
      ),
      ready: "[data-add-connection-existing]",
    },
    {
      // The Image reading job's settings window (from its picker): its prompt, request and answer limits.
      id: "image-reading-settings",
      run: open.library("connections"),
      then: async (page) => {
        const tile = page.locator(".ov-conn-defaults__cell", { hasText: "Image reading" }).first();
        const row = page.locator("[data-picker-job-settings]").filter({ visible: true }).first();
        // Phones: the tile sits low in a long page and its sheet slides up, so try again once it has settled.
        for (let attempt = 0; attempt < 3 && !(await row.count()); attempt++) {
          await tile.scrollIntoViewIfNeeded();
          await tile.click({ timeout: 10_000 }).catch(() => {});
          await row.waitFor({ timeout: 5_000 }).catch(() => {});
        }
        await row.click();
        await page.getByRole("textbox", { name: "Instructions", exact: true }).waitFor();
      },
    },
    {
      // Dictation's Defaults tile opens its settings page (it once did nothing: it has no Model to pick).
      id: "dictation-settings",
      run: open.library("connections"),
      then: async (page) => {
        const tile = page.locator(".ov-conn-defaults__cell", { hasText: "Dictation" }).first();
        await tile.scrollIntoViewIfNeeded();
        await tile.click({ timeout: 10_000 });
        await page.locator('[data-component="JobSettingsPage"][data-job="stt"]').waitFor({ timeout: 10_000 });
      },
    },
    // Library > Settings profiles > Image settings, one screen per section (phones: that section's page).
    ...["defaults", "styles", "canvases", "prompts"].map((tab) => ({
      id: `image-settings-${tab}`,
      group: tab === "defaults" ? "core" : undefined,
      run: hook((tab) => {
        const h = window.__marinaraUiCheck;
        h.ui.getState().openImageSettings(tab);
        if (!h.overhaul.getState().desktop) h.overhaul.getState().setMobileSidePageOpen(false);
      }, tab),
      ready: '[data-component="ImageSettingsPage"]',
    })),
    { id: "agents", run: open.library("agents") },
    { id: "tools", run: open.library("tools") },
    { id: "extensions", run: open.library("extensions") },
    ...SETTINGS_TABS.map((tab) => ({
      id: `settings-${tab}`,
      group: tab === "appearance" ? "core" : undefined,
      run: open.settings(tab),
      walkTabs: false,
    })),
    { id: "character-editor", group: "core", run: open.detail("openCharacterDetail", ids.character) },
    { id: "persona-editor", run: open.detail("openPersonaDetail", ids.persona) },
    { id: "lorebook-editor", group: "core", run: open.detail("openLorebookDetail", ids.lorebook) },
    {
      // One entry open: on a 375px phone its Normal / Constant / Selective row once ran 8px past the screen.
      id: "lorebook-entry",
      run: open.detail("openLorebookDetail", ids.lorebook),
      then: async (page) => {
        const row = page
          .locator("[data-lorebook-entry-row-id]")
          // Entry 3: entry 2's long unbroken key fills its row, and a tap there opens the keyword panel instead.
          .filter({ visible: true, hasText: /^Harbour entry 3(?!\d)/ })
          .first();
        if (!(await row.count())) return "no entry row to open";
        // Phones and tablets open an entry on a tap (a mouse click there only selects the row).
        const box = await row.boundingBox();
        const at = { x: box.x + Math.min(120, box.width * 0.3), y: box.y + box.height / 2 };
        await page.touchscreen.tap(at.x, at.y).catch(() => page.mouse.click(at.x, at.y));
        await page.locator(".ov-lentry").first().waitFor({ state: "visible", timeout: 8000 });
      },
    },
    { id: "preset-editor", run: open.detail("openPresetDetail", ids.preset) },
    { id: "regex-editor", run: open.detail("openRegexDetail", ids.regex) },
    { id: "tool-editor", run: open.detail("openToolDetail", ids.tool) },
    { id: "profile-editor", run: open.detail("openProfileDetail", ids.profile) },
    { id: "profile-new", run: open.detail("openProfileDetail", "new:roleplay") },
    { id: "connection-editor", run: open.detail("openConnectionDetail", ids.connection) },
    { id: "image-connection-editor", run: open.detail("openConnectionDetail", ids.imageConnection) },
    { id: "agent-editor", run: open.detail("openAgentDetail", "illustrator") },
    { id: "conversation-chat", group: "core", run: open.chat(ids.conversationChat) },
    { id: "roleplay-chat", group: "core", run: open.chat(ids.roleplayChat) },
    {
      id: "roleplay-chat-settings",
      group: "core",
      // The same request the app makes when it brings Chat settings back after a full-page editor.
      run: needsData(
        hook((id) => {
          const h = window.__marinaraUiCheck;
          h.chat.getState().setActiveChatId(id);
          h.overhaul.getState().setMobileSidePageOpen(false);
          setTimeout(() => h.ui.setState({ chatSettingsRequest: { chatId: id, section: null } }), 600);
        }, ids.roleplayChat),
      ),
    },
    {
      // Phones and tablets: a Chat settings section opened as its own page, scrolled so its header is stuck.
      // Advanced Parameters sits in a wrapper, which once kept the scroller's top padding as a strip above it.
      id: "roleplay-chat-settings-section",
      group: "core",
      ready: "[data-ui-check-ready]",
      run: needsData(
        hook((id) => {
          const h = window.__marinaraUiCheck;
          h.chat.getState().setActiveChatId(id);
          h.overhaul.getState().setMobileSidePageOpen(false);
          setTimeout(() => h.ui.setState({ chatSettingsRequest: { chatId: id, section: null } }), 600);
          // Step by step as each part shows, quickly enough that the check never settles in between.
          // Keeps the page open and scrolled (a refetch while other screens load can redraw it), and says ready once
          // that has held for a moment. A computer has no section pages: Chat settings as it opens is the screen.
          const started = Date.now();
          let held = 0;
          const ready = () => document.documentElement.setAttribute("data-ui-check-ready", "");
          const step = setInterval(() => {
            const elapsed = Date.now() - started;
            if (elapsed > 6000) ready();
            if (elapsed > 20000) return clearInterval(step);
            // The chats list can come back over the chat while it opens.
            h.overhaul.getState().setMobileSidePageOpen(false);
            if (!document.querySelector('.ov-cs [data-drawer="advanced-parameters"]')) return;
            const head = document.querySelector(".ovm-cs-page[data-ovm-cs-current] .ovm-cs-page__body");
            if (!head) return h.chatSettingsNav.getState().showPage("advanced-parameters");
            let scroller = head.parentElement;
            while (scroller && !/auto|scroll/.test(getComputedStyle(scroller).overflowY))
              scroller = scroller.parentElement;
            if (scroller && scroller.scrollTop < 150) scroller.scrollTop = 160;
            if (++held >= 8) ready();
          }, 100);
        }, ids.roleplayChat),
      ),
    },
    // New layout: Chat Variables, Agent Suite, Memories and Summaries as pages inside Chat settings.
    ...["variables", "agent-suite", "memories", "summaries"].map((subpage) => ({
      id: `chat-settings-${subpage}`,
      group: subpage === "variables" ? "core" : undefined,
      ready: ".ov-cs-sub__body",
      run: needsData(
        hook(
          ([id, subpage]) => {
            const h = window.__marinaraUiCheck;
            h.chat.getState().setActiveChatId(id);
            h.overhaul.getState().setMobileSidePageOpen(false);
            setTimeout(() => h.openChatSettingsSubpage(id, subpage), 600);
          },
          [ids.roleplayChat, subpage],
        ),
      ),
    })),
    // Professor Mari's own page: the suggestions box above her composer, open and folded, and the composer.
    { id: "professor-mari", group: "core", run: open.mari(false) },
    {
      id: "professor-mari-folded",
      run: open.mari(true),
    },
    // New-chat setup, the page in the new chat's own tab (last: each one leaves a draft chat behind).
    ...["roleplay", "conversation"].map((mode) => ({
      id: `new-${mode}-setup`,
      group: mode === "roleplay" ? "core" : undefined,
      run: null,
      then: async (page) => {
        const button = page.getByRole("button", { name: `Start a new ${mode}` }).filter({ visible: true });
        if (!(await button.count())) return "not on this layout";
        await button.first().click();
        await page.waitForSelector("[data-setup-page]", { timeout: 15_000 });
      },
    })),
    {
      // New Game setup, the page in the game's own tab (E1, 2026-11-22): Game, World, Party, Goals, the Start bar.
      id: "new-game-setup",
      group: "core",
      run: null,
      then: async (page) => {
        const button = page.getByRole("button", { name: "Start a new game" }).filter({ visible: true });
        await button
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        if (!(await button.count())) return "not on this layout";
        await button.first().click();
        await page.waitForSelector('[data-setup-page="game"]', { timeout: 20_000 });
      },
    },
    {
      // New game > Lorebooks with "Select individual entries" open and one book opened (#9645): a searchable list of
      // books drawn a page at a time, each book's entries read only when it is opened.
      id: "new-game-lore-entries",
      run: null,
      then: async (page) => {
        const button = page.getByRole("button", { name: "Start a new game" }).filter({ visible: true });
        // Home can still be drawing its shortcuts when the screen opens.
        await button
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        if (!(await button.count())) return "not on this layout";
        await button.first().click();
        // The setup page in the game's own tab: Lorebooks are under "+ More options".
        const wizard = page.locator('[data-setup-page="game"]');
        await wizard.waitFor({ state: "visible", timeout: 20_000 });
        await wizard.getByRole("button", { name: /More options/ }).click();
        await wizard.getByRole("button", { name: "Select individual entries", exact: true }).click();
        const books = wizard.locator('[data-component="GameSetupLoreEntryPicker.Books"]');
        // The long-named book with 24 entries; the shelves fill the first page, so it is found by search.
        await wizard.getByPlaceholder("Search lorebooks…").last().fill("Ridiculously");
        await books.getByRole("button").filter({ hasText: "Ridiculously" }).first().click();
        await wizard.getByRole("checkbox").first().waitFor({ state: "visible", timeout: 8000 });
        await wizard.getByRole("checkbox").first().check();
      },
    },
    {
      id: "omnibar",
      run: hook(() => window.__marinaraUiCheck.ui.getState().setOmnibarOpen(true)),
      then: async (page) => page.keyboard.type("set"),
    },
    // Library › Assets: Backgrounds, Game assets and Rulesets are tabs of one Library row.
    { id: "library-backgrounds", run: open.library("backgrounds") },
    { id: "library-game-assets", run: open.library("game-assets") },
    { id: "library-rulesets", run: open.library("rulesets") },
    // Each Assets page with an item opened by a click, in both views (the Backgrounds click crashed the app, Nov 22).
    {
      id: "library-background-open",
      run: open.library("backgrounds"),
      walkTabs: false,
      then: openAsset({
        view: "Gallery",
        item: "[data-component=OverhaulBackgroundsPage] .ov-bglib__card .ov-card__art",
        opened: "[data-component=BackgroundDetail]",
      }),
    },
    {
      id: "library-background-open-list",
      run: open.library("backgrounds"),
      walkTabs: false,
      then: openAsset({
        view: "List",
        item: "[data-component=OverhaulBackgroundsPage] tbody tr:not([data-background-folder-id])",
        opened: "[data-component=BackgroundDetail]",
      }),
    },
    {
      // The bundled CREDITS.md at the top of Game assets: a text file opens in the right pane.
      id: "library-game-asset-open",
      run: open.library("game-assets"),
      walkTabs: false,
      then: openAsset({
        view: "Gallery",
        item: 'main :text-is("CREDITS.md")',
        opened: '[data-component="GameAssetFileEditor"]',
      }),
    },
    {
      id: "library-game-asset-open-list",
      run: open.library("game-assets"),
      walkTabs: false,
      then: openAsset({
        view: "List",
        item: 'main :text-is("CREDITS.md")',
        opened: '[data-component="GameAssetFileEditor"]',
      }),
    },
    {
      id: "library-ruleset-open",
      run: open.library("rulesets"),
      walkTabs: false,
      then: openAsset({
        item: '.ov-vw__row[role=option]:has-text("Gravewatch")',
        opened: '[data-component="RulesetSummary"]',
      }),
    },
    {
      // A new text file opens in the page's right pane with the shared editor header (no window).
      id: "game-asset-file-editor",
      run: open.library("game-assets"),
      then: async (page) => {
        const head = page.locator('[data-ov-anchor="game-assets-new"]').filter({ visible: true });
        await head.first().waitFor({ timeout: 10_000 });
        await head.first().click();
        await page
          .locator("button, [role=menuitem]", { hasText: /text file/i })
          .filter({ visible: true })
          .first()
          .click();
        await page.locator("input").filter({ visible: true }).last().fill(`ui-check-${Date.now()}`);
        await page.keyboard.press("Enter");
        await page.locator('[data-component="GameAssetFileEditor"]').waitFor({ state: "visible", timeout: 10_000 });
      },
    },
    {
      // Rulesets › New: the builder as a page (needs imports on; otherwise New is off and there is nothing to open).
      id: "ruleset-builder",
      run: open.library("rulesets"),
      then: async (page) => {
        // The builder needs Agents › custom imports on (test data only); then the page again.
        await page.evaluate(() =>
          fetch("/api/agents/import-policy", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ enabled: true }),
          }),
        );
        await page.reload();
        await page.waitForFunction(() => window.__marinaraUiCheck, null, { timeout: 30_000 });
        await page.evaluate(() => {
          const h = window.__marinaraUiCheck;
          h.openLibrarySection("rulesets");
          if (!h.overhaul.getState().desktop) h.overhaul.getState().setMobileSidePageOpen(false);
        });
        const newButton = () =>
          page
            .getByRole("button", { name: /^New( ruleset…)?$/ })
            .filter({ visible: true })
            .first();
        await newButton()
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        if (!(await newButton().count())) return "no New button on this layout";
        await newButton().click();
        await page.locator('[data-component="RulesetBuilderPage"]').waitFor({ state: "visible", timeout: 10_000 });
      },
    },
    {
      // The chat's background picker (choose only; managing lives in Library › Assets › Backgrounds).
      id: "background-picker",
      // From the new roleplay's setup page (its Background field), like the new-chat setup screens above.
      run: null,
      then: async (page) => {
        const start = page.getByRole("button", { name: "Start a new roleplay" }).filter({ visible: true });
        if (!(await start.count())) return "not on this layout";
        await start.first().click();
        await page.waitForSelector("[data-setup-page]", { timeout: 15_000 });
        const button = page.getByRole("button", { name: /Browse library/ }).filter({ visible: true });
        await button
          .first()
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        if (!(await button.count())) return "no background picker on this layout";
        await button.first().scrollIntoViewIfNeeded();
        await button.first().click();
        await page.locator(".ov-bgpick__bar").first().waitFor({ state: "visible", timeout: 8000 });
      },
    },
    {
      // Library › Characters › Browse online (offline here, so it shows the Retry state too).
      id: "characters-browse-online",
      run: hook(() => {
        const h = window.__marinaraUiCheck;
        h.ui.getState().openBotBrowser();
        if (!h.overhaul.getState().desktop) h.overhaul.getState().setMobileSidePageOpen(false);
      }),
      ready: '[data-component="BotBrowserView"]',
    },
    { id: "create-lorebook", run: hook(() => window.__marinaraUiCheck.ui.getState().openModal("create-lorebook")) },
  ];
}
