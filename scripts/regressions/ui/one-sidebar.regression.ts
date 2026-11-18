import assert from "node:assert/strict";

// One sidebar: on desktop, as on a phone, Chats and the other panels take each other's place. The side it docks to is
// a saved and synced Appearance setting (Right by default), and a chat list saved open beside a panel (the old
// two-sidebar layout) gives the panel its place on load. This drives the real store.

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
  const {
    useUIStore,
    pickPersistedUIState,
    pickSyncedSettings,
    selectOneSidebarOpen,
    selectSharedSidebarWidth,
    selectSidebarShown,
    SHARED_SIDEBAR_WIDTH_MAX,
    SHARED_SIDEBAR_WIDTH_MIN,
  } = await import("../../../packages/client/src/stores/ui.store.js");
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

  for (const isMobile of [false, true]) {
    const where = isMobile ? "phone" : "desktop";

    // 1. A panel takes Chats' place, and Chats a panel's, from every way in.
    reset(isMobile);
    ui().setSidebarOpen(true);
    assert.equal(selectSidebarShown(ui()), true, `${where}: Chats opens`);
    ui().openRightPanel("characters");
    assert.equal(ui().sidebarOpen, false, `${where}: opening Characters closes Chats`);
    assert.equal(selectSidebarShown(ui()), false);
    assert.equal(selectOneSidebarOpen(ui()), true, `${where}: the sidebar stays open, on Characters`);
    ui().toggleSidebar();
    assert.equal(ui().rightPanelOpen, false, `${where}: the Chats button puts Chats in Characters' place`);
    assert.equal(selectSidebarShown(ui()), true);
    ui().toggleRightPanel("personas");
    assert.equal(ui().sidebarOpen, false, `${where}: a panel button puts its panel in Chats' place`);
    assert.equal(ui().rightPanel, "personas");
    ui().setSidebarOpen(true);
    assert.equal(ui().rightPanelOpen, false, `${where}: opening Chats from anywhere else closes the panel`);
    ui().openRightPanel("settings");
    ui().requestChatModeShortcut("roleplay");
    assert.equal(ui().rightPanelOpen, false, `${where}: a chat-mode shortcut opens Chats in the panel's place`);
    assert.equal(selectSidebarShown(ui()), true);
    ui().toggleSidebar();
    assert.equal(selectOneSidebarOpen(ui()), false, `${where}: the Chats button closes the sidebar`);

    // 2. Closing the chat list (a game starting, a package) leaves an open panel alone.
    ui().openRightPanel("agents");
    ui().setSidebarOpen(false);
    assert.equal(ui().rightPanelOpen, true, `${where}: closing Chats keeps Agents open`);
    assert.equal(ui().rightPanel, "agents");

    // 3. A stale pair (a synced sidebarOpen arriving beside an open panel) draws the panel, never both, and closing
    //    the panel, by its button or otherwise, closes the sidebar instead of showing Chats.
    useUIStore.setState({ sidebarOpen: true, rightPanelOpen: true, rightPanel: "characters" });
    assert.equal(selectSidebarShown(ui()), false, `${where}: an open panel is drawn in Chats' place`);
    assert.equal(selectOneSidebarOpen(ui()), true);
    ui().closeRightPanel();
    assert.equal(selectOneSidebarOpen(ui()), false, `${where}: closing the panel closes the sidebar`);
    useUIStore.setState({ sidebarOpen: true, rightPanelOpen: true, rightPanel: "characters" });
    ui().toggleRightPanel("characters");
    assert.equal(selectOneSidebarOpen(ui()), false, `${where}: the panel's own button closes the sidebar`);
    ui().setSidebarOpen(true);
    ui().closeRightPanel();
    assert.equal(selectSidebarShown(ui()), true, `${where}: closing a panel that is not open leaves Chats open`);
  }

  // 4. The side: Right by default, saved and synced, unknown values fall back to Right, Reset Appearance restores it.
  reset();
  assert.equal(ui().sidebarSide, "right");
  ui().setSidebarSide("left");
  assert.equal(pickPersistedUIState(ui()).sidebarSide, "left", "the side is saved in the browser");
  assert.equal(pickSyncedSettings(ui()).sidebarSide, "left", "and follows the user to their other computers");
  ui().setSidebarSide("up" as never);
  assert.equal(ui().sidebarSide, "right", "an unknown side keeps the sidebar on the right");
  ui().setSidebarSide("left");
  ui().resetAppearanceSettings();
  assert.equal(ui().sidebarSide, "right", "Reset Appearance puts the sidebar back on the right");

  // 5. Loading saved state through the store's real merge.
  const merge = useUIStore.persist.getOptions().merge;
  assert.ok(merge, "the UI store must keep its persisted-state merge");
  const load = (persisted: Record<string, unknown>) => merge(persisted, useUIStore.getInitialState());
  const twoSidebars = load({ sidebarOpen: true, rightPanelOpen: true, rightPanel: "presets", sidebarSide: "sideways" });
  assert.equal(twoSidebars.sidebarOpen, false, "Chats saved open beside Presets gives Presets the sidebar");
  assert.equal(twoSidebars.rightPanelOpen, true);
  assert.equal(twoSidebars.rightPanel, "presets");
  assert.equal(twoSidebars.sidebarSide, "right", "an unknown saved side loads as Right");
  const chatsOnLeft = load({ sidebarOpen: true, rightPanelOpen: false, sidebarSide: "left" });
  assert.equal(chatsOnLeft.sidebarOpen, true, "Chats saved open on its own stays open");
  assert.equal(chatsOnLeft.sidebarSide, "left");
  assert.equal(load({ sidebarOpen: false }).sidebarSide, "right", "a save from before the setting loads as Right");

  // 6. One width, in the range both stored widths accept.
  useUIStore.setState({ sidebarWidth: 240, rightPanelWidth: 0 });
  assert.equal(selectSharedSidebarWidth(ui()), SHARED_SIDEBAR_WIDTH_MIN);
  useUIStore.setState({ sidebarWidth: 320, rightPanelWidth: 520 });
  assert.equal(selectSharedSidebarWidth(ui()), SHARED_SIDEBAR_WIDTH_MAX);
  useUIStore.setState({ rightPanelWidth: 400 });
  assert.equal(selectSharedSidebarWidth(ui()), 400);
}

process.stdout.write("One sidebar regression passed\n");
