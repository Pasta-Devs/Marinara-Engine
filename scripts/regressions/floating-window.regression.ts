// #7036: shared floating windows keep a valid, on-screen layout and a stable theming contract.
// #7034 step 4: drawers pop out into windows, and each chat saves its own layout.
// #7034 step 3: chat control windows minimize to bubbles that snap into line and save with the chat.
// #7034 step 6: phones show those windows, popped-out drawers and the Tracker Panel as bubbles whose
// places save apart from the computer's.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FLOATING_WINDOW_LAYOUT_VERSION,
  clampWindowGeometry,
  getDrawerWindowId,
  isEmptyWindowLayoutSnapshot,
  isHostDrawerWindowId,
  moveWindowGeometry,
  parseWindowLayoutSnapshot,
  placeDetachedDrawer,
  resizeWindowGeometry,
  serializeWindowLayoutSnapshot,
  toWindowLayoutSnapshot,
  clampWindowBubble,
  placeWindowBubbles,
  getBubbleRowSlot,
  getTopRightBubblePoint,
  getPhoneBubbleSlot,
  placeWindowBesideBubble,
  PHONE_BUBBLE_SIZE_PX,
} from "../../packages/client/src/lib/floating-window-layout.js";
import {
  CHAT_SETTINGS_WINDOW_ID,
  TRACKER_WINDOW_ID,
  selectHasDetachedDrawers,
  selectWindowLayoutSnapshot,
  selectWindowRestored,
  takeFloatingWindowFocusRequest,
  useFloatingWindowStore,
} from "../../packages/client/src/stores/floating-window.store.js";
import { snapBubble } from "../../packages/client/src/lib/window-bubble-snap.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

// ── Geometry stays inside the bounds ──
const bounds = { left: 8, top: 56, right: 1432, bottom: 892 };
const limits = { minWidth: 320, minHeight: 240 };
assert.deepEqual(clampWindowGeometry({ x: 100, y: 100, width: 500, height: 400 }, bounds, limits), {
  x: 100,
  y: 100,
  width: 500,
  height: 400,
});
assert.deepEqual(clampWindowGeometry({ x: 5000, y: -50, width: 500, height: 400 }, bounds, limits), {
  x: 932,
  y: 56,
  width: 500,
  height: 400,
});
assert.deepEqual(
  clampWindowGeometry({ x: Number.NaN, y: Number.POSITIVE_INFINITY, width: 99999, height: 10 }, bounds, limits),
  { x: 8, y: 56, width: 1424, height: 240 },
  "non-finite positions fall back into view and sizes respect the limits",
);
assert.deepEqual(
  clampWindowGeometry(
    { x: 300, y: 300, width: 500, height: 400 },
    { left: 8, top: 56, right: 200, bottom: 150 },
    limits,
  ),
  { x: 8, y: 56, width: 320, height: 240 },
  "a viewport smaller than the minimum keeps the title bar at the top-left corner",
);
assert.deepEqual(moveWindowGeometry({ x: 100, y: 100, width: 500, height: 400 }, -500, 2000, bounds, limits), {
  x: 8,
  y: 492,
  width: 500,
  height: 400,
});

// Resizing moves only the dragged edges.
const start = { x: 400, y: 200, width: 500, height: 400 };
assert.deepEqual(resizeWindowGeometry(start, "se", 40, -60, bounds, limits), { ...start, width: 540, height: 340 });
assert.deepEqual(resizeWindowGeometry(start, "w", -50, 0, bounds, limits), { ...start, x: 350, width: 550 });
assert.deepEqual(resizeWindowGeometry(start, "n", 0, 1000, bounds, limits), { ...start, y: 360, height: 240 });
assert.deepEqual(resizeWindowGeometry(start, "nw", -1000, -1000, bounds, limits), {
  x: 8,
  y: 56,
  width: 892,
  height: 544,
});
assert.deepEqual(resizeWindowGeometry(start, "e", 5000, 0, bounds, limits), { ...start, width: 1032 });

// ── Stored layouts survive old, missing and corrupt values ──
const valid = { x: 10, y: 20, width: 400, height: 300, pinned: true, locked: false };
assert.deepEqual(parseWindowLayoutSnapshot(undefined).windows, {});
assert.deepEqual(parseWindowLayoutSnapshot("not json").windows, {});
assert.deepEqual(parseWindowLayoutSnapshot([valid]).windows, {});
assert.deepEqual(parseWindowLayoutSnapshot({ version: 0, windows: { a: valid } }).windows, {}, "older versions reset");
assert.deepEqual(parseWindowLayoutSnapshot({ version: FLOATING_WINDOW_LAYOUT_VERSION, windows: [] }).windows, {});
assert.deepEqual(
  parseWindowLayoutSnapshot({
    version: FLOATING_WINDOW_LAYOUT_VERSION,
    windows: {
      good: valid,
      nan: { ...valid, x: Number.NaN },
      text: { ...valid, y: "20" },
      empty: { ...valid, width: 0 },
      huge: { ...valid, height: 1e9 },
      flag: { ...valid, pinned: "yes" },
      missing: { x: 1, y: 2, width: 300, height: 300 },
      [""]: valid,
      ["x".repeat(500)]: valid,
    },
  }).windows,
  { good: valid },
);
assert.deepEqual(parseWindowLayoutSnapshot(JSON.parse(JSON.stringify(toWindowLayoutSnapshot({ good: valid })))), {
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: { good: valid },
});

// ── Popped-out drawers: ids per host, and a saved list that never trusts bad entries ──
const settingsDrawer = getDrawerWindowId(CHAT_SETTINGS_WINDOW_ID, "chat-name");
const trackerDrawer = getDrawerWindowId(TRACKER_WINDOW_ID, "agent-activity");
const unopenedDrawer = getDrawerWindowId(CHAT_SETTINGS_WINDOW_ID, "no-layout");
assert.equal(settingsDrawer, "drawer:chat-settings:chat-name");
assert.notEqual(
  getDrawerWindowId(CHAT_SETTINGS_WINDOW_ID, "agent-activity"),
  trackerDrawer,
  "hosts may share drawer ids",
);
assert.equal(isHostDrawerWindowId(settingsDrawer, CHAT_SETTINGS_WINDOW_ID), true);
assert.equal(isHostDrawerWindowId(trackerDrawer, CHAT_SETTINGS_WINDOW_ID), false);
assert.equal(isHostDrawerWindowId(CHAT_SETTINGS_WINDOW_ID, CHAT_SETTINGS_WINDOW_ID), false);
const withDrawers = {
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: { [settingsDrawer]: valid, [trackerDrawer]: valid, [CHAT_SETTINGS_WINDOW_ID]: valid },
  detached: [settingsDrawer, settingsDrawer, trackerDrawer, CHAT_SETTINGS_WINDOW_ID, unopenedDrawer, 42, null],
};
assert.deepEqual(
  parseWindowLayoutSnapshot(withDrawers).detached,
  [settingsDrawer, trackerDrawer, unopenedDrawer],
  "valid drawers stay popped out once each, including migrated buttons whose windows have never opened",
);
assert.equal(parseWindowLayoutSnapshot({ ...withDrawers, detached: "all" }).detached, undefined);
assert.equal(
  parseWindowLayoutSnapshot({ version: FLOATING_WINDOW_LAYOUT_VERSION, windows: { good: valid } }).detached,
  undefined,
  "a layout saved before pop-out existed loads with every drawer in place",
);
assert.deepEqual(
  parseWindowLayoutSnapshot(
    JSON.parse(JSON.stringify(toWindowLayoutSnapshot({ [settingsDrawer]: valid }, [settingsDrawer]))),
  ),
  { version: FLOATING_WINDOW_LAYOUT_VERSION, windows: { [settingsDrawer]: valid }, detached: [settingsDrawer] },
);
assert.equal(isEmptyWindowLayoutSnapshot(parseWindowLayoutSnapshot(null)), true);
assert.equal(isEmptyWindowLayoutSnapshot(parseWindowLayoutSnapshot(withDrawers)), false);
assert.equal(
  serializeWindowLayoutSnapshot({
    version: FLOATING_WINDOW_LAYOUT_VERSION,
    windows: { good: { locked: false, pinned: true, height: 300, width: 400, y: 20, x: 10 } },
  }),
  serializeWindowLayoutSnapshot(toWindowLayoutSnapshot({ good: valid })),
  "the same layout compares equal whatever order its fields were saved in",
);
assert.equal(serializeWindowLayoutSnapshot("{broken"), serializeWindowLayoutSnapshot(null));

// A drawer popped out with its button opens beside its host, level with where it was.
const host = { x: 900, y: 80, width: 520, height: 700 };
const source = { x: 916, y: 300, width: 488, height: 200 };
const size = { width: 400, height: 320 };
assert.deepEqual(placeDetachedDrawer(source, host, size, bounds, limits), { x: 488, y: 300, ...size }, "left first");
assert.deepEqual(
  placeDetachedDrawer({ ...source, x: 24 }, { ...host, x: 8 }, size, bounds, limits),
  { x: 540, y: 300, ...size },
  "right when the left is full",
);
assert.deepEqual(
  placeDetachedDrawer(source, { ...host, x: 300, width: 900 }, size, bounds, limits),
  { x: 940, y: 300, ...size },
  "over the host, a little offset, when neither side has room",
);
assert.deepEqual(
  placeDetachedDrawer({ ...source, y: 800 }, host, size, bounds, limits),
  { x: 488, y: 572, ...size },
  "kept on screen",
);

// ── Store: open state, hosts, pinning and Reset View ──
const store = useFloatingWindowStore;
const id = CHAT_SETTINGS_WINDOW_ID;
const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));
store.getState().openWindow(id);
store.getState().openWindow("other");
assert.deepEqual(store.getState().stack, [id, "other"]);
assert.equal(takeFloatingWindowFocusRequest(id), true, "opening a window asks it to take focus");
assert.equal(takeFloatingWindowFocusRequest(id), false, "only once, so a remount leaves focus alone");
store.getState().openWindow(id);
assert.equal(takeFloatingWindowFocusRequest(id), false, "reopening an open window does not move focus");
store.getState().bringToFront(id);
assert.deepEqual(store.getState().stack, ["other", id], "the last pressed window is in front");
store.getState().toggleWindow("other");
assert.equal(store.getState().open.other, undefined);

let release = store.getState().registerHost(id);
release();
release = store.getState().registerHost(id);
await flushMicrotasks();
assert.equal(store.getState().open[id], true, "a host that re-registers straight away keeps the window open");
release();
await flushMicrotasks();
assert.equal(store.getState().open[id], undefined, "an unpinned window closes with its last host");

store.getState().saveLayout(id, valid);
store.getState().openWindow(id);
release = store.getState().registerHost(id);
release();
await flushMicrotasks();
assert.equal(store.getState().open[id], true, "a pinned window waits for a host to come back");

// Popping a drawer out opens its window in front, with focus; putting it back forgets the window.
store.getState().detachDrawer(settingsDrawer, valid);
assert.equal(store.getState().detached[settingsDrawer], true);
assert.equal(store.getState().open[settingsDrawer], true);
assert.equal(store.getState().stack.at(-1), settingsDrawer);
assert.equal(takeFloatingWindowFocusRequest(settingsDrawer), true);
assert.equal(selectHasDetachedDrawers(store.getState(), CHAT_SETTINGS_WINDOW_ID), true);
assert.equal(selectHasDetachedDrawers(store.getState(), TRACKER_WINDOW_ID), false);
store.getState().detachDrawer(trackerDrawer, valid, { focus: false });
assert.equal(
  takeFloatingWindowFocusRequest(trackerDrawer),
  false,
  "a drawer restored with its chat leaves focus alone",
);
assert.deepEqual(selectWindowLayoutSnapshot(store.getState()).detached, [settingsDrawer, trackerDrawer]);
store.getState().saveBubble(trackerDrawer, { x: 400, y: 120 });
store.getState().dockDrawer(trackerDrawer);
assert.equal(store.getState().detached[trackerDrawer], undefined);
assert.equal(store.getState().layouts[trackerDrawer], undefined);
assert.equal(store.getState().open[trackerDrawer], undefined);
assert.equal(store.getState().bubbles[trackerDrawer], undefined, "putting a drawer back forgets its desktop button");
assert.equal(selectHasDetachedDrawers(store.getState(), TRACKER_WINDOW_ID), false);

const revision = store.getState().resetRevision;
store.getState().resetView();
assert.deepEqual(store.getState().layouts, {});
assert.deepEqual(store.getState().detached, {}, "Reset View puts every drawer back");
assert.equal(store.getState().resetRevision, revision + 1);
assert.equal(isEmptyWindowLayoutSnapshot(selectWindowLayoutSnapshot(store.getState())), true);

// A chat's saved layout replaces the previous one; bad data loads as the defaults.
store.getState().hydrate(withDrawers);
assert.deepEqual(Object.keys(store.getState().detached), [settingsDrawer, trackerDrawer, unopenedDrawer]);
assert.equal(
  serializeWindowLayoutSnapshot(selectWindowLayoutSnapshot(store.getState())),
  serializeWindowLayoutSnapshot(withDrawers),
  "what a chat loads is what it saves back",
);
store
  .getState()
  .hydrate({ version: FLOATING_WINDOW_LAYOUT_VERSION, windows: { [id]: valid, bad: { ...valid, x: "?" } } } as never);
assert.deepEqual(store.getState().layouts, { [id]: valid });
assert.deepEqual(store.getState().detached, {}, "the next chat's drawers start in place");
for (const bad of [undefined, null, "{broken", 7, [], { version: 99, windows: { [id]: valid } }]) {
  store.getState().hydrate(bad);
  assert.deepEqual(store.getState().layouts, {});
  assert.deepEqual(store.getState().detached, {});
}
store.getState().hydrate({ version: FLOATING_WINDOW_LAYOUT_VERSION, windows: { [id]: valid } });

// Other panels dismiss an unpinned window only; its own close button forces it shut.
store.getState().openWindow(id);
assert.equal(store.getState().dismissWindow(id), false, "a pinned window stays when another panel opens");
assert.equal(store.getState().open[id], true);
assert.equal(store.getState().dismissWindow(id, { force: true }), true);
assert.equal(store.getState().open[id], undefined);
store.getState().resetView();
store.getState().openWindow(id);
assert.equal(store.getState().dismissWindow(id), true, "an unpinned window closes");
assert.equal(store.getState().dismissWindow(id), false, "a closed window has nothing to close");

// A reload restores pinned windows, but an explicit close or minimize still wins.
store.setState({ open: {}, stack: [] });
takeFloatingWindowFocusRequest(id);
store.getState().hydrate({
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: {
    [id]: valid,
    "control:session": { ...valid, minimized: false },
    [settingsDrawer]: { ...valid, minimized: true },
    unpinned: { ...valid, pinned: false },
  },
  detached: [settingsDrawer],
});
assert.equal(store.getState().open[id], true, "a saved pinned Chat Settings reopens without a click");
assert.equal(store.getState().open["control:session"], true, "a pinned control window restores too");
assert.equal(store.getState().open[settingsDrawer], undefined, "a minimized pinned drawer stays a bubble");
assert.equal(store.getState().open.unpinned, undefined, "unpinned windows keep their existing open behavior");
assert.ok(store.getState().stack.includes(id), "restored windows join the stacking order");
assert.equal(takeFloatingWindowFocusRequest(id), false, "restoring a layout does not request keyboard focus");

store.getState().closeWindow(id);
assert.equal(store.getState().layouts[id]?.minimized, undefined, "unmount cleanup does not save a user close");
store.getState().hydrate(selectWindowLayoutSnapshot(store.getState()));
assert.equal(store.getState().open[id], true);
store.getState().dismissWindow(id, { force: true });
const closedSnapshot = selectWindowLayoutSnapshot(store.getState());
assert.equal(closedSnapshot.windows[id]?.minimized, true, "explicitly closing a pinned window is remembered");
store.setState({ open: {}, stack: [] });
store.getState().hydrate(closedSnapshot);
assert.equal(store.getState().open[id], undefined, "a deliberately closed pinned window stays closed after reload");
store.getState().openWindow(id);
assert.equal(store.getState().layouts[id]?.minimized, false, "opening it again clears the saved close state");
store.getState().resetView();
assert.deepEqual(store.getState().layouts, {}, "Reset View forgets saved open and closed preferences too");
store.setState({ open: {}, stack: [] });
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: true }) } });
try {
  store.getState().hydrate({ version: FLOATING_WINDOW_LAYOUT_VERSION, windows: { [id]: valid } });
  assert.equal(store.getState().open[id], undefined, "a desktop pin does not force a phone sheet open");
} finally {
  if (windowDescriptor) Object.defineProperty(globalThis, "window", windowDescriptor);
  else Reflect.deleteProperty(globalThis, "window");
  store.getState().resetView();
}

// ── Theming contract: stable classes, attributes and variables ──
const floatingWindow = read("packages/client/src/components/ui/FloatingWindow.tsx");
const drawer = read("packages/client/src/components/ui/Drawer.tsx");
const globals = read("packages/client/src/styles/globals.css");
for (const part of [
  "mari-window ",
  "mari-window__header",
  "mari-window__title",
  "mari-window__controls",
  "mari-window__body",
  "mari-window__resize-handle",
]) {
  assert.ok(floatingWindow.includes(part), `FloatingWindow must render ${part.trim()}`);
}
for (const attribute of ["data-window={id}", "data-pinned=", "data-locked=", "data-detached="]) {
  assert.ok(floatingWindow.includes(attribute), `FloatingWindow must expose ${attribute}`);
}
for (const part of ['"mari-drawer"', "mari-drawer__header", "mari-drawer__title", "mari-drawer__body"]) {
  assert.ok(drawer.includes(part), `Drawer must render ${part}`);
}
for (const attribute of ["data-drawer={id}", "data-detached="]) assert.ok(drawer.includes(attribute));
const variables = [...globals.matchAll(/^\s+(--mari-(?:window|drawer)-[a-z-]+)\s/gmu)].map((match) => match[1]!);
assert.ok(variables.length >= 30, "globals.css must document the window and drawer variables");
for (const variable of variables) {
  assert.match(
    globals,
    new RegExp(`var\\(\\s*${variable}\\s*,`, "u"),
    `${variable} must be read with a theme-token fallback`,
  );
}
assert.match(
  globals,
  /\[data-marinara-chat-chrome-accent-mode="gradient"\] \.marinara-chat-popover:not\(\.mari-window\)/u,
  "gradient chrome must not override the window variables",
);
assert.match(
  globals,
  /@layer components \{\s*\.mari-window \{[\s\S]*?\.mari-drawer__body \{[^}]*\}[^@]*?\.mari-window\[data-drop-target="true"\] \{[^}]*\}\s*\}/u,
  "window and drawer defaults sit in the components layer, so classes passed to them win",
);
// Every drawer in a host gets the pop-out button in the slot between its help tip and its arrow.
assert.match(
  drawer,
  /mari-drawer__help[\s\S]*?mari-drawer__actions[\s\S]*?data-drawer-control="pop-out"[\s\S]*?mari-drawer__arrow/u,
);
for (const host of [
  "packages/client/src/components/chat/ChatSettingsDrawer.tsx",
  "packages/client/src/components/chat/RoleplayTrackerWindow.tsx",
]) {
  assert.match(read(host), /<FloatingWindow\b(?:(?!>\n)[\s\S])*?\bdrawerHost=\{\{/u, `${host} hosts pop-out drawers`);
}

// Chat Settings renders through the shared window and its sections through the shared drawer.
assert.match(read("packages/client/src/components/chat/ChatSettingsDrawer.tsx"), /<FloatingWindow\b/u);
assert.match(read("packages/client/src/components/chat/ChatCommonOverlays.tsx"), /<FloatingWindow\b/u);
assert.match(read("packages/client/src/features/chat-settings/ChatSettingsSection.tsx"), /<Drawer\b/u);
assert.match(
  read("packages/client/src/features/chat-settings/sections/AdvancedParametersSection.tsx"),
  /<Drawer\b[\s\S]*?id="advanced-parameters"/u,
  "Advanced Parameters is a shared drawer too",
);
// Grids inside the window follow its width, not the screen's: a narrow window must not squeeze four columns.
assert.match(
  read("packages/client/src/components/chat/ChatSettingsDrawer.tsx"),
  /<GameWidgetSetupEditor\b(?:(?!\/>)[\s\S])*?\bcontainerQueries\b/u,
);
assert.match(
  read("packages/client/src/components/game/GameWidgetSetupEditor.tsx"),
  /containerQueries\s*\?\s*"@lg:grid-cols-\[3\.25rem_minmax\(0,1fr\)_9rem_auto\]/u,
);

// Hosted multiplayer: Players opens Chat Settings at its Multiplayer section; the next open starts at the top.
assert.match(
  read("packages/client/src/features/multiplayer/MultiplayerChat.tsx"),
  /useEffect\(\(\) => \{\s*if \(!settingsOpen\) setInitialSection\(null\);\s*\}, \[settingsOpen\]\);/u,
);

// ── Window bubbles ──
// Snapping: each axis on its own, within 8px, the nearest match winning; side by side it keeps an 8px gap.
const anchorBubble = { x: 100, y: 100, width: 32, height: 32 };
const bubbleSize = { width: 32, height: 32 };
// Centre (and so both edges, at equal sizes) in line: x snaps, y stays free.
assert.deepEqual(snapBubble({ ...bubbleSize, x: 106, y: 300 }, [anchorBubble]), {
  x: 100,
  y: 300,
  guides: [{ axis: "x", at: 100, from: 100, to: 332 }],
});
// An edge lining up with a differently sized bubble's edge: its right edge to the other's left.
assert.equal(snapBubble({ ...bubbleSize, x: 63, y: 300 }, [{ x: 100, y: 100, width: 64, height: 32 }]).x, 68);
// Outside the threshold nothing moves, and no guide shows.
// (Equal sizes: 150 is 18px past the right edge and 34px past the centre.)
assert.deepEqual(snapBubble({ ...bubbleSize, x: 150, y: 300 }, [anchorBubble]), { x: 150, y: 300, guides: [] });
// Just inside the threshold it still snaps: its left edge to the other's centre.
assert.equal(snapBubble({ ...bubbleSize, x: 109, y: 300 }, [anchorBubble]).x, 116);
assert.deepEqual(snapBubble({ ...bubbleSize, x: 300, y: 300 }, [anchorBubble]), { x: 300, y: 300, guides: [] });
// Beside it (touching, or near the gap): an 8px gap, with tops in line.
assert.deepEqual((({ x, y }) => ({ x, y }))(snapBubble({ ...bubbleSize, x: 134, y: 104 }, [anchorBubble])), {
  x: 140,
  y: 100,
});
assert.equal(snapBubble({ ...bubbleSize, x: 100 - 32 - 2, y: 100 }, [anchorBubble]).x, 100 - 32 - 8);
// Below it in a column: the gap on y, the centres in line on x.
assert.deepEqual((({ x, y }) => ({ x, y }))(snapBubble({ ...bubbleSize, x: 103, y: 135 }, [anchorBubble])), {
  x: 100,
  y: 140,
});
// The gap beats a closer edge match with another bubble (which would make the two touch).
assert.equal(
  snapBubble({ ...bubbleSize, x: 135, y: 98 }, [anchorBubble, { x: 100, y: 300, width: 32, height: 32 }]).x,
  140,
);
// The nearest of several matches wins.
assert.equal(
  snapBubble({ ...bubbleSize, x: 205, y: 400 }, [anchorBubble, { x: 203, y: 100, width: 32, height: 32 }]).x,
  203,
);
// Bubbles stay on screen; a window opens below its bubble, or above it near the bottom.
assert.deepEqual(clampWindowBubble({ x: -50, y: 5000 }, bounds), { x: 8, y: 860 });

// Sidebars squeeze a row of saved buttons into distinct visible places without changing the saved row.
const savedButtons = new Map(
  [16, 56, 96, 1200, 1240, 1280].map((x, index) => [
    String(index),
    { point: { x, y: 80 }, bounds: { left: 8, top: 56, right: 1320, bottom: 700 }, size: 32 },
  ]),
);
const originalButtonPositions = [...savedButtons].map(([id, bubble]) => [id, bubble.point]);
for (const narrowed of [
  { left: 8, top: 56, right: 960, bottom: 700 },
  { left: 368, top: 56, right: 1320, bottom: 700 },
  { left: 368, top: 56, right: 960, bottom: 700 },
]) {
  const visible = [
    ...placeWindowBubbles(
      new Map([...savedButtons].map(([id, bubble]) => [id, { ...bubble, bounds: narrowed }])),
    ).values(),
  ];
  for (const [index, point] of visible.entries()) {
    assert.deepEqual(point, clampWindowBubble(point, narrowed), "each squeezed button remains in the chat");
    for (const other of visible.slice(index + 1)) {
      assert.ok(
        Math.abs(point.x - other.x) >= 32 || Math.abs(point.y - other.y) >= 32,
        "squeezed buttons remain separately reachable",
      );
    }
  }
}
assert.deepEqual(
  [...placeWindowBubbles(savedButtons)],
  originalButtonPositions,
  "closing sidebars restores the saved arrangement",
);
assert.deepEqual(
  [...savedButtons].map(([id, bubble]) => [id, bubble.point]),
  originalButtonPositions,
  "temporary placement never rewrites saved points",
);
// The remaining space can fit a button even when it cannot also fit the usual snapping gap.
const tightBounds = { left: 0, top: 0, right: 100, bottom: 32 };
const tightPositions = placeWindowBubbles(
  new Map([
    ["left", { point: { x: 0, y: 0 }, bounds: tightBounds, size: 32 }],
    ["right", { point: { x: 68, y: 0 }, bounds: tightBounds, size: 32 }],
    ["overflow", { point: { x: 200, y: 0 }, bounds: tightBounds, size: 32 }],
  ]),
);
assert.equal(tightPositions.get("left")?.x, 0);
assert.equal(tightPositions.get("right")?.x, 68);
assert.ok(
  tightPositions.get("overflow")!.x >= 32 && tightPositions.get("overflow")!.x <= 36,
  "use the remaining narrow gap before overlapping a button",
);
const defaultCollisionBounds = { left: 8, top: 56, right: 960, bottom: 700 };
const defaultCollision = placeWindowBubbles(
  new Map([
    ["saved-drawer", { point: { x: 928, y: 80 }, bounds: defaultCollisionBounds, size: 32 }],
    ["default-settings", { point: { x: 928, y: 80, automatic: true }, bounds: defaultCollisionBounds, size: 32 }],
  ]),
);
assert.deepEqual(defaultCollision.get("saved-drawer"), { x: 928, y: 80 }, "a valid saved point keeps its place");
assert.notDeepEqual(
  defaultCollision.get("default-settings"),
  defaultCollision.get("saved-drawer"),
  "a moving default yields even when neither point needs clamping",
);
const controlLimits = { minWidth: 200, minHeight: 96 };
assert.deepEqual(placeWindowBesideBubble({ width: 280, height: 200 }, { x: 1000, y: 64 }, bounds, controlLimits), {
  x: 752,
  y: 104,
  width: 280,
  height: 200,
});
assert.equal(placeWindowBesideBubble({ width: 280, height: 300 }, { x: 1000, y: 800 }, bounds, controlLimits).y, 492);
assert.deepEqual(
  placeWindowBesideBubble({ width: 280, height: 700 }, { x: 1000, y: 400 }, bounds, controlLimits),
  { x: 752, y: 440, width: 280, height: 452 },
  "a tall window shortens to the available space below its button before falling back above it",
);
// Near the left edge it lines up with the bubble's left edge instead.
assert.equal(placeWindowBesideBubble({ width: 280, height: 200 }, { x: 40, y: 64 }, bounds, controlLimits).x, 40);

// Minimized state and bubble places save with the chat (still version 1; older layouts have neither).
const withBubble = parseWindowLayoutSnapshot({
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: {
    "control:volume": {
      x: 1,
      y: 2,
      width: 300,
      height: 200,
      pinned: false,
      locked: false,
      minimized: true,
      bubble: { x: 640, y: 64 },
    },
    "control:session": {
      x: 1,
      y: 2,
      width: 300,
      height: 200,
      pinned: false,
      locked: false,
      minimized: "yes",
      bubble: { x: "a" },
    },
  },
});
assert.deepEqual(withBubble.windows["control:volume"], {
  x: 1,
  y: 2,
  width: 300,
  height: 200,
  pinned: false,
  locked: false,
  minimized: true,
  bubble: { x: 640, y: 64 },
});
assert.deepEqual(withBubble.windows["control:session"], {
  x: 1,
  y: 2,
  width: 300,
  height: 200,
  pinned: false,
  locked: false,
});
useFloatingWindowStore.getState().hydrate(withBubble);
assert.deepEqual(selectWindowLayoutSnapshot(useFloatingWindowStore.getState()).windows["control:volume"]?.bubble, {
  x: 640,
  y: 64,
});
useFloatingWindowStore.getState().saveLayout("control:volume", {
  ...useFloatingWindowStore.getState().layouts["control:volume"]!,
  minimized: false,
});
useFloatingWindowStore.getState().minimizeWindow("control:volume");
assert.equal(useFloatingWindowStore.getState().layouts["control:volume"]?.minimized, true);
useFloatingWindowStore.getState().resetView();
assert.equal(
  useFloatingWindowStore.getState().layouts["control:volume"],
  undefined,
  "Reset View restores the defaults",
);

// Docked controls survive the same serialization used by chats and profiles, without reopening over their host.
const dockedControl = { ...valid, docked: true, minimized: false };
const dockedSnapshot = parseWindowLayoutSnapshot({
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: { "control:session": dockedControl, "control:assets": { ...valid, docked: "yes" } },
});
assert.equal(dockedSnapshot.windows["control:session"]?.docked, true);
assert.equal(dockedSnapshot.windows["control:assets"]?.docked, undefined, "invalid docking flags are ignored");
store.getState().openWindow("control:session");
store.getState().hydrate(JSON.parse(serializeWindowLayoutSnapshot(dockedSnapshot)));
assert.equal(store.getState().open["control:session"], undefined, "pinning does not reopen a docked control");
assert.equal(selectWindowLayoutSnapshot(store.getState()).windows["control:session"]?.docked, true);
store.getState().closeWindow(CHAT_SETTINGS_WINDOW_ID);
assert.equal(
  selectWindowRestored(store.getState(), "control:session"),
  false,
  "a closed host does not pause Game narration",
);
store.getState().openWindow(CHAT_SETTINGS_WINDOW_ID);
assert.equal(
  selectWindowRestored(store.getState(), "control:session"),
  true,
  "a docked control follows host visibility",
);
assert.equal(
  selectWindowRestored(store.getState(), "control:session", false),
  false,
  "collapsing a docked Session lets Game narration continue while Settings stays open",
);
const dockedWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: true }) } });
try {
  assert.equal(selectWindowRestored(store.getState(), "control:session", false), false);
  assert.equal(selectWindowRestored(store.getState(), "control:session", true), true);
  store.getState().closeWindow(CHAT_SETTINGS_WINDOW_ID);
  assert.equal(
    selectWindowRestored(store.getState(), "control:session", true),
    false,
    "an expanded docked section in a closed phone sheet does not pause narration",
  );
  store.getState().saveLayout("control:session", { ...dockedControl, docked: false });
  store.getState().openWindow("control:session");
  assert.equal(
    selectWindowRestored(store.getState(), "control:session", false),
    true,
    "an open undocked phone sheet pauses narration regardless of its old section state",
  );
} finally {
  if (dockedWindowDescriptor) Object.defineProperty(globalThis, "window", dockedWindowDescriptor);
  else Reflect.deleteProperty(globalThis, "window");
}
assert.equal(
  selectWindowRestored(store.getState(), "control:session", false),
  true,
  "a restored desktop window pauses narration regardless of its old section state",
);
store.getState().resetView();

// Resolved theme sizes govern default rows, opening geometry and clamping, not only pointer dragging.
const largeBubbleSize = 78;
const largeFirst = getBubbleRowSlot(bounds, 0, { size: largeBubbleSize, gap: 8 });
const largeSecond = getBubbleRowSlot(bounds, 1, { size: largeBubbleSize, gap: 8 });
assert.equal(largeFirst.x - largeSecond.x, largeBubbleSize + 8);
assert.deepEqual(clampWindowBubble({ x: 9000, y: 9000 }, bounds, largeBubbleSize), {
  x: bounds.right - largeBubbleSize,
  y: bounds.bottom - largeBubbleSize,
});
const beneathLargeBubble = placeWindowBesideBubble(
  { width: 200, height: 120 },
  largeFirst,
  bounds,
  { minWidth: 1, minHeight: 1 },
  largeBubbleSize,
);
assert.equal(beneathLargeBubble.y, largeFirst.y + largeBubbleSize + 8);
assert.equal(beneathLargeBubble.x + beneathLargeBubble.width, largeFirst.x + largeBubbleSize);
const detachedSource = { x: 900, y: 200, width: 300, height: 200 };
const firstDetached = placeDetachedDrawer(detachedSource, detachedSource, { width: 300, height: 300 }, bounds, limits);
const secondDetached = placeDetachedDrawer(
  detachedSource,
  detachedSource,
  { width: 300, height: 300 },
  bounds,
  limits,
  [firstDetached],
);
assert.ok(
  Math.abs(firstDetached.x - secondDetached.x) >= 20 || Math.abs(firstDetached.y - secondDetached.y) >= 20,
  "subsequent pop-outs leave each title bar reachable",
);

// ── Phone bubbles: a row along the top from the right edge, places kept apart from the computer's ──
const phoneBounds = { left: 8, top: 64, right: 382, bottom: 700 };
assert.deepEqual(getPhoneBubbleSlot(phoneBounds, 0), { x: 382 - PHONE_BUBBLE_SIZE_PX - 44, y: 64 });
assert.deepEqual(getPhoneBubbleSlot(phoneBounds, 2), { x: 382 - PHONE_BUBBLE_SIZE_PX, y: 64 + 44 });
// Settings owns the first top-right slot; other controls wrap without overlapping it or the map.
assert.deepEqual(getTopRightBubblePoint(phoneBounds, PHONE_BUBBLE_SIZE_PX), { x: 346, y: 64 });
assert.deepEqual(getTopRightBubblePoint(bounds, 32), { x: 1400, y: 56 });
assert.deepEqual(getPhoneBubbleSlot(phoneBounds, 3), { x: 382 - PHONE_BUBBLE_SIZE_PX - 44, y: 64 + 44 });
assert.deepEqual(getBubbleRowSlot(bounds, 4, { size: 32, gap: 4 }), { x: 1432 - 32 - 5 * 36, y: 56 });
// A phone bubble is larger, so it clamps further from the far edges.
assert.deepEqual(clampWindowBubble({ x: 900, y: 900 }, phoneBounds, PHONE_BUBBLE_SIZE_PX), { x: 346, y: 664 });
const withPhoneBubbles = parseWindowLayoutSnapshot({
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: {},
  phoneBubbles: { "control:volume": { x: 300, y: 120 }, "tracker-panel": { x: 12, y: 80 }, bad: { x: "a" } },
});
assert.deepEqual(withPhoneBubbles.phoneBubbles, {
  "control:volume": { x: 300, y: 120 },
  "tracker-panel": { x: 12, y: 80 },
});
assert.equal(isEmptyWindowLayoutSnapshot(withPhoneBubbles), false, "a layout with only phone places still saves");
assert.equal(
  "phoneBubbles" in toWindowLayoutSnapshot({}, [], {}),
  false,
  "no phone places leaves the snapshot as older versions wrote it",
);
const phoneStore = useFloatingWindowStore.getState();
phoneStore.hydrate(withPhoneBubbles);
phoneStore.savePhoneBubble("control:session", { x: 346, y: 108 });
assert.deepEqual(selectWindowLayoutSnapshot(useFloatingWindowStore.getState()).phoneBubbles, {
  "control:volume": { x: 300, y: 120 },
  "tracker-panel": { x: 12, y: 80 },
  "control:session": { x: 346, y: 108 },
});
assert.equal(
  useFloatingWindowStore.getState().layouts["control:session"],
  undefined,
  "placing a phone bubble leaves the computer's layout alone",
);
// Putting a popped-out drawer back forgets its phone bubble too.
const phoneDrawer = getDrawerWindowId(CHAT_SETTINGS_WINDOW_ID, "chat-name");
phoneStore.detachDrawer(phoneDrawer, { x: 8, y: 64, width: 300, height: 300, pinned: true, locked: false });
phoneStore.savePhoneBubble(phoneDrawer, { x: 346, y: 152 });
useFloatingWindowStore.getState().dockDrawer(phoneDrawer);
assert.equal(useFloatingWindowStore.getState().phoneBubbles[phoneDrawer], undefined);
// The Chat Settings button's place (a button with no window layout of its own) saves too.
const withButton = parseWindowLayoutSnapshot({
  version: FLOATING_WINDOW_LAYOUT_VERSION,
  windows: {},
  bubbles: { "chat-settings-button": { x: 400, y: 120 }, broken: { x: Number.NaN, y: 1 } },
});
assert.deepEqual(withButton.bubbles, { "chat-settings-button": { x: 400, y: 120 } });
useFloatingWindowStore.getState().saveBubble("chat-settings-button", { x: 420, y: 130 });
assert.deepEqual(selectWindowLayoutSnapshot(useFloatingWindowStore.getState()).bubbles, {
  "chat-settings-button": { x: 420, y: 130 },
});
useFloatingWindowStore.getState().resetView();
assert.deepEqual(useFloatingWindowStore.getState().phoneBubbles, {}, "Reset View puts phone bubbles back too");
assert.deepEqual(useFloatingWindowStore.getState().bubbles, {}, "Reset View puts the Chat Settings button back");

// Phone menu preferences round-trip without discarding old individual or desktop placements.
const menuSnapshot = parseWindowLayoutSnapshot({
  ...withPhoneBubbles,
  windows: { "control:volume": valid },
  bubbles: { "control:volume": { x: 80, y: 90 } },
  phoneMenu: { locked: true, order: ["control:volume", "future:tool", "control:volume", null, "", "x".repeat(1000)] },
});
assert.deepEqual(menuSnapshot.phoneMenu, { locked: true, order: ["control:volume", "future:tool"] });
store.getState().hydrate(menuSnapshot);
store.getState().savePhoneMenuOrder(["future:tool", "control:volume"]);
assert.deepEqual(
  selectWindowLayoutSnapshot(store.getState()),
  menuSnapshot,
  "locking blocks reordering without changing any positions",
);
store.getState().setPhoneMenuLocked(false);
store.getState().savePhoneMenuOrder(["control:session", "control:volume"]);
store.getState().savePhoneBubble("chat-tools-menu", { x: 70, y: 120 });
const reorderedMenuSnapshot = selectWindowLayoutSnapshot(store.getState());
assert.deepEqual(reorderedMenuSnapshot.phoneMenu, {
  locked: false,
  order: ["control:session", "control:volume", "future:tool"],
});
assert.deepEqual(reorderedMenuSnapshot.windows, menuSnapshot.windows);
assert.deepEqual(reorderedMenuSnapshot.bubbles, menuSnapshot.bubbles);
assert.deepEqual(reorderedMenuSnapshot.phoneBubbles, {
  ...menuSnapshot.phoneBubbles,
  "chat-tools-menu": { x: 70, y: 120 },
});
store.getState().hydrate(JSON.parse(serializeWindowLayoutSnapshot(reorderedMenuSnapshot)));
assert.deepEqual(
  selectWindowLayoutSnapshot(store.getState()),
  reorderedMenuSnapshot,
  "chat/profile hydration preserves menu preferences",
);
assert.equal(
  parseWindowLayoutSnapshot({ version: 1, windows: {}, phoneMenu: { locked: "false", order: "invalid" } }).phoneMenu,
  undefined,
);
assert.equal(
  parseWindowLayoutSnapshot({
    version: 1,
    windows: {},
    phoneMenu: { order: Array.from({ length: 300 }, (_, index) => `future:${index}`) },
  }).phoneMenu?.order.length,
  256,
);
store.getState().resetView();
assert.equal(store.getState().phoneMenu, undefined, "Reset View clears the menu's order and lock");
assert.equal(isEmptyWindowLayoutSnapshot(selectWindowLayoutSnapshot(store.getState())), true);

// The bubble draws with its theming hooks; the window keeps the header controls in order.
const floatingWindowSource = read("packages/client/src/components/ui/FloatingWindow.tsx");
const windowBubbleSource = read("packages/client/src/components/ui/WindowBubble.tsx");
assert.match(windowBubbleSource, /className="mari-window-bubble fixed"/u);
assert.match(windowBubbleSource, /data-minimized="true"/u);
// A tap is never read as a drag: touch needs a longer move before the bubble follows it.
assert.match(windowBubbleSource, /DRAG_START_PX = \{ mouse: 4, touch: 10 \}/u);
assert.match(floatingWindowSource, /<WindowBubble[\s\S]*data-presentation": "sheet"/u);
assert.match(
  read("packages/client/src/styles/globals.css"),
  /@media \(pointer: coarse\) \{\s*\.mari-window-bubble::before \{[\s\S]*100% - 44px/u,
  "Touch gets a 44px tap area around every bubble",
);
assert.match(
  floatingWindowSource,
  /data-window-control="pin"[\s\S]*data-window-control="lock"[\s\S]*data-window-control="close"/u,
);
assert.doesNotMatch(floatingWindowSource, /data-window-control="minimize"/u);
assert.match(read("packages/client/src/styles/globals.css"), /--mari-window-bubble-bg[\s\S]*--mari-window-snap-guide/u);

console.log("floating window regression passed");
