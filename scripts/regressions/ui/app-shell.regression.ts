// The app shell: one visibility listener pauses effects and tells the avatar hook, the static accent gradient is set,
// and toasts move and swipe away from the open omnibar. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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
