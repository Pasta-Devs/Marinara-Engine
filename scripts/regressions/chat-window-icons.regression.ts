// #7034: a popped-out or minimized chat window shows only its icon, so no two of them may share one.
// Collects the icons of every Chat Settings section, Trackers window drawer, control window and window
// title-bar button from the source, and fails when one icon stands for two different things. The same
// section in different chat modes (one label, such as Agents or Prompt Preset) may keep its icon.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** The text of each `<Tag …>` opening tag, up to its closing `>` outside braces. */
function openingTags(source: string, tag: string): string[] {
  const tags: string[] = [];
  const pattern = new RegExp(`<${tag}[\\s>]`, "gu");
  for (const match of source.matchAll(pattern)) {
    let depth = 0;
    for (let index = match.index!; index < source.length; index += 1) {
      const char = source[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      else if (char === ">" && depth === 0 && source[index - 1] !== "=") {
        tags.push(source.slice(match.index!, index + 1));
        break;
      }
    }
  }
  return tags;
}

/** The value of `name={…}` in an opening tag, braces balanced. */
function attribute(tag: string, name: string): string | null {
  const start = tag.search(new RegExp(`\\s${name}=\\{`, "u"));
  if (start < 0) return null;
  const open = tag.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < tag.length; index += 1) {
    if (tag[index] === "{") depth += 1;
    else if (tag[index] === "}" && --depth === 0) return tag.slice(open + 1, index);
  }
  return null;
}

/** What the window stands for: its label or title key (or expression), else its id. */
function identity(tag: string): string {
  for (const name of ["label", "title", "id"]) {
    const value = attribute(tag, name) ?? tag.match(new RegExp(`\\s${name}="([^"]+)"`, "u"))?.[1] ?? null;
    if (value) return value.match(/"([^"]+)"/u)?.[1] ?? value.trim();
  }
  return tag;
}

const icons = new Map<string, Set<string>>();
function record(icon: string, owner: string) {
  if (!icons.has(icon)) icons.set(icon, new Set());
  icons.get(icon)!.add(owner);
}

function collect(path: string, tag: string) {
  for (const opening of openingTags(read(path), tag)) {
    const icon = attribute(opening, "icon");
    if (!icon) continue;
    for (const [, name] of icon.matchAll(/<([A-Z][A-Za-z0-9]*)/gu)) record(name!, identity(opening));
  }
}

const sectionFiles = readdirSync(join(root, "packages/client/src/features/chat-settings/sections"))
  .filter((file) => file.endsWith(".tsx"))
  .map((file) => `packages/client/src/features/chat-settings/sections/${file}`);
for (const path of ["packages/client/src/components/chat/ChatSettingsDrawer.tsx"]) {
  collect(path, "Section");
  collect(path, "Drawer");
}
for (const path of [...sectionFiles, "packages/client/src/features/multiplayer/MultiplayerHostControls.tsx"]) {
  collect(path, "ChatSettingsSection");
  collect(path, "Drawer");
}
collect("packages/client/src/components/chat/RoleplayTrackerWindow.tsx", "TrackerDrawer");
for (const path of [
  "packages/client/src/components/chat/ChatControlWindow.tsx",
  "packages/client/src/components/chat/ChatRoleplaySurface.tsx",
  "packages/client/src/components/chat/ConversationView.tsx",
  "packages/client/src/components/chat/RoleplayTrackerWindow.tsx",
  "packages/client/src/components/game/GameSurface.tsx",
]) {
  collect(path, "ChatControlWindow");
}

// Title-bar buttons: Chat Settings' own, the shared window controls, and a popped-out drawer's Put back.
const settings = read("packages/client/src/components/chat/ChatSettingsDrawer.tsx");
const headerControls = settings.slice(
  settings.indexOf("const headerControls = ("),
  settings.indexOf("const moveTip ="),
);
assert.match(headerControls, /data-chat-settings-control="reset-view"[\s\S]*<RotateCcw/u);
record("RotateCcw", "Reset View");
assert.match(headerControls, /data-chat-settings-control="tracker-panel"[\s\S]*<TrackerPanelIcon/u);
record("TrackerPanelIcon", "Tracker Panel");
// The Chat Settings button in the chat.
assert.match(
  read("packages/client/src/components/chat/ChatSettingsBubble.tsx"),
  /<WindowBubble[\s\S]*?icon=\{<Settings2/u,
  "the Chat Settings button shows the Chat Settings icon",
);
record("Settings2", "Chat Settings");
// The phone Tracker Panel bubble is the same Tracker Panel.
assert.match(
  read("packages/client/src/components/chat/TrackerPanelBubble.tsx"),
  /icon=\{<TrackerPanelIcon/u,
  "the phone Tracker Panel bubble shows the dice too",
);
const floatingWindow = read("packages/client/src/components/ui/FloatingWindow.tsx");
assert.doesNotMatch(floatingWindow, /data-window-control="minimize"/u, "Close is the only minimize control");
for (const [control, icon] of [
  ["pin", "Pin"],
  ["lock", "Unlock"],
  ["close", "X"],
] as const) {
  assert.match(floatingWindow, new RegExp(`data-window-control="${control}"[\\s\\S]*?<${icon}\\b`, "u"));
  record(icon, `window ${control}`);
}
record("Lock", "window lock");
assert.match(read("packages/client/src/components/ui/Drawer.tsx"), /data-window-control="put-back"[\s\S]*?<Undo2/u);
record("Undo2", "put back");

// The sections the maintainer named get icons of their own.
const owners = (icon: string) => [...(icons.get(icon) ?? [])];
assert.deepEqual(owners("Gauge"), ["ui.chatSettings.advancedparameterssection.advancedParameters"]);
assert.deepEqual(owners("ScanText"), ["chat.settings.activeContext"]);
assert.deepEqual(owners("Images"), ["chat.settings.gallery"]);
assert.ok(icons.size >= 30, `expected the icons of every section, drawer and window, found ${icons.size}`);

const duplicates = [...icons].filter(([, users]) => users.size > 1).map(([icon, users]) => `${icon}: ${[...users]}`);
assert.deepEqual(duplicates, [], "every chat window, drawer and title-bar button needs an icon of its own");

console.log(`chat window icons regression passed (${icons.size} icons)`);
