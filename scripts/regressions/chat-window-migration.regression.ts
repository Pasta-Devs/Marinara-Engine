import assert from "node:assert/strict";
import { getLegacyChatWindowLayout } from "../../packages/client/src/lib/chat-window-migration.js";
import { serializeWindowLayoutSnapshot } from "../../packages/client/src/lib/floating-window-layout.js";

const drawer = (mode: string, section: string) => `drawer:chat-settings:${mode}-${section}`;
for (const mode of ["conversation", "roleplay", "game"] as const) {
  const sections = ["chat-branches", "active-context", "gallery"];
  if (mode !== "game") sections.push("message-search");
  if (mode === "roleplay") sections.push("chat-summary", "author-notes");
  const layout = getLegacyChatWindowLayout(mode, { enableAgents: false });
  assert.deepEqual(layout, { version: 1, windows: {}, detached: sections.map((section) => drawer(mode, section)) });
  assert.deepEqual(
    JSON.parse(serializeWindowLayoutSnapshot(layout)),
    layout,
    "migration survives persistence without geometry",
  );
  for (const windowLayout of [null, undefined, "broken", {}, { version: 1, windows: {} }, layout]) {
    assert.equal(getLegacyChatWindowLayout(mode, { windowLayout }), null, "any explicit layout is left alone");
  }
  assert.equal(getLegacyChatWindowLayout(mode, { multiplayer: { sessionId: "session" } }), null);
  assert.equal(getLegacyChatWindowLayout(mode, { multiplayerSetup: true }), null);
}
for (const metadata of [{ enableAgents: true }, { advancedMemory: { enabled: true } }]) {
  assert.ok(getLegacyChatWindowLayout("roleplay", metadata)?.detached?.includes(drawer("roleplay", "agent-activity")));
}
assert.ok(
  !getLegacyChatWindowLayout("roleplay", { advancedMemory: { enabled: false } })?.detached?.includes(
    drawer("roleplay", "agent-activity"),
  ),
);
console.info("Chat window migration regressions passed.");
