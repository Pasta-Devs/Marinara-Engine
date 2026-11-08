import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Back on a full-page surface pops the surface opened before it (one step per press) instead of closing to the chat.
// This drives the real store: the stack lives in `ui.store`, and so do the on-screen Back and hardware back paths.

let mobile = false;
// `isMobileShellViewport` caches the MediaQueryList once, so `matches` has to be read live.
const mobileQuery = {
  get matches() {
    return mobile;
  },
};
const stored = new Map<string, string>();
const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
};
// The stubs stay installed: the store's debounced save flushes after the cases finish, and this runs in its own process.
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
{
  const { useUIStore, pickPersistedUIState, pickSyncedSettings, selectBackDestination } =
    await import("../../packages/client/src/stores/ui.store.js");
  const { registerEditorLeaveHandler } = await import("../../packages/client/src/lib/editor-leave.js");
  // The store is imported without a `window` (its debounced storage registers browser listeners when one exists);
  // the stub arrives afterwards, which is all the navigation helpers read.
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      matchMedia: () => mobileQuery,
      innerWidth: 4000,
      location: { search: "" },
      localStorage: storage,
      dispatchEvent: () => true,
    },
  });
  const ui = () => useUIStore.getState();
  const reset = (isMobile = false) => {
    mobile = isMobile;
    useUIStore.setState(useUIStore.getInitialState(), true);
  };

  // 1. A surface opened from another returns to it, and the history is spent.
  reset();
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  assert.equal(ui().characterDetailId, "C");
  assert.equal(ui().lorebookDetailId, null);
  assert.equal(ui().mainSurfaceHistory.length, 1);
  ui().closeCharacterDetail();
  assert.equal(ui().lorebookDetailId, "L", "Back from the character returns to the lorebook");
  assert.equal(ui().characterDetailId, null);
  assert.equal(ui().mainSurfaceHistory.length, 0);
  ui().closeLorebookDetail();
  assert.equal(ui().hasAnyDetailOpen(), false, "the second Back reaches the chat");

  // 2. The library an editor was opened from stays the place Back returns to.
  reset();
  ui().openCharacterLibrary();
  ui().openCharacterDetail("C", { preserveCharacterLibrary: true });
  assert.equal(ui().characterLibraryOpen, true);
  ui().closeCharacterDetail();
  assert.equal(ui().characterLibraryOpen, true);
  assert.equal(ui().cardLibraryKind, "characters");
  assert.equal(ui().characterDetailId, null);
  assert.equal(ui().mainSurfaceHistory.length, 0);

  // 3. Reopening the surface already showing (a tab switch) records nothing and still applies the tab.
  reset();
  ui().openCharacterDetail("C", { initialTab: "info" });
  ui().openCharacterDetail("C", { initialTab: "advanced" });
  assert.equal(ui().mainSurfaceHistory.length, 0);
  assert.equal(ui().characterDetailInitialTab, "advanced");

  // 4. A surface of the same kind replaces the top instead of stacking.
  reset();
  ui().openLorebookDetail("L1");
  ui().openLorebookDetail("L2");
  ui().openLorebookDetail("L3");
  assert.equal(ui().mainSurfaceHistory.length, 0);
  ui().closeLorebookDetail();
  assert.equal(ui().hasAnyDetailOpen(), false, "browsing lorebooks stays one Back from the chat");
  reset();
  ui().openCharacterDetail("C");
  ui().openLorebookDetail("L1");
  ui().openLorebookDetail("L2");
  assert.equal(ui().mainSurfaceHistory.length, 1);
  ui().closeLorebookDetail();
  assert.equal(ui().characterDetailId, "C");

  // 5. Returning to a surface already in the stack truncates the loop.
  reset();
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().openLorebookDetail("L");
  assert.deepEqual(ui().mainSurfaceHistory, [], "L -> C -> L leaves no stale entries");
  ui().closeLorebookDetail();
  assert.equal(ui().hasAnyDetailOpen(), false);

  // 6. Mobile: the panel an editor was opened from is reopened only when the stack is exhausted.
  reset(true);
  ui().openRightPanel("lorebooks");
  ui().openLorebookDetail("L");
  assert.equal(ui().rightPanelOpen, false);
  assert.equal(ui().detailReturnRightPanel, "lorebooks");
  ui().openCharacterDetail("C");
  ui().closeCharacterDetail();
  assert.equal(ui().lorebookDetailId, "L");
  assert.equal(ui().detailReturnRightPanel, "lorebooks");
  assert.equal(ui().rightPanelOpen, false, "the panel stays closed while a surface is still being shown");
  ui().closeLorebookDetail();
  assert.equal(ui().rightPanelOpen, true);
  assert.equal(ui().rightPanel, "lorebooks");
  assert.equal(ui().detailReturnRightPanel, null);

  // 7. Mobile: libraries, the catalog and the card browser record the panel they were opened from.
  const openedFrom: Array<[string, () => void, () => void, string]> = [
    ["characters", () => ui().openCharacterLibrary(), () => ui().closeCharacterLibrary(), "characterLibraryOpen"],
    ["agents", () => ui().openAgentCatalog(), () => ui().closeAgentCatalog(), "agentCatalogOpen"],
    ["bot-browser", () => ui().openBotBrowser(), () => ui().closeBotBrowser(), "botBrowserOpen"],
    ["personas", () => ui().openPersonaLibrary(), () => ui().closeCharacterLibrary(), "characterLibraryOpen"],
    ["extensions", () => ui().openGameAssetsBrowser(), () => ui().closeGameAssetsBrowser(), "gameAssetsBrowserOpen"],
  ];
  for (const [panel, open, close, flag] of openedFrom) {
    reset(true);
    ui().openRightPanel(panel as never);
    open();
    assert.equal((ui() as unknown as Record<string, unknown>)[flag], true, `${flag} opened`);
    assert.equal(ui().rightPanelOpen, false);
    close();
    assert.equal(ui().rightPanelOpen, true, `${flag} reopens the ${panel} panel`);
    assert.equal(ui().rightPanel, panel);
    assert.equal(ui().detailReturnRightPanel, null);
  }

  // 8. The regex editor's return path still lands on its tab, and does not leave a stack behind.
  reset();
  ui().openCharacterDetail("C");
  ui().openRegexDetail("R", { returnTo: { characterId: "C", tab: "advanced" } });
  ui().closeRegexDetail();
  assert.equal(ui().characterDetailId, "C");
  assert.equal(ui().characterDetailInitialTab, "advanced");
  assert.equal(ui().regexDetailId, null);
  assert.equal(ui().regexDetailReturn, null);
  assert.equal(ui().mainSurfaceHistory.length, 0);
  // With a stack under the return, the return still carries the tab.
  reset();
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().openRegexDetail("R", { returnTo: { characterId: "C", tab: "advanced" } });
  assert.equal(ui().mainSurfaceHistory.length, 2);
  ui().closeRegexDetail();
  assert.equal(ui().characterDetailId, "C", "the return path still wins over the pop");
  assert.equal(ui().characterDetailInitialTab, "advanced");
  assert.equal(ui().mainSurfaceHistory.length, 1);
  ui().closeCharacterDetail();
  assert.equal(ui().lorebookDetailId, "L");

  // 9. The Home tab is remembered by the store, so every editor (not only the connection editor) returns to it.
  reset();
  ui().setHomeTab("packages");
  ui().openConnectionDetail("X");
  ui().closeConnectionDetail();
  assert.equal(ui().homeTab, "packages", "the connection editor returns to the tab it was opened from");
  assert.equal(ui().homeRequest, null, "no tab request is needed: Home remounts on the remembered tab");
  assert.equal(ui().hasAnyDetailOpen(), false);
  reset();
  ui().setHomeTab("noodle");
  ui().openCharacterDetail("C");
  ui().closeCharacterDetail();
  assert.equal(ui().homeTab, "noodle", "so does the character editor");
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().closeCharacterDetail();
  ui().closeLorebookDetail();
  assert.equal(ui().homeTab, "noodle", "and so does a two-deep stack");
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().closeAllDetails();
  assert.equal(ui().homeTab, "noodle", "the ✕ closes to Home on the tab left behind");
  assert.ok(!("homeTab" in pickPersistedUIState(ui())), "the Home tab is never saved");
  assert.ok(!("homeTab" in pickSyncedSettings(ui())), "nor synced");

  // 10. A pending map draft review never shows on another surface, and returns with the map it belongs to.
  reset();
  const review = { chatId: "chat", result: {}, source: "game_setup" } as never;
  ui().openSpatialMapDraftReview(review);
  assert.ok(ui().pendingSpatialMapDraftReview);
  ui().openCharacterLibrary();
  assert.equal(ui().pendingSpatialMapDraftReview, null);
  reset();
  ui().openSpatialMapDraftReview(review);
  ui().openLorebookDetail("L");
  assert.equal(ui().pendingSpatialMapDraftReview, null);
  ui().closeLorebookDetail();
  assert.equal(ui().spatialMapDetailChatId, "chat");
  assert.equal(ui().pendingSpatialMapDraftReview, review, "the unreviewed draft is still waiting on the map");

  // 11. The shared close path closes the front-most surface and is a no-op with nothing open.
  reset();
  ui().openCharacterLibrary();
  ui().openCharacterDetail("C", { preserveCharacterLibrary: true });
  ui().closeTopMainSurface();
  assert.equal(ui().characterDetailId, null, "the editor in front closes first");
  assert.equal(ui().characterLibraryOpen, true, "the library it was opened from remains");
  ui().closeTopMainSurface();
  assert.equal(ui().hasAnyDetailOpen(), false);
  ui().closeTopMainSurface();
  assert.equal(ui().hasAnyDetailOpen(), false);
  assert.deepEqual(ui().mainSurfaceHistory, []);

  // 12. Leaving everything clears the stack; the stack is capped at 10 entries.
  reset();
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().closeAllDetails();
  assert.deepEqual(ui().mainSurfaceHistory, []);
  assert.equal(ui().hasAnyDetailOpen(), false);
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().requestChatModeShortcut("roleplay");
  assert.deepEqual(ui().mainSurfaceHistory, []);
  assert.equal(ui().hasAnyDetailOpen(), false);
  for (let index = 0; index < 12; index += 1) {
    if (index % 2 === 0) ui().openLorebookDetail(`L${index}`);
    else ui().openCharacterDetail(`C${index}`);
  }
  assert.equal(ui().mainSurfaceHistory.length, 10);
  assert.equal(ui().mainSurfaceHistory[0].characterDetailId, "C1", "the oldest entry is dropped first");

  // 13. An editor that saves on the way out holds the pop until it proceeds.
  reset();
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  let held: (() => void) | null = null;
  const unregister = registerEditorLeaveHandler({
    key: "characterDetailId:C",
    request: (proceed) => {
      held = proceed;
      return true;
    },
  });
  ui().closeCharacterDetail();
  assert.equal(ui().characterDetailId, "C", "the editor stays open while it saves");
  assert.equal(ui().mainSurfaceHistory.length, 1);
  assert.ok(held);
  (held as () => void)();
  assert.equal(ui().lorebookDetailId, "L");
  assert.equal(ui().characterDetailId, null);
  assert.equal(ui().mainSurfaceHistory.length, 0);
  unregister();

  // 14. The history is in memory only.
  reset();
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  assert.equal(ui().mainSurfaceHistory.length, 1);
  assert.equal("mainSurfaceHistory" in pickPersistedUIState(ui()), false);
  assert.equal("mainSurfaceHistory" in pickSyncedSettings(ui()), false);

  // 15. The Back button names the destination `closeTopMainSurface` reaches.
  reset();
  assert.equal(selectBackDestination(ui()), null, "nothing to return to but the chat");
  ui().openLorebookDetail("L");
  assert.equal(selectBackDestination(ui()), null);
  ui().openCharacterDetail("C");
  assert.deepEqual(selectBackDestination(ui()), { surface: "lorebookDetailId", cardLibraryKind: "characters" });
  ui().openPersonaLibrary();
  assert.deepEqual(selectBackDestination(ui()), { surface: "characterDetailId", cardLibraryKind: "characters" });
  ui().openCharacterDetail("C2", { preserveCharacterLibrary: true });
  assert.deepEqual(selectBackDestination(ui()), { surface: "characterLibraryOpen", cardLibraryKind: "personas" });
  ui().closeAllDetails();
  assert.equal(selectBackDestination(ui()), null);

  // 15b. On a phone the panel a first surface was opened from is where the last Back lands.
  reset(true);
  ui().openRightPanel("lorebooks");
  ui().openLorebookDetail("L");
  assert.deepEqual(selectBackDestination(ui()), { panel: "lorebooks" });
  ui().openCharacterDetail("C");
  assert.deepEqual(selectBackDestination(ui()), { surface: "lorebookDetailId", cardLibraryKind: "characters" });
  ui().closeCharacterDetail();
  assert.deepEqual(selectBackDestination(ui()), { panel: "lorebooks" });

  // 15c. The regex editor returns to the card or preset that opened it; a connection editor over Home has no
  // destination of its own (Home shows the tab it left).
  reset();
  ui().openCharacterDetail("C");
  ui().openRegexDetail("R", { returnTo: { characterId: "C", tab: "advanced" } });
  assert.deepEqual(selectBackDestination(ui()), { surface: "characterDetailId", cardLibraryKind: "characters" });
  reset();
  ui().openConnectionDetail("X");
  assert.equal(selectBackDestination(ui()), null);

  // 16. The ✕ shows exactly when Back would not already reach the base (a surface or the opening panel is the destination).
  const { selectShowsSurfaceClose } = await import("../../packages/client/src/components/ui/SurfaceCloseButton.js");
  reset();
  assert.equal(selectShowsSurfaceClose(ui()), false, "no surface open");
  ui().openLorebookDetail("L");
  assert.equal(selectShowsSurfaceClose(ui()), false, "one surface open: Back already reaches the chat");
  ui().openCharacterDetail("C");
  assert.equal(selectShowsSurfaceClose(ui()), true, "two deep: Back lands on a surface");
  ui().closeCharacterDetail();
  assert.equal(selectShowsSurfaceClose(ui()), false);
  reset(true);
  ui().openRightPanel("lorebooks");
  ui().openLorebookDetail("L");
  assert.equal(selectShowsSurfaceClose(ui()), true, "Back reopens the panel; the ✕ goes straight to the chat");
  await (await import("../../packages/client/src/lib/back-layers.js")).requestCloseAllSurfaces();
  assert.equal(ui().rightPanelOpen, false, "closing to the chat does not reopen the panel");
  assert.equal(selectShowsSurfaceClose(ui()), false);
  reset();
  ui().openConnectionDetail("X");
  assert.equal(selectShowsSurfaceClose(ui()), false, "Back already reaches Home");
  reset();
  ui().openCharacterDetail("C");
  ui().openRegexDetail("R", { returnTo: { characterId: "C", tab: "advanced" } });
  assert.equal(selectShowsSurfaceClose(ui()), true, "the regex editor's return is a surface");

  // 17. `requestCloseAllSurfaces` closes the whole stack through the same unsaved-changes guard as hardware back.
  const { requestCloseAllSurfaces } = await import("../../packages/client/src/lib/back-layers.js");
  const { useDialogStore } = await import("../../packages/client/src/stores/dialog.store.js");
  const { resolveActiveDialog } = await import("../../packages/client/src/lib/app-dialogs.js");
  const openThree = () => {
    reset();
    ui().openLorebookDetail("L");
    ui().openCharacterDetail("C");
    ui().openPersonaLibrary();
    assert.equal(ui().mainSurfaceHistory.length, 2);
  };
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  // 17a. From three surfaces deep it empties the stack and lands on the base.
  openThree();
  await requestCloseAllSurfaces();
  assert.equal(ui().hasAnyDetailOpen(), false);
  assert.equal(ui().mainSurfaceHistory.length, 0);
  assert.equal(selectBackDestination(ui()), null);

  // 17b. Nothing open: it does nothing.
  await requestCloseAllSurfaces();
  assert.equal(ui().hasAnyDetailOpen(), false);

  // 17c. An editor with a leave handler saves itself first: the close waits until `proceed` runs.
  openThree();
  ui().openCharacterDetail("C2", { preserveCharacterLibrary: true });
  let heldAll: (() => void) | null = null;
  const unregisterAll = registerEditorLeaveHandler({
    key: "characterDetailId:C2",
    request: (proceed) => {
      heldAll = proceed;
      return true;
    },
  });
  ui().setEditorDirty(true);
  const closing = requestCloseAllSurfaces();
  await settle();
  assert.ok(heldAll, "the editor was asked to save");
  assert.equal(ui().characterDetailId, "C2", "the close waits for the editor");
  assert.equal(useDialogStore.getState().dialog, null, "no discard prompt for an editor that saves itself");
  (heldAll as () => void)();
  await closing;
  assert.equal(ui().hasAnyDetailOpen(), false, "closed once the editor proceeded");
  assert.equal(ui().mainSurfaceHistory.length, 0);
  unregisterAll();

  // 17d. A dirty editor with no handler asks first: declined closes nothing, accepted closes everything.
  openThree();
  ui().setEditorDirty(true);
  const declined = requestCloseAllSurfaces();
  await settle();
  assert.ok(useDialogStore.getState().dialog, "the discard prompt is up");
  resolveActiveDialog(false);
  await declined;
  assert.equal(ui().hasAnyDetailOpen(), true, "declining closes nothing");
  assert.equal(ui().mainSurfaceHistory.length, 2);
  const accepted = requestCloseAllSurfaces();
  await settle();
  resolveActiveDialog(true);
  await accepted;
  assert.equal(ui().hasAnyDetailOpen(), false, "discarding closes every surface");
  assert.equal(ui().mainSurfaceHistory.length, 0);

  // 18. The Agent Organizer remembers the agent page being viewed, so Back from that agent's Settings returns to it
  // (not to the page the catalog was opened for).
  reset();
  ui().openAgentCatalog("A");
  assert.equal(ui().agentCatalogInitialPackageId, "A");
  ui().setAgentCatalogPage("B");
  ui().openAgentDetail("B");
  assert.equal(ui().agentCatalogOpen, false);
  ui().closeAgentDetail();
  assert.equal(ui().agentCatalogOpen, true, "Back reopens the catalog");
  assert.equal(ui().agentCatalogInitialPackageId, "B", "on the page that was viewed, not the one it opened for");
  ui().setAgentCatalogPage(null);
  ui().openAgentDetail("C");
  ui().closeAgentDetail();
  assert.equal(ui().agentCatalogInitialPackageId, null, "the front page is remembered too");
  ui().closeAgentCatalog();
  assert.equal(ui().agentCatalogOpen, false);
  ui().openAgentCatalog();
  assert.equal(ui().agentCatalogInitialPackageId, null, "a fresh open starts on the front page");

  // 19. Opening a chat starts Home on its first tab: the reset lives in AppShell, which the store cannot see.
  assert.match(
    readFileSync(new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url), "utf8"),
    /if \(activeChatId\) useUIStore\.getState\(\)\.setHomeTab\("home"\);/u,
  );

  // 20. A surface opened from the Chat Settings drawer brings the drawer back: the drawer closes first, so the store
  // remembers it and the last pop queues a request for ChatArea.
  reset();
  ui().setChatSettingsReturn({ chatId: "chat-1", section: "lorebooks" });
  ui().openAgentDetail("long-term-memory");
  assert.deepEqual(selectBackDestination(ui()), { chatSettings: true });
  assert.equal(selectShowsSurfaceClose(ui()), true, "Back leads to Chat Settings, not straight to the chat");
  ui().closeAgentDetail();
  assert.equal(ui().hasAnyDetailOpen(), false);
  assert.deepEqual(ui().chatSettingsRequest, { chatId: "chat-1", section: "lorebooks" });
  assert.equal(ui().chatSettingsReturn, null, "the marker is spent");
  assert.equal(selectBackDestination(ui()), null);
  ui().consumeChatSettingsRequest();
  assert.equal(ui().chatSettingsRequest, null);

  // 20b. Surfaces stacked on top of it still end at the drawer, one Back per surface.
  reset();
  ui().setChatSettingsReturn({ chatId: "chat-1", section: null });
  ui().openLorebookDetail("L");
  ui().openCharacterDetail("C");
  ui().closeCharacterDetail();
  assert.equal(ui().chatSettingsRequest, null, "a surface still shows");
  assert.equal(ui().lorebookDetailId, "L");
  ui().closeLorebookDetail();
  assert.deepEqual(ui().chatSettingsRequest, { chatId: "chat-1", section: null });

  // 20c. The ✕ and the chat-mode shortcut drop the marker; a mobile panel return wins over it.
  reset();
  ui().setChatSettingsReturn({ chatId: "chat-1", section: null });
  ui().openAgentDetail("long-term-memory");
  ui().closeAllDetails();
  assert.equal(ui().chatSettingsReturn, null);
  assert.equal(ui().chatSettingsRequest, null);
  ui().setChatSettingsReturn({ chatId: "chat-1", section: null });
  ui().requestChatModeShortcut("roleplay");
  assert.equal(ui().chatSettingsReturn, null);
  reset(true);
  ui().openRightPanel("agents");
  ui().setChatSettingsReturn({ chatId: "chat-1", section: null });
  ui().openAgentDetail("long-term-memory");
  ui().closeAgentDetail();
  assert.equal(ui().rightPanel, "agents", "the panel the surface came from reopens");
  assert.equal(ui().chatSettingsRequest, null, "and the drawer does not stack on it");

  // 20d. Opening another chat drops a marker left for the previous one: the clear lives in AppShell.
  assert.match(
    readFileSync(new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url), "utf8"),
    /ui\.chatSettingsReturn\.chatId !== activeChatId\) ui\.setChatSettingsReturn\(null\)/u,
  );

  // 20d2. Download agents opens the Agent Organizer, a surface, from the drawer: Back reaches the drawer too.
  reset();
  ui().setChatSettingsReturn({ chatId: "chat-1", section: null });
  ui().openRightPanel("agents");
  ui().openAgentCatalog();
  ui().closeAgentCatalog();
  assert.deepEqual(ui().chatSettingsRequest, { chatId: "chat-1", section: null });
  assert.match(
    readFileSync(new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url), "utf8"),
    /chatSettingsRequest\.chatId !== activeChatId\) ui\.consumeChatSettingsRequest\(\)/u,
  );

  // 20e. The marker and request are never saved.
  reset();
  ui().setChatSettingsReturn({ chatId: "chat-1", section: null });
  assert.equal("chatSettingsReturn" in pickPersistedUIState(ui()), false);
  assert.equal("chatSettingsRequest" in pickPersistedUIState(ui()), false);

  console.info("Surface back history regression passed.");
}
