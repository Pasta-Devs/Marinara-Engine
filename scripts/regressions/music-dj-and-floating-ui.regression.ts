import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

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

assert.match(
  appShellSource,
  /hasProfessorMariFloatingFollowup\(\)[\s\S]{0,220}Boolean\(activeChatId\)[\s\S]{0,220}hasDetailView[\s\S]{0,220}mobileNavigationPanel/u,
  "Professor Mari must follow an open conversation into chats, editors, and mobile navigation",
);
assert.match(
  professorMariSource,
  /controlledChatWindowOpen === undefined[\s\S]{0,180}floatingFollowupEligibleRef\.current = controlledChatWindowOpen[\s\S]{0,180}rememberProfessorMariFloatingEnabled\(controlledChatWindowOpen\)/u,
  "The embedded Professor tab must mark its controlled chat window as eligible to follow",
);
assert.match(
  professorMariSource,
  /mari-chrome-token-scope fixed z-\[95\] flex h-\[min\(32rem/u,
  "Professor Mari's desktop floating window must use chat-chroma tokens",
);
assert.match(
  professorMariSource,
  /mari-chrome-control mari-chrome-control--small mari-accent-animated h-7 w-7 shrink-0 p-0/u,
  "Professor Mari's desktop floating window must use the compact close control",
);
assert.match(
  professorMariSource,
  /mari-chrome-token-scope fixed inset-x-0 top-\[calc\(3rem_/u,
  "Professor Mari's mobile floating window must use chat-chroma tokens",
);
assert.doesNotMatch(
  globalsSource,
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

console.info("Music DJ availability and floating UI regressions passed.");
