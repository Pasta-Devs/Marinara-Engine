import assert from "node:assert/strict";

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
  const { useUIStore, pickPersistedUIState, pickSyncedSettings } =
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

  // 9. A connection editor opened from a Home package returns to its tab; one opened over a surface returns to it.
  reset();
  ui().openConnectionDetail("X", { returnToHomeTab: "packages" });
  ui().closeConnectionDetail();
  assert.deepEqual(ui().homeRequest, { kind: "tab", tab: "packages" });
  reset();
  ui().openLorebookDetail("L");
  ui().openConnectionDetail("X", { returnToHomeTab: "packages" });
  ui().closeConnectionDetail();
  assert.equal(ui().lorebookDetailId, "L");
  assert.equal(ui().homeRequest, null, "Home is not visible after a pop, so no tab is queued");

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

  console.info("Surface back history regression passed.");
}
