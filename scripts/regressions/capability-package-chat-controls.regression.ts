// Package integration controls live with their package: a chat or character control for Noodle or
// Slurp only shows while that package is installed and active, and package prompt context receives
// the preset's wrap format so its block matches the prompt around it.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const drawer = read("packages/client/src/components/chat/ChatSettingsDrawer.tsx");
const convoFields = read("packages/client/src/components/characters/ConvoProfileFields.tsx");
const characterEditor = read("packages/client/src/components/characters/CharacterEditor.tsx");
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

// Character editor: the image instructions stay; only the Noodle checkbox depends on Noodle.
assert.match(convoFields, /\{kind === "character" && onImageInstructionsChange && \(/u);
assert.match(convoFields, /\{onApplyImageInstructionsToNoodleChange && \(\s*<label/u);
assert.match(
  characterEditor,
  /onApplyImageInstructionsToNoodleChange=\{\s*noodleInstalled\s*\?[\s\S]*?: undefined\s*\}/u,
);

// Package prompt context carries the wrap format.
assert.match(promptContext, /wrapFormat\?: "xml" \| "markdown" \| "none";/u);
// The actual contributor inputs are exercised through generation and preview in
// capability-prompt-preview.regression.ts, independent of the collector's file or call shape.

console.log("capability package chat controls regression passed");
