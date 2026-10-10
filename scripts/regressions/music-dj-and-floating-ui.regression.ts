import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const topBarUrl = new URL("../../packages/client/src/components/layout/TopBar.tsx", import.meta.url);
const appShellUrl = new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url);
const professorMariUrl = new URL(
  "../../packages/client/src/components/chat/HomeProfessorMariChat.tsx",
  import.meta.url,
);
const settingsUrl = new URL("../../packages/client/src/components/panels/SettingsPanel.tsx", import.meta.url);
const globalsUrl = new URL("../../packages/client/src/styles/globals.css", import.meta.url);
const unavailablePlayerUrl = new URL(
  "../../packages/client/src/components/music/MusicDjUnavailablePlayer.tsx",
  import.meta.url,
);

const topBarSource = readFileSync(topBarUrl, "utf8");
const appShellSource = readFileSync(appShellUrl, "utf8");
const professorMariSource = readFileSync(professorMariUrl, "utf8");
const settingsSource = readFileSync(settingsUrl, "utf8");
const globalsSource = readFileSync(globalsUrl, "utf8");

assert.equal(existsSync(unavailablePlayerUrl), false, "Music DJ must not leave an absent-package player placeholder");
assert.doesNotMatch(topBarSource, /MusicDjUnavailablePlayer/u);
assert.doesNotMatch(appShellSource, /MusicDjUnavailablePlayer/u);
assert.match(
  settingsSource,
  /checked=\{musicDjInstalled && musicPlayerEnabled\}[\s\S]{0,300}disabled=\{!musicDjInstalled\}/u,
  "The Music Player switch must remain off and unavailable until Music DJ is installed",
);

// 5bb03f918 replaced Professor Mari's floating window with the top-bar presence pill; she lives in
// the omnibar and Home only, so no floating follow-up or floating window may come back.
assert.doesNotMatch(
  appShellSource,
  /hasProfessorMariFloatingFollowup/u,
  "Professor Mari has no floating window to follow chats",
);
// Slice 82: the chat's parts live in components/chat/mari/, so "nowhere" reads all of them.
const professorMariPartsDir = new URL("../../packages/client/src/components/chat/mari/", import.meta.url);
const professorMariAllSource = [
  professorMariSource,
  ...readdirSync(professorMariPartsDir).map((name) => readFileSync(new URL(name, professorMariPartsDir), "utf8")),
].join("\n");
assert.doesNotMatch(
  professorMariAllSource,
  /floatingFollowupEligibleRef|rememberProfessorMariFloatingEnabled/u,
  "Professor Mari's chat must not track a floating window",
);
// Slice 82: globals.css imports Mari's and the omnibar's rules from their own files; check all of them.
const allGlobalStyles = [
  globalsSource,
  ...["mari.css", "omnibar.css", "omnibar-settings.css"].map((name) => readFileSync(new URL(name, globalsUrl), "utf8")),
].join("\n");
assert.doesNotMatch(
  allGlobalStyles,
  /\.mari-chrome-token-scope\s*\{[^}]*--primary:/u,
  "The shared chat-chroma scope must not replace the configured app accent",
);

assert.match(
  topBarSource,
  /!mobileTopbarNavigation && "mari-topbar-chat-gradient-icon"/u,
  "Mobile Chats must not apply the desktop gradient to the icon",
);
assert.match(
  topBarSource,
  /!mobileTopbarNavigation && "mari-topbar-chat-gradient-hover"/u,
  "Mobile Chats must not retain a sticky gradient hover class",
);
assert.match(
  topBarSource,
  /mari-topbar-chat-gradient-underline/u,
  "The active Chats underline must retain its gradient",
);
assert.match(topBarSource, /<Menu size=\{15\}/u, "The mobile overflow control must use a menu icon");
assert.match(topBarSource, /"ml-auto sm:hidden"/u, "The mobile overflow control must stay at the right edge");
assert.match(
  globalsSource,
  /@media \(max-width: 639px\) \{\s*\.mari-topbar \{[^}]*\}\s*\.mari-topbar-action \{\s*flex: 0 0 auto;\s*width: 3\.5rem !important;\s*(?:\/\*[^*]*\*\/\s*)?height: 2\.6rem !important;/u,
  "Phone top-bar controls must keep fixed desktop-style sizes instead of filling the row",
);

console.info("Music DJ availability and floating UI regressions passed.");
