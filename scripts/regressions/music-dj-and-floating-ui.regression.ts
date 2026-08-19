import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const topBarUrl = new URL("../../packages/client/src/components/layout/TopBar.tsx", import.meta.url);
const appShellUrl = new URL("../../packages/client/src/components/layout/AppShell.tsx", import.meta.url);
const professorMariUrl = new URL(
  "../../packages/client/src/components/chat/HomeProfessorMariChat.tsx",
  import.meta.url,
);
const settingsUrl = new URL("../../packages/client/src/components/panels/SettingsPanel.tsx", import.meta.url);
const unavailablePlayerUrl = new URL(
  "../../packages/client/src/components/music/MusicDjUnavailablePlayer.tsx",
  import.meta.url,
);

const topBarSource = readFileSync(topBarUrl, "utf8");
const appShellSource = readFileSync(appShellUrl, "utf8");
const professorMariSource = readFileSync(professorMariUrl, "utf8");
const settingsSource = readFileSync(settingsUrl, "utf8");

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
