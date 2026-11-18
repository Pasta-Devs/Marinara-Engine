// The Home screen: the Your Guide icon takes its label's colour, and Recent Chats shows three cards on a phone and
// four on a narrow desktop. Reads component source until a test can drive these.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homeBrowserHubSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/HomeBrowserHub.tsx", import.meta.url),
  "utf8",
);
assert.match(
  homeBrowserHubSource,
  /<MessageCircle size="0\.8rem" className="mari-rgb-static-icon text-current" \/>/u,
  "The Your Guide action icon must inherit the same color as its label",
);
const recentChatsSource = readFileSync(
  new URL("../../../packages/client/src/components/chat/RecentChats.tsx", import.meta.url),
  "utf8",
);
assert.match(recentChatsSource, /data-narrow-desktop-limit="4"/u);
assert.match(recentChatsSource, /md:auto-rows-fr md:grid-rows-none/u);
assert.match(recentChatsSource, /index === 3 && "hidden md:block"/u);
assert.match(recentChatsSource, /index >= 4 && "hidden"/u);
