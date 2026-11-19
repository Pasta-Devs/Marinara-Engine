// The app shell: one visibility listener pauses effects and tells the avatar hook, the static accent gradient is set,
// toasts move and swipe away from the open omnibar, chats sort by recent activity by default, and closing a detached
// Tracker window closes the Tracker. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appSource = readFileSync(new URL("../../../packages/client/src/App.tsx", import.meta.url), "utf8");
assert.equal(
  appSource.match(/document\.addEventListener\("visibilitychange", syncEffectsPausedState\)/gu)?.length,
  1,
  "Home effect pausing must keep one central visibility listener",
);
assert.match(appSource, /dispatchEvent\(new CustomEvent\("marinara:effects-paused"/u);
assert.match(appSource, /--marinara-app-accent-static-gradient/u);
// While the omnibar is open, toasts move to the edge it does not cover; otherwise the user's position applies.
assert.match(
  appSource,
  /position=\{\s*omnibarOpen\s*\?[^:]+:[^:]+:\s*notificationPosition === "bottom"\s*\? "bottom-center"\s*: "top-center"\s*\}/u,
);
assert.match(
  appSource,
  /swipeDirections=\{\[\s*"left",\s*"right",\s*omnibarOpen \? \(isMobileShell \? "top" : "bottom"\) : notificationPosition === "bottom" \? "bottom" : "top",\s*\]\}/u,
);

const REPOSITORY_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const appShellSource = readFileSync(
  new URL("../../../packages/client/src/components/layout/AppShell.tsx", import.meta.url),
  "utf8",
);
const chatSidebarSource = readFileSync(
  join(REPOSITORY_ROOT, "packages/client/src/components/layout/ChatSidebar.tsx"),
  "utf8",
);
assert.match(
  chatSidebarSource,
  /useState<ChatSortOption>\("recent"\)/u,
  "Recent activity must be the default chat sort",
);
assert.match(
  appShellSource,
  /handleTrackerPanelWindowClosed[\s\S]{0,500}trackerPanelWindowTargetRef\.current\?\.popup !== closedTarget\.popup[\s\S]{0,300}closeTrackerPanel\(\)/u,
  "Closing a detached Tracker window must close the Tracker instead of silently docking it",
);
