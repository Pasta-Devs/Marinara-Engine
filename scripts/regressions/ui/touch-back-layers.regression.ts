import assert from "node:assert/strict";

// Back on phones and tablets, driven through the real stores and `back-layers.ts` (QC panel Nov 22):
// - a tablet held sideways shows the desktop shell; back there must go up one level instead of leaving the app,
//   while a desktop browser with a mouse keeps an untrapped back;
// - a Library section picked from the phone's Library list page returns to that list on back.

class FakeHistory {
  entries: unknown[] = [null];
  index = 0;
  pushes = 0;
  private queue: Array<() => void> = [];
  private listeners = new Set<(event: { state: unknown }) => void>();
  get state() {
    return this.entries[this.index] ?? null;
  }
  pushState(state: unknown) {
    this.entries = [...this.entries.slice(0, this.index + 1), state];
    this.index += 1;
    this.pushes += 1;
  }
  private move(delta: number) {
    this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + delta));
    for (const listener of [...this.listeners]) listener({ state: this.state });
  }
  go(delta: number) {
    this.queue.push(() => this.move(delta));
  }
  get queued() {
    return this.queue.length;
  }
  addListener(listener: (event: { state: unknown }) => void) {
    this.listeners.add(listener);
  }
  removeListener(listener: (event: { state: unknown }) => void) {
    this.listeners.delete(listener);
  }
  flush() {
    let guard = 0;
    while (this.queue.length) {
      assert.ok((guard += 1) < 50, "history queue never drained");
      this.queue.shift()!();
    }
  }
  /** A user pressing back. Returns false when the press left the app (nothing of ours was there). */
  userBack() {
    if (this.index === 0) return false;
    this.move(-1);
    this.flush();
    return true;
  }
}

let history = new FakeHistory();
// The persisted stores save through a storage this lane doesn't need; keep their notices out of the output.
const realWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (String(args[0]).includes("zustand persist")) return;
  realWarn(...args);
};
const stored = new Map<string, string>();
const storage = {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
};
const dataset: Record<string, string> = {};
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });

const { useUIStore } = await import("../../../packages/client/src/stores/ui.store.js");
const { useOverhaulStore } = await import("../../../packages/client/src/stores/overhaul.store.js");
const { useChatStore } = await import("../../../packages/client/src/stores/chat.store.js");
const { useFloatingWindowStore, CHAT_SETTINGS_WINDOW_ID } =
  await import("../../../packages/client/src/stores/floating-window.store.js");
const { initBackNavigation, syncBackNavigation, batchBackLayers, getBackLayerStack, __resetBackNavigationForTests } =
  await import("../../../packages/client/src/lib/back-navigation.js");
const { getStoreBackLayers, watchLibraryHubReturn } = await import("../../../packages/client/src/lib/back-layers.js");
const { useChatSettingsSubpage } = await import("../../../packages/client/src/features/chat-settings/subpage.js");
const { useMobileChatSettingsNav } = await import("../../../packages/client/src/features/chat-settings/mobile-nav.js");
const { watchChatSettingsClose } = await import("../../../packages/client/src/lib/chat-settings-close.js");

// The touch flag `main.tsx` sets; the document arrives after the imports (sonner styles itself into a real one).
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { documentElement: { dataset }, querySelector: () => null },
});
// The Chat settings sheet's pages scroll to their top a frame after they open.
globalThis.requestAnimationFrame ??= (callback: FrameRequestCallback) =>
  setTimeout(() => callback(0), 0) as unknown as number;
// Stores are imported without a `window` (their debounced storage would register browser listeners); the stub arrives
// afterwards, which is all the navigation code reads.
const shellQuery = { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => shellQuery,
    innerWidth: 1133,
    location: { search: "" },
    localStorage: storage,
    dispatchEvent: () => true,
    history: {
      pushState: (state: unknown) => history.pushState(state),
      back: () => history.go(-1),
      go: (delta: number) => history.go(delta),
      get state() {
        return history.state;
      },
    },
    addEventListener: (type: string, listener: (event: { state: unknown }) => void) => {
      if (type === "popstate") history.addListener(listener);
    },
    removeEventListener: (type: string, listener: (event: { state: unknown }) => void) => {
      if (type === "popstate") history.removeListener(listener);
    },
  },
});

const ui = () => useUIStore.getState();
const overhaul = () => useOverhaulStore.getState();
const ids = () => getBackLayerStack().map((layer) => layer.id);
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

let unsubscribe: Array<() => void> = [];
function reset({ desktop, touch }: { desktop: boolean; touch: boolean }) {
  for (const stop of unsubscribe) stop();
  __resetBackNavigationForTests();
  history = new FakeHistory();
  if (touch) dataset.marinaraTouchDevice = "true";
  else delete dataset.marinaraTouchDevice;
  useUIStore.setState(useUIStore.getInitialState(), true);
  useOverhaulStore.setState({
    enabled: true,
    desktop,
    libraryPage: null,
    activeDocsTab: null,
    activeMari: false,
    activeSchedules: false,
    activeApp: null,
    mobileSidePageOpen: false,
    allTabsOpen: false,
    sidePane: "chats",
    libraryHubReturn: false,
  });
  useChatStore.setState({ activeChatId: null });
  useFloatingWindowStore.setState({ open: {} });
  initBackNavigation(getStoreBackLayers);
  unsubscribe = [
    useUIStore.subscribe(syncBackNavigation),
    useOverhaulStore.subscribe(syncBackNavigation),
    useChatStore.subscribe(syncBackNavigation),
    useFloatingWindowStore.subscribe(syncBackNavigation),
    watchLibraryHubReturn(),
  ];
  syncBackNavigation();
}

/** The phone Library list's row tap (SidePane `pickSection`). */
function pickFromLibraryList(open: () => void) {
  batchBackLayers(() => {
    overhaul().setMobileSidePageOpen(false);
    overhaul().setLibraryHubReturn(true);
    open();
  });
}

// ── 1. Tablet held sideways (desktop shell, touch): Library > Settings, then back one level at a time ──
reset({ desktop: true, touch: true });
useChatStore.setState({ activeChatId: "chat-1" });
overhaul().setLibraryPage("settings");
assert.deepEqual(ids(), ["phone-home", "library-page"]);
assert.equal(history.index, 2, "one entry per layer on a touch desktop shell");
assert.ok(history.userBack());
assert.equal(overhaul().libraryPage, null, "back closes the Settings page");
assert.equal(useChatStore.getState().activeChatId, "chat-1", "…and shows the chat again");
assert.ok(history.userBack());
assert.equal(useChatStore.getState().activeChatId, null, "back from the chat is Home");
assert.equal(history.userBack(), false, "back from Home leaves");

// ── 2. The same on a desktop browser with a mouse: no layers, back is never trapped ──
reset({ desktop: true, touch: false });
useChatStore.setState({ activeChatId: "chat-1" });
overhaul().setLibraryPage("settings");
assert.deepEqual(ids(), [], "no touch flag, no page layers");
assert.equal(history.index, 0);

// ── 3. Touch desktop shell: Chat settings is a layer; back closes it, then the chat goes Home ──
reset({ desktop: true, touch: true });
useChatStore.setState({ activeChatId: "chat-1" });
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
assert.deepEqual(ids(), ["phone-home", "chat-settings"]);
assert.ok(history.userBack());
// The close is the guarded one (it may ask about unsaved edits), so it lands a moment later.
await settle();
assert.notEqual(useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID], true, "back closed Chat settings");
assert.equal(useChatStore.getState().activeChatId, "chat-1");
reset({ desktop: true, touch: false });
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
assert.deepEqual(ids(), [], "a mouse desktop's docked Chat settings is layout, not a layer");

// ── 4. Rotating with a page and Chat settings open pushes and pops nothing ──
reset({ desktop: false, touch: true });
useChatStore.setState({ activeChatId: "chat-1" });
overhaul().setLibraryPage("presets");
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
const beforeRotation = history.pushes;
overhaul().setDesktop(true);
assert.equal(history.queued, 0, "rotating to landscape pops nothing");
overhaul().setDesktop(false);
assert.equal(history.pushes, beforeRotation, "rotating back pushes nothing");

// ── 5. Phone: a section picked from the Library list returns to the list, one level per press ──
reset({ desktop: false, touch: true });
useChatStore.setState({ activeChatId: "chat-1" });
overhaul().setMobileSidePageOpen(true);
assert.deepEqual(ids(), ["phone-home", "side-page"]);
const pushesBefore = history.pushes;
pickFromLibraryList(() => {
  overhaul().setSidePane("library");
  ui().openCharacterLibrary();
});
assert.equal(history.queued, 0, "picking a section pops nothing");
assert.equal(history.pushes, pushesBefore + 1, "…and its one new entry is pushed inside the tap");
assert.deepEqual(ids(), ["phone-home", "library-hub", "detail"]);
const pushesBeforeWren = history.pushes;
ui().openCharacterDetail("wren");
assert.deepEqual(ids(), ["phone-home", "library-hub", "detail", "detail-1"], "Wren over Characters is its own layer");
assert.equal(history.pushes, pushesBeforeWren + 1, "…pushed inside the tap that opened Wren");
assert.equal(history.index, 4);
await settle();
const pushesBeforeBack = history.pushes;
assert.ok(history.userBack());
assert.equal(ui().characterDetailId, null, "back from Wren…");
assert.ok(ui().hasAnyDetailOpen(), "…shows Characters");
assert.equal(overhaul().mobileSidePageOpen, false);
await settle();
assert.equal(history.pushes, pushesBeforeBack, "no entry re-pushed after the press (Safari would skip it)");
assert.equal(history.index, 3);
assert.ok(history.userBack());
assert.equal(ui().hasAnyDetailOpen(), false, "back from Characters…");
assert.equal(overhaul().mobileSidePageOpen, true, "…shows the Library list again");
assert.equal(overhaul().sidePane, "library");
assert.equal(history.queued, 0, "swapping the section for the list pops nothing");
assert.deepEqual(ids(), ["phone-home", "side-page"]);
assert.ok(history.userBack());
assert.equal(overhaul().mobileSidePageOpen, false, "back from the list is the chat");
assert.equal(useChatStore.getState().activeChatId, "chat-1");
assert.ok(history.userBack());
assert.equal(useChatStore.getState().activeChatId, null, "then Home");
assert.equal(history.userBack(), false, "then out");
assert.equal(history.index, 0);
await settle();

// ── 6. A Library page (not an editor) picked from the list does the same; quick presses step one level each ──
reset({ desktop: false, touch: true });
overhaul().setMobileSidePageOpen(true);
pickFromLibraryList(() => overhaul().setLibraryPage("lorebooks"));
assert.deepEqual(ids(), ["library-hub", "library-page"]);
history.userBack();
history.userBack();
assert.equal(overhaul().libraryPage, null);
assert.equal(overhaul().mobileSidePageOpen, false, "the second quick press closed the list");
assert.equal(history.index, 0);
assert.equal(history.userBack(), false, "Home: back leaves");
await settle();

// ── 7. Closed some other way, the section forgets the list; a later Ctrl+K open goes back to the chat ──
reset({ desktop: false, touch: true });
useChatStore.setState({ activeChatId: "chat-1" });
overhaul().setMobileSidePageOpen(true);
pickFromLibraryList(() => ui().openCharacterLibrary());
ui().closeTopMainSurface(); // the page's own Back button
await settle();
assert.equal(overhaul().libraryHubReturn, false, "the flag goes with the section");
ui().openCharacterLibrary();
assert.deepEqual(ids(), ["phone-home", "detail"]);
history.userBack();
assert.equal(overhaul().mobileSidePageOpen, false, "back from a section opened elsewhere is the chat");
assert.equal(useChatStore.getState().activeChatId, "chat-1");
await settle();

// ── 8. Opening Docs (or a chat) from a picked section drops the way back to the list ──
reset({ desktop: false, touch: true });
overhaul().setMobileSidePageOpen(true);
pickFromLibraryList(() => overhaul().setLibraryPage("presets"));
overhaul().openDocs(null);
assert.equal(overhaul().libraryHubReturn, false);
assert.deepEqual(ids(), ["phone-home"]);
await settle();

// ── 9. Chat settings editor pages (QC panel 3): back leaves the page first and asks about unsaved edits ──
reset({ desktop: true, touch: true });
const subpage = () => useChatSettingsSubpage.getState();
const stopCloseWatch = watchChatSettingsClose();
unsubscribe.push(
  useChatSettingsSubpage.subscribe(syncBackNavigation),
  useMobileChatSettingsNav.subscribe(syncBackNavigation),
);
useChatStore.setState({ activeChatId: "chat-1" });
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
subpage().openSubpage("chat-1", "variables");
assert.deepEqual(ids(), ["phone-home", "chat-settings", "chat-settings-sub"], "an editor page is a level of its own");
assert.equal(history.index, 3, "…with its own history entry");
let answer = false;
let asked = 0;
subpage().setGuard({ isDirty: () => true, confirmLeave: async () => (asked++, answer) });
assert.ok(history.userBack());
await settle();
assert.equal(asked, 1, "back asks about the unsaved edits");
assert.equal(subpage().subpage?.id, "variables", "Keep editing keeps the page");
assert.equal(useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID], true, "…and Chat settings");
answer = true;
assert.ok(history.userBack());
await settle();
assert.equal(subpage().subpage, null, "Discard leaves the page…");
assert.equal(useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID], true, "…to the settings, still open");
assert.ok(history.userBack());
await settle();
assert.notEqual(useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID], true, "the next back closes it");

// A forced close (a chat switch, the drawer unmounting) still leaves no stale page for the next open.
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
subpage().openSubpage("chat-1", "memories");
useFloatingWindowStore.getState().dismissWindow(CHAT_SETTINGS_WINDOW_ID, { force: true });
assert.equal(subpage().subpage, null, "closing Chat settings by any path leaves its editor page");
await settle();

// ── 10. Phone sheet: one entry per level (sheet, All settings, a section's page, an editor page) ──
reset({ desktop: false, touch: true });
unsubscribe.push(
  useChatSettingsSubpage.subscribe(syncBackNavigation),
  useMobileChatSettingsNav.subscribe(syncBackNavigation),
);
const nav = () => useMobileChatSettingsNav.getState();
useChatStore.setState({ activeChatId: "chat-1" });
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
nav().showQuick();
nav().showAll();
nav().showPage("chat-variables");
subpage().openSubpage("chat-1", "variables");
assert.deepEqual(ids(), [
  "phone-home",
  "chat-settings",
  "chat-settings-all",
  "chat-settings-page",
  "chat-settings-sub",
]);
assert.equal(history.index, 5);
const pushesBeforeSheetBack = history.pushes;
for (const expected of ["page", "all", "quick"] as const) {
  assert.ok(history.userBack());
  await settle();
  assert.equal(nav().view, expected, `back steps up to ${expected}`);
}
assert.equal(subpage().subpage, null);
assert.equal(history.pushes, pushesBeforeSheetBack, "no entry re-pushed between presses (Safari would skip it)");
assert.ok(history.userBack());
await settle();
assert.notEqual(useFloatingWindowStore.getState().open[CHAT_SETTINGS_WINDOW_ID], true, "then back closes the sheet");

// ── 11. A page opened from Chat settings keeps Chat settings' entries under it, so back reopens it pushing nothing ──
reset({ desktop: false, touch: true });
unsubscribe.push(
  useChatSettingsSubpage.subscribe(syncBackNavigation),
  useMobileChatSettingsNav.subscribe(syncBackNavigation),
);
useChatStore.setState({ activeChatId: "chat-1" });
useFloatingWindowStore.setState({ open: { [CHAT_SETTINGS_WINDOW_ID]: true } });
nav().showAll();
nav().showPage("roleplay-agents");
assert.equal(history.index, 4);
batchBackLayers(() => {
  ui().setChatSettingsReturn({
    chatId: "chat-1",
    section: null,
    mobileNav: { view: "page", page: "roleplay-agents", back: "all" },
  });
  useFloatingWindowStore.setState({ open: {} });
  ui().openAgentCatalog();
});
assert.deepEqual(ids(), [
  "phone-home",
  "chat-settings-return",
  "chat-settings-return-1",
  "chat-settings-return-2",
  "detail",
]);
assert.equal(history.index, 5, "opening Agent Organizer adds one entry");
stopCloseWatch();

for (const stop of unsubscribe) stop();
console.log("touch back-layer regression checks passed");
