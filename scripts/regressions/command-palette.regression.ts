import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const {
  canTogglePaletteFromShortcut,
  filterVisibleCommands,
  formatShortcutKey,
  fuzzyScore,
  isPaletteListedChat,
  isPaletteShortcut,
  isShortcutsHelpKey,
  isTypingTarget,
  listRegisteredCommands,
  paletteFocusReturnTarget,
  PALETTE_SETTINGS_TABS,
  parseRecents,
  pushRecent,
  rankCommands,
  registerCommand,
  subscribeToCommands,
} = await import("../../packages/client/src/lib/command-palette.js");
const { KEYBOARD_SHORTCUT_GROUPS } = await import("../../packages/client/src/lib/keyboard-shortcuts.js");

const noop = () => undefined;
const source = (path: string) => readFileSync(new URL(`../../packages/client/src/${path}`, import.meta.url), "utf8");
const en = JSON.parse(source("localization/locales/en.json")) as Record<string, unknown>;

// ── Fuzzy scoring prefers exact > prefix > word start > substring > subsequence ──
{
  const exact = fuzzyScore("aria", "Aria")!;
  const prefix = fuzzyScore("ari", "Aria Blackwood")!;
  const wordStart = fuzzyScore("black", "Aria Blackwood")!;
  const substring = fuzzyScore("ckwo", "Aria Blackwood")!;
  const subsequence = fuzzyScore("abw", "Aria Blackwood")!;
  assert.ok(exact > prefix && prefix > wordStart && wordStart > substring && substring > subsequence);
  assert.equal(fuzzyScore("xyz", "Aria Blackwood"), null);
  assert.equal(fuzzyScore("", "anything"), 0);
  assert.ok(fuzzyScore("cafe", "Café Noir")! > 800, "accents are ignored (prefix match)");
  assert.ok(fuzzyScore("(", "a (b)") != null, "regex characters in the query are literal");
  assert.ok(fuzzyScore("black", "Aria Blackwood")! > fuzzyScore("black", "Unblackened")!, "cached word pattern");
  assert.ok(fuzzyScore("wood", "Dark wood")! > fuzzyScore("wood", "Aria Blackwood")!, "pattern follows the new query");
}

// ── Ranking: recents first on empty query, then the fallback group; boosted near-ties ──
{
  const commands = [
    { id: "action:new", title: "New conversation", section: "actions" as const, run: noop },
    { id: "chat:1", title: "Tavern night", section: "chats" as const, run: noop },
    { id: "chat:2", title: "Tavern day", section: "chats" as const, run: noop },
    {
      id: "character:1",
      title: "Nova",
      subtitle: "Character",
      keywords: ["starlight"],
      section: "characters" as const,
      run: noop,
    },
  ];
  const empty = rankCommands(commands, "", ["chat:2"], {
    emptyQueryFallback: (command) => command.section === "actions",
  });
  assert.deepEqual(
    empty.map((command) => command.id),
    ["chat:2", "action:new"],
    "empty query shows recents, then actions, never every chat",
  );
  assert.deepEqual(
    rankCommands(commands, "tavern", ["chat:2"]).map((command) => command.id),
    ["chat:2", "chat:1"],
    "a recent item wins a tie",
  );
  assert.deepEqual(
    rankCommands(commands, "starlight", []).map((command) => command.id),
    ["character:1"],
    "hidden keywords match",
  );
  assert.equal(rankCommands(commands, "t", [], { limit: 1 }).length, 1);
}

// ── Recents ──
assert.deepEqual(pushRecent(["a", "b", "c"], "b"), ["b", "a", "c"]);
assert.equal(
  pushRecent(
    Array.from({ length: 20 }, (_, index) => `x${index}`),
    "new",
  ).length,
  12,
);
assert.deepEqual(parseRecents('["a", 1, "b"]'), ["a", "b"]);
assert.deepEqual(parseRecents("{broken"), []);
assert.deepEqual(parseRecents(null), []);

// ── Registry: register, replace, unregister, and notify subscribers ──
{
  let notifications = 0;
  const unsubscribe = subscribeToCommands(() => notifications++);
  const first = { id: "test:cmd", title: "First", run: noop };
  const second = { id: "test:cmd", title: "Second", run: noop };
  const unregisterFirst = registerCommand(first);
  const unregisterSecond = registerCommand(second);
  assert.equal(listRegisteredCommands().filter((command) => command.id === "test:cmd").length, 1);
  assert.equal(listRegisteredCommands().find((command) => command.id === "test:cmd")?.title, "Second");
  unregisterFirst();
  assert.ok(
    listRegisteredCommands().some((command) => command.id === "test:cmd"),
    "a stale unregister must not remove its replacement",
  );
  const snapshot = listRegisteredCommands();
  assert.equal(listRegisteredCommands(), snapshot, "snapshot is stable between changes (useSyncExternalStore)");
  unregisterSecond();
  assert.equal(
    listRegisteredCommands().some((command) => command.id === "test:cmd"),
    false,
  );
  assert.equal(notifications, 3);
  unsubscribe();
}

// ── Filtering: `when` hides commands, and a throwing `when` hides only its own command ──
{
  const visible = filterVisibleCommands([
    { id: "always", title: "Always", run: noop },
    { id: "shown", title: "Shown", when: () => true, run: noop },
    { id: "hidden", title: "Hidden", when: () => false, run: noop },
    {
      id: "broken",
      title: "Broken",
      when: () => {
        throw new Error("no active chat");
      },
      run: noop,
    },
  ]);
  assert.deepEqual(
    visible.map((command) => command.id),
    ["always", "shown"],
  );
}

// ── Chats: the conversation that backs a game is part of that game, not its own entry ──
assert.equal(isPaletteListedChat({ mode: "roleplay", metadata: {} }), true);
assert.equal(isPaletteListedChat({ mode: "game", metadata: { gameId: "game-1" } }), true);
assert.equal(isPaletteListedChat({ mode: "conversation", metadata: null }), true);
assert.equal(isPaletteListedChat({ mode: "conversation" }), true);
assert.equal(isPaletteListedChat({ mode: "conversation", metadata: { gameId: "game-1" } }), false);

// ── Settings tabs: every palette entry is a real Settings tab with a localized label ──
{
  const settingsPanel = source("components/panels/SettingsPanel.tsx");
  for (const tab of PALETTE_SETTINGS_TABS) {
    assert.match(settingsPanel, new RegExp(`id: "${tab.id}"`, "u"), `Settings has a "${tab.id}" tab`);
    assert.equal(typeof en[tab.labelKey], "string", `${tab.labelKey} is in en.json`);
  }
}

// ── Key handling ──
const key = (
  value: string,
  modifiers: Partial<Record<"ctrlKey" | "metaKey" | "altKey" | "shiftKey", boolean>> = {},
) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...modifiers,
});
assert.equal(isPaletteShortcut(key("k", { ctrlKey: true })), true);
assert.equal(isPaletteShortcut(key("K", { metaKey: true })), true);
assert.equal(isPaletteShortcut(key("k", { ctrlKey: true, shiftKey: true })), false);
assert.equal(isPaletteShortcut(key("k", { ctrlKey: true, altKey: true })), false, "AltGr+K is not Ctrl+K");
assert.equal(isPaletteShortcut(key("k")), false);
// Non-Latin layouts report the local letter in `key`; the physical K key still opens the palette.
assert.equal(isPaletteShortcut({ ...key("ל", { ctrlKey: true }), code: "KeyK" }), true, "Hebrew layout Ctrl+K");
assert.equal(isPaletteShortcut({ ...key("л", { metaKey: true }), code: "KeyK" }), true, "Cyrillic layout Cmd+K");
// A Latin layout that moves K elsewhere (Dvorak: physical K types "t") must not open it.
assert.equal(isPaletteShortcut({ ...key("t", { ctrlKey: true }), code: "KeyK" }), false, "Dvorak Ctrl+T");
assert.equal(isPaletteShortcut({ ...key("k", { ctrlKey: true }), repeat: true }), false, "held key does not re-toggle");
// The palette never opens over another dialog, and may close itself only when it is the one open.
assert.equal(canTogglePaletteFromShortcut(0, false), true, "nothing open");
assert.equal(canTogglePaletteFromShortcut(1, true), true, "only the palette is open");
assert.equal(canTogglePaletteFromShortcut(2, true), false, "palette opened over another dialog");
assert.equal(canTogglePaletteFromShortcut(1, false), false, "another dialog is open");
assert.equal(formatShortcutKey("Mod", true), "⌘");
assert.equal(formatShortcutKey("Mod", false), "Ctrl");
assert.equal(formatShortcutKey("K", false), "K");
assert.equal(isShortcutsHelpKey(key("?", { shiftKey: true })), true);
assert.equal(isShortcutsHelpKey(key("?", { ctrlKey: true })), false);
assert.equal(isShortcutsHelpKey(key("/")), false);

const element = (tagName: string, attributes: Record<string, string> = {}, extra: object = {}) => ({
  tagName,
  getAttribute: (name: string) => attributes[name] ?? null,
  closest: () => null,
  ...extra,
});
assert.equal(isTypingTarget(element("TEXTAREA")), true);
assert.equal(isTypingTarget(element("INPUT")), true);
assert.equal(isTypingTarget(element("INPUT", { type: "search" })), true);
assert.equal(isTypingTarget(element("INPUT", { type: "checkbox" })), false);
assert.equal(isTypingTarget(element("SELECT")), true);
assert.equal(isTypingTarget(element("DIV", {}, { isContentEditable: true })), true);
assert.equal(isTypingTarget(element("SPAN", {}, { closest: () => ({}) })), true, "inside a contenteditable");
assert.equal(isTypingTarget(element("BUTTON")), false);
assert.equal(isTypingTarget(null), false);

// ── Host wiring ──
const host = source("components/command-palette/CommandPaletteHost.tsx");
// A field that binds Ctrl+K itself and calls preventDefault() keeps the key.
assert.match(host, /if \(event\.defaultPrevented \|\| event\.isComposing\) return;/u);
assert.match(
  host,
  /isPaletteShortcut\(event\)\) \{[\s\S]*?if \(!canTogglePaletteFromShortcut\(countModalOverlays\(\), palette\.paletteOpen\)\) return;/u,
  "the shortcut does not open the palette over another dialog",
);

// "?" never fires while typing or over an open dialog.
assert.match(host, /isShortcutsHelpKey\(event\) && !isTypingTarget\(event\.target\) && countModalOverlays\(\) === 0/u);

// The built-in actions are exactly the ones below: each opens something that exists in the app.
{
  const registeredIds = [...host.matchAll(/id: "(action:[^"]+)"/gu)].map((match) => match[1]);
  assert.deepEqual(registeredIds.sort(), [
    "action:browse-cards",
    "action:character-library",
    "action:chat-guide",
    "action:home",
    "action:new-conversation",
    "action:new-game",
    "action:new-roleplay",
    "action:open-settings",
    "action:shortcuts",
    "action:toggle-chats",
    "action:toggle-theme",
  ]);
  assert.match(host, /id: `action:panel-\$\{panel\}`/u);
  for (const panel of ["characters", "personas", "lorebooks", "presets", "connections", "agents"]) {
    assert.match(host, new RegExp(`\\{ panel: "${panel}", labelKey: "palette\\.actions\\.open`, "u"));
  }
  for (const labelKey of host.matchAll(/"(palette\.[A-Za-z.]+)"/gu)) {
    assert.equal(typeof en[labelKey[1]!], "string", `${labelKey[1]} is in en.json`);
  }
}

// Big libraries: the palette lists characters from the compact catalog, never the full-card list.
const palette = source("components/command-palette/CommandPalette.tsx");
assert.match(palette, /useAllCharacterCatalog\(\)/u, "palette reads the compact character catalog");
assert.doesNotMatch(palette, /useCharacters\(\)/u, "palette does not load every full character card");
assert.match(palette, /filterVisibleCommands\(registered\)/u, "registered commands go through the `when` filter");
// Closing the palette hands focus back to what opened it. The autofocused search field is focused before
// the dialog's focus scope looks, so the palette records the opener itself when `open` turns on.
{
  const opener = { focus: noop };
  const body = { focus: noop };
  assert.equal(paletteFocusReturnTarget(opener, body), opener, "the focused opener gets focus back");
  assert.equal(paletteFocusReturnTarget(body, body), null, "the page body is not an opener");
  assert.equal(paletteFocusReturnTarget(null, body), null);
  assert.equal(paletteFocusReturnTarget({} as { focus?: unknown }, body), null, "only focusable elements");
  assert.match(
    palette,
    /useLayoutEffect\(\(\) => \{\s*if \(open\)\s*restoreFocusRef\.current = paletteFocusReturnTarget\(/u,
    "the opener is recorded in a layout effect, before the search field mounts and autofocuses",
  );
  assert.match(palette, /restoreFocusRef=\{restoreFocusRef\}/u, "the recorded opener is passed to the Modal");
}
for (const labelKey of palette.matchAll(/t\("(palette\.[A-Za-z.]+)"/gu)) {
  assert.equal(typeof en[labelKey[1]!], "string", `${labelKey[1]} is in en.json`);
}
for (const [name, value] of Object.entries(en)) {
  if (name.startsWith("palette.")) assert.ok(!String(value).includes("\u2014"), `${name} has no em dash`);
}

// ── Shortcut catalog: every label is localized and every listed binding exists in the code ──
{
  const labelKeys = new Set<string>();
  for (const group of KEYBOARD_SHORTCUT_GROUPS) {
    assert.equal(typeof en[group.titleKey], "string", `${group.titleKey} is in en.json`);
    for (const shortcut of group.shortcuts) {
      assert.equal(typeof en[shortcut.labelKey], "string", `${shortcut.labelKey} is in en.json`);
      assert.ok(!labelKeys.has(shortcut.labelKey), `${shortcut.labelKey} is listed once`);
      labelKeys.add(shortcut.labelKey);
      assert.ok(shortcut.keys.length > 0 && shortcut.keys.every((combo) => combo.length > 0));
    }
  }
  const catalogKeys = Object.keys(en).filter(
    (name) => /^shortcuts\.[a-z]+\.[A-Za-z]+$/u.test(name) && !name.startsWith("shortcuts.groups."),
  );
  assert.deepEqual(catalogKeys.sort(), [...labelKeys].sort(), "no orphaned shortcut labels in en.json");
  for (const name of ["shortcuts.title", "shortcuts.intro", "shortcuts.or", "palette.actions.shortcuts"]) {
    assert.equal(typeof en[name], "string", `${name} is in en.json`);
  }
  for (const [name, value] of Object.entries(en)) {
    if (name.startsWith("shortcuts.")) assert.ok(!String(value).includes("\u2014"), `${name} has no em dash`);
  }

  // One entry per listed binding: [file, pattern that implements it].
  const bindings: Array<[string, RegExp]> = [
    ["components/command-palette/CommandPaletteHost.tsx", /isPaletteShortcut\(event\)/u],
    ["components/command-palette/CommandPalette.tsx", /event\.key === "ArrowDown"/u],
    ["components/command-palette/CommandPaletteHost.tsx", /isShortcutsHelpKey\(event\)/u],
    ["components/ui/Modal.tsx", /e\.key !== "Escape"/u],
    ["components/chat/ChatInput.tsx", /if \(enterToSend && !e\.shiftKey\)/u],
    ["components/chat/ConversationInput.tsx", /e\.key === "Enter" && \(e\.metaKey \|\| e\.ctrlKey\)/u],
    ["components/game/GameInput.tsx", /e\.key === "Enter" && \(e\.metaKey \|\| e\.ctrlKey\)/u],
    ["components/chat/ChatArea.tsx", /event\.key !== "ArrowUp"/u],
    ["components/chat/ConversationInput.tsx", /if \(e\.key === "Tab" \|\| e\.key === "Enter"\)/u],
    ["components/chat/ChatInput.tsx", /e\.key === "Tab" \|\| \(e\.key === "Enter" && !e\.shiftKey\)/u],
    ["components/chat/ChatArea.tsx", /event\.key !== "ArrowLeft" && event\.key !== "ArrowRight"/u],
    ["components/chat/ChatMessage.tsx", /e\.key === "Enter" && \(e\.metaKey \|\| e\.ctrlKey\)\) handleSave\(\)/u],
    ["components/chat/ChatMessage.tsx", /e\.key === "Escape"\) onCancel\(\)/u],
    ["components/chat/ChatMessageSearch.tsx", /event\.key === "Enter" && results\[0\]/u],
    ["components/game/GameCombatUI.tsx", /e\.key === "ArrowUp" \|\| e\.key === "w"/u],
    ["components/game/GameCombatUI.tsx", /e\.key === "Enter" \|\| e\.key === " "/u],
    ["lib/textarea-editing.ts", /event\.key !== "Tab"/u],
    ["components/game-assets/FileEditorModal.tsx", /e\.key === "s" && \(e\.metaKey \|\| e\.ctrlKey\)/u],
    ["components/game-assets/GameAssetsBrowserView.tsx", /e\.key === "a" && \(e\.metaKey \|\| e\.ctrlKey\)/u],
    ["components/game-assets/GameAssetsBrowserView.tsx", /e\.key === "Escape" && selectedPaths\.size > 0/u],
    ["components/layout/AppShell.tsx", /else if \(event\.key === "Home"\) nextWidth = SHARED_SIDEBAR_WIDTH_MIN/u],
  ];
  for (const [path, pattern] of bindings) {
    assert.match(source(path), pattern, `${path} still implements a listed shortcut`);
  }
  assert.match(source("components/command-palette/KeyboardShortcutsOverlay.tsx"), /KEYBOARD_SHORTCUT_GROUPS\.map/u);
}

// Touch users need a visible way in, not only the key binding.
assert.match(source("components/layout/TopBar.tsx"), /aria-keyshortcuts="Control\+K Meta\+K"/u);
assert.match(source("components/layout/AppShell.tsx"), /<CommandPaletteHost \/>/u);

console.log("command palette regression passed");
