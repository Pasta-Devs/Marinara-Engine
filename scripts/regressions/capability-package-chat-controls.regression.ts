// Package integration controls live with their package: a chat or character control for Noodle or
// Slurp only shows while that package is installed and active, and package prompt context receives
// the preset's wrap format so its block matches the prompt around it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const drawer = read("packages/client/src/components/chat/ChatSettingsDrawer.tsx");
const convoFields = read("packages/client/src/components/characters/ConvoProfileFields.tsx");
const characterEditor = read("packages/client/src/components/characters/CharacterEditor.tsx");
const homeBrowserHub = read("packages/client/src/components/chat/HomeBrowserHub.tsx");
const promptContext = read("packages/server/src/services/capability-packages/capability-prompt-context.service.ts");
const chatsRoutes = read("packages/server/src/routes/chats.routes.ts");
const english = JSON.parse(read("packages/client/src/localization/locales/en.json")) as Record<string, string>;

// Chat settings: each package's toggle is gated on that package.
assert.match(drawer, /const noodleInstalled = isCapabilityPackageAvailable\(installedCapabilities, "noodle"\);/u);
assert.match(drawer, /const slurp2Installed = isCapabilityPackageAvailable\(installedCapabilities, "slurp2"\);/u);
assert.match(drawer, /\{noodleInstalled && \(\s*<SettingsSwitch[\s\S]*?noodleTimelineContextEnabled: checked/u);
assert.match(drawer, /\{slurp2Installed && \(\s*<SettingsSwitch[\s\S]*?slurp2ActivityContextEnabled: checked/u);
assert.doesNotMatch(drawer, /renderNoodleTimelineContextToggle/u, "no render site may bypass the install gate");
assert.equal(
  drawer.match(/\{renderPackageContextToggles\(\)\}/gu)?.length,
  4,
  "every chat mode renders the gated toggles",
);
// Slurp activity is opt-in per chat.
assert.match(drawer, /const slurp2ActivityContextEnabled = metadata\.slurp2ActivityContextEnabled === true;/u);
assert.ok(english["ui.chat.chatsettingsdrawer.allowSlurpActivity"]);
assert.ok(english["ui.chat.chatsettingsdrawer.allowSlurpActivityDescription"]);
assert.match(chatsRoutes, /typeof incoming\.slurp2ActivityContextEnabled !== "boolean"/u);

// Character editor: the image instructions stay; the Noodle checkbox moved into Noodle's own profile editor.
assert.match(convoFields, /\{kind === "character" && onImageInstructionsChange && \(/u);
assert.doesNotMatch(convoFields, /onApplyImageInstructionsToNoodleChange/u);
assert.doesNotMatch(characterEditor, /applyConversationImageInstructionsToNoodle/u);
// Capability API 1.67: the browser view can open a character in the editor, on a tab.
assert.match(
  homeBrowserHub,
  /openCharacter: \(characterId: string, options\?: \{ tab\?: string \}\) => \{[\s\S]*?openCharacterDetail\(characterId, \{\s*initialTab:/u,
);
// Capability API 1.386: it can open a connection in the editor and comes back to its tab. The desktop
// shell unmounts Home while the editor is open, so the store remembers the tab and queues it for the
// remounted Home only when that editor closes; leaving the editor any other way queues nothing.
assert.match(
  homeBrowserHub,
  /openConnection: \(connectionId: string\) => \{\s*if \(typeof connectionId !== "string" \|\| !connectionId\) return;[\s\S]*?\.openConnectionDetail\(connectionId, \{ returnToHomeTab: activeTab \}\);/u,
);
// Back (browser or hardware) closes a package-opened connection editor the same way, so it returns to the tab too;
// every other editor keeps closing through closeAllDetails.
assert.match(
  read("packages/client/src/lib/back-layers.ts"),
  /else if \(current\.connectionDetailId && current\.connectionDetailReturnTab\) current\.closeConnectionDetail\(\);\s*else current\.closeAllDetails\(\);/u,
);
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});
const { useUIStore, pickPersistedUIState } = await import("../../packages/client/src/stores/ui.store.js");
const ui = () => useUIStore.getState();
ui().openConnectionDetail("connection-1", { returnToHomeTab: "story-writer" });
assert.equal(ui().connectionDetailId, "connection-1");
assert.equal(ui().homeRequest, null, "nothing is queued while the editor is open");
ui().closeConnectionDetail();
assert.deepEqual(ui().homeRequest, { kind: "tab", tab: "story-writer" }, "closing the editor returns to the tab");
ui().consumeHomeRequest();
// Leaving for a chat (the sidebar closes every detail) or another editor queues nothing.
ui().openConnectionDetail("connection-1", { returnToHomeTab: "story-writer" });
ui().closeAllDetails();
assert.equal(ui().homeRequest, null, "leaving through closeAllDetails queues no return");
ui().openConnectionDetail("connection-1", { returnToHomeTab: "story-writer" });
ui().openCharacterDetail("character-1");
ui().closeCharacterDetail();
assert.equal(ui().homeRequest, null, "another editor in between queues no return");
ui().closeConnectionDetail();
assert.equal(ui().homeRequest, null, "a stale close with no editor open queues nothing");
// An editor opened the ordinary way never returns to a tab.
ui().openConnectionDetail("connection-1");
ui().closeConnectionDetail();
assert.equal(ui().homeRequest, null);
// Switching the open editor to another connection (such as one it just created) keeps the return tab.
ui().openConnectionDetail("connection-1", { returnToHomeTab: "story-writer" });
ui().openConnectionDetail("connection-2");
ui().closeConnectionDetail();
assert.deepEqual(ui().homeRequest, { kind: "tab", tab: "story-writer" }, "a switch inside the editor keeps the tab");
ui().consumeHomeRequest();
// A tab left behind by an editor another editor replaced never reaches a later editor.
ui().openConnectionDetail("connection-1", { returnToHomeTab: "story-writer" });
ui().openCharacterDetail("character-1");
ui().closeCharacterDetail();
ui().openConnectionDetail("connection-2");
ui().closeConnectionDetail();
assert.equal(ui().homeRequest, null, "an editor opened afresh starts without a return tab");
const persisted = pickPersistedUIState(ui());
assert.ok(!("homeRequest" in persisted), "a Home request is never saved");
assert.ok(!("connectionDetailReturnTab" in persisted), "nor is the editor's return tab");

// Package prompt context carries the wrap format.
assert.match(promptContext, /wrapFormat\?: "xml" \| "markdown" \| "none";/u);
// The actual contributor inputs are exercised through generation and preview in
// capability-prompt-preview.regression.ts, independent of the collector's file or call shape.

console.log("capability package chat controls regression passed");
