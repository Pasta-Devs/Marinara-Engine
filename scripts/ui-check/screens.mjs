// ──────────────────────────────────────────────
// UI check: the screens it opens, and the test data that fills them
// ──────────────────────────────────────────────
// Each screen opens through the app's own store actions (lib/ui-check-hook.ts), the same ones a click runs, so one
// list works on desktop, tablet and phone. `then` opens something on top (a window, a drawer, a menu) with real
// clicks. After opening, the check also walks every tab of the page (an editor's tabs, Settings' tabs).
//
// Adding a page to the app? Add it here. Names stay long on purpose: long names are what break layouts.

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
  const presets = await api.get("/api/prompts");
  ids.preset = presets[0]?.id;
  ids.regex = (
    await api.post("/api/regex-scripts", { name: LONG_NAME, findRegex: UNBROKEN, placement: ["ai_output"] })
  ).id;
  ids.tool = (
    await api.post("/api/custom-tools", {
      name: `harbour_tide_table_${Date.now().toString(36)}`,
      description: PARAGRAPH,
      executionType: "static",
      staticResult: "ok",
    })
  ).id;
  const account = await api.post("/api/connection-accounts", {
    provider: "openai",
    name: `UI check ${LONG_NAME}`,
    apiKey: "fixture-not-a-real-key",
    baseUrl: "http://127.0.0.1:9/v1",
    model: "gpt-5.5",
  });
  ids.connection = account.connectionId;
  ids.account = account.account?.id;

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
  return ids;
}

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
        window.__marinaraUiCheck.chat.getState().setActiveChatId(id);
      }, key),
    ),
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
      id: "home-widgets-window",
      run: null,
      // Desktop and tablet: the Widgets button under the greeting. Phones keep it in Home's menu (not checked).
      then: async (page) => {
        const button = page.getByRole("button", { name: "Widgets", exact: true }).filter({ visible: true });
        if (!(await button.count())) return "not on this layout";
        await button.first().click();
      },
    },
    { id: "chats-list", group: "core", run: open.sidePane("chats") },
    { id: "library-pane", run: open.sidePane("library") },
    { id: "characters", group: "core", run: open.library("characters") },
    { id: "personas", run: open.library("personas") },
    { id: "lorebooks", run: open.library("lorebooks") },
    { id: "presets", run: open.library("presets") },
    { id: "regex", run: open.library("regex") },
    { id: "connections", group: "core", run: open.library("connections") },
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
    { id: "preset-editor", run: open.detail("openPresetDetail", ids.preset) },
    { id: "regex-editor", run: open.detail("openRegexDetail", ids.regex) },
    { id: "tool-editor", run: open.detail("openToolDetail", ids.tool) },
    { id: "connection-editor", run: open.detail("openConnectionDetail", ids.connection) },
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
          setTimeout(() => h.ui.setState({ chatSettingsRequest: { chatId: id, section: null } }), 600);
        }, ids.roleplayChat),
      ),
    },
    // Professor Mari's own page: the suggestions box above her composer, open and folded, and the composer.
    { id: "professor-mari", group: "core", run: hook(() => window.__marinaraUiCheck.overhaul.getState().openMari()) },
    {
      id: "professor-mari-folded",
      run: hook(() => {
        // The fold arrived after this check (Mari suggestions thread); a build without it shows them open.
        window.__marinaraUiCheck.ui.getState().setProfessorMariSuggestionsCollapsed?.(true);
        window.__marinaraUiCheck.overhaul.getState().openMari();
      }),
    },
    {
      id: "omnibar",
      run: hook(() => window.__marinaraUiCheck.ui.getState().setOmnibarOpen(true)),
      then: async (page) => page.keyboard.type("set"),
    },
  ];
}
