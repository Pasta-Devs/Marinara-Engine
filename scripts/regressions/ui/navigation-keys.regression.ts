import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Back / Forward between places, the tab keys, the edge swipe and pull to refresh (new layout QoL batch, Nov 27),
// and the Settings › Shortcuts lists: every label they show exists in en.json.

const { placeKey, recordPlace, placeKeyStep, tabKeyAction, tabKeyTarget } =
  await import("../../../packages/client/src/lib/navigation-keys.js");
const { edgeSwipeCommits, EDGE_COMMIT_PX } = await import("../../../packages/client/src/lib/edge-swipe-back.js");
const { pullRefreshDistance, PULL_REFRESH_COMMIT_PX } =
  await import("../../../packages/client/src/hooks/use-pull-to-refresh.js");
const { KEYBOARD_SHORTCUT_GROUPS, shortcutGroupsFor, shortcutKeysFor } =
  await import("../../../packages/client/src/lib/keyboard-shortcuts.js");
const { TOUCH_GESTURES } = await import("../../../packages/client/src/lib/touch-gestures.js");

type Tab = { kind: "chat" | "character" | "library"; id: string };
const chat = (id: string): Tab => ({ kind: "chat", id });
const card = (id: string): Tab => ({ kind: "character", id });

// ── Places: a browser-like history ──
{
  let h = { entries: [] as (Tab | null)[], index: -1 };
  const visit = (place: Tab | null) => (h = recordPlace(h.entries, h.index, place));
  visit(null);
  visit(chat("a"));
  visit(card("wren"));
  visit(card("wren")); // the same page again records nothing
  assert.deepEqual(h.entries.map(placeKey), ["home", "chat:a", "character:wren"]);
  assert.equal(h.index, 2);
  // Back twice, then a new visit drops what was ahead.
  h = { ...h, index: 0 };
  visit({ kind: "library", id: "lorebooks" });
  assert.deepEqual(h.entries.map(placeKey), ["home", "library:lorebooks"]);
  assert.equal(h.index, 1);
  // The history keeps the newest 50.
  for (let n = 0; n < 80; n += 1) visit(chat(String(n)));
  assert.equal(h.entries.length, 50);
  assert.equal(h.index, 49);
  assert.equal(placeKey(h.entries[49]!), "chat:79");
}

// ── Back / Forward keys ──
{
  const key = (k: string, mods: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>> = {}) => ({
    key: k,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods,
  });
  assert.equal(placeKeyStep(key("ArrowLeft", { altKey: true }), false), -1);
  assert.equal(placeKeyStep(key("ArrowRight", { altKey: true }), false), 1);
  // Alt+Shift+← is the previous tab, not Back.
  assert.equal(placeKeyStep(key("ArrowLeft", { altKey: true, shiftKey: true }), false), 0);
  assert.equal(placeKeyStep(key("ArrowLeft"), false), 0);
  assert.equal(placeKeyStep(key("[", { metaKey: true }), true), -1);
  assert.equal(placeKeyStep(key("]", { metaKey: true }), true), 1);
  // ⌘[ off Apple is not ours (Windows key).
  assert.equal(placeKeyStep(key("[", { metaKey: true }), false), 0);
}

// ── Tab keys ──
{
  const ev = (
    key: string,
    code: string,
    mods: Partial<Record<"altKey" | "ctrlKey" | "metaKey" | "shiftKey", boolean>>,
  ) => ({
    key,
    code,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods,
  });
  assert.deepEqual(tabKeyAction(ev("PageUp", "PageUp", { altKey: true })), { kind: "step", step: -1 });
  assert.deepEqual(tabKeyAction(ev("PageDown", "PageDown", { altKey: true })), { kind: "step", step: 1 });
  assert.deepEqual(tabKeyAction(ev("ArrowRight", "ArrowRight", { altKey: true, shiftKey: true })), {
    kind: "step",
    step: 1,
  });
  // Alt+Shift+1 types "!" on most layouts: read from the key's position.
  assert.deepEqual(tabKeyAction(ev("!", "Digit1", { altKey: true, shiftKey: true })), { kind: "jump", position: 1 });
  assert.deepEqual(tabKeyAction(ev("(", "Digit9", { altKey: true, shiftKey: true })), {
    kind: "jump",
    position: "last",
  });
  // Plain Alt+digit stays the browser's (Linux tab switching).
  assert.equal(tabKeyAction(ev("1", "Digit1", { altKey: true })), null);
  // Option+W types ∑ on a Mac: still the close key.
  assert.deepEqual(tabKeyAction(ev("∑", "KeyW", { altKey: true })), { kind: "close" });
  assert.equal(tabKeyAction(ev("w", "KeyW", { ctrlKey: true })), null);
  assert.equal(tabKeyAction(ev("ArrowLeft", "ArrowLeft", { altKey: true })), null);

  const tabs = [chat("a"), card("wren"), chat("b")];
  assert.equal(placeKey(tabKeyTarget(tabs, "chat:a", { kind: "step", step: 1 })), "character:wren");
  assert.equal(placeKey(tabKeyTarget(tabs, "chat:a", { kind: "step", step: -1 })), "chat:b");
  assert.equal(placeKey(tabKeyTarget(tabs, "chat:b", { kind: "step", step: 1 })), "chat:a");
  // From Home (or a Library page, which has no tab), a step starts at an end.
  assert.equal(placeKey(tabKeyTarget(tabs, null, { kind: "step", step: 1 })), "chat:a");
  assert.equal(placeKey(tabKeyTarget(tabs, "library:presets", { kind: "step", step: -1 })), "chat:b");
  assert.equal(placeKey(tabKeyTarget(tabs, null, { kind: "jump", position: 2 })), "character:wren");
  assert.equal(tabKeyTarget(tabs, null, { kind: "jump", position: 5 }), null);
  assert.equal(placeKey(tabKeyTarget(tabs, null, { kind: "jump", position: "last" })), "chat:b");
  assert.equal(tabKeyTarget([], null, { kind: "step", step: 1 }), null);
}

// ── Edge swipe and pull to refresh thresholds ──
assert.equal(edgeSwipeCommits(EDGE_COMMIT_PX, 1000), true);
assert.equal(edgeSwipeCommits(EDGE_COMMIT_PX - 1, 1000), false);
assert.equal(edgeSwipeCommits(40, 50), true, "a quick flick commits a shorter swipe");
assert.equal(edgeSwipeCommits(20, 10), false, "a twitch at the edge is not a swipe");
assert.equal(pullRefreshDistance(-30), 0);
assert.equal(pullRefreshDistance(PULL_REFRESH_COMMIT_PX * 2), PULL_REFRESH_COMMIT_PX);
assert.equal(pullRefreshDistance(10_000), 96);

// ── The lists on Settings › Shortcuts ──
{
  const en = JSON.parse(
    readFileSync(new URL("../../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
  ) as Record<string, string>;
  for (const group of KEYBOARD_SHORTCUT_GROUPS) {
    assert.ok(en[group.titleKey], `missing ${group.titleKey}`);
    for (const shortcut of group.shortcuts) {
      assert.ok(en[shortcut.labelKey], `missing ${shortcut.labelKey}`);
      if (shortcut.overhaulLabelKey) assert.ok(en[shortcut.overhaulLabelKey], `missing ${shortcut.overhaulLabelKey}`);
    }
  }
  for (const gesture of TOUCH_GESTURES) {
    assert.ok(en[gesture.gestureKey], `missing ${gesture.gestureKey}`);
    assert.ok(en[gesture.labelKey], `missing ${gesture.labelKey}`);
  }
  // The classic layout's "?" window leaves out the new layout's tab and Back keys.
  assert.ok(!shortcutGroupsFor(false).some((group) => group.id === "navigation"));
  assert.equal(shortcutGroupsFor(true)[0]!.id, "navigation");
  const back = shortcutGroupsFor(true)[0]!.shortcuts[0]!;
  assert.deepEqual(shortcutKeysFor(back, true)[0], ["Mod", "["]);
  assert.deepEqual(shortcutKeysFor(back, false)[0], ["Alt", "←"]);
  // The guide lists every keyboard group.
  const guide = readFileSync(new URL("../../../docs/home/shortcuts-and-gestures.md", import.meta.url), "utf8");
  for (const heading of ["## Going back and forward", "### Moving around", "## Touch gestures"])
    assert.ok(guide.includes(heading), `guide lacks ${heading}`);
}

console.log("navigation keys: ok");
