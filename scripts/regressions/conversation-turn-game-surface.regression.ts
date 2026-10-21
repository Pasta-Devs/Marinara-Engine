// A Conversation chat mounts each turn game's board once. Games declare the `conversation-surface` slot, and
// ConversationView mounts every turn game's surface on its own, so with the game's agent on in the chat the slot must
// not mount it a second time (two UNO boards, two pool tables). Other packages in the slot, and Calls, are unchanged.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { InstalledCapabilityPackage } from "../../packages/shared/dist/index.js";
import {
  selectConversationSurfacePackages,
  selectConversationTurnGamePackages,
  selectEnabledConversationPackages,
} from "../../packages/client/src/hooks/use-capability-packages.js";

function installed(id: string, kind: string[], slots: string[], status = "active"): InstalledCapabilityPackage {
  return {
    id,
    version: "1.0.0",
    status,
    manifest: {
      id,
      kind,
      entrypoints: { client: "client.js" },
      contributions: { slots },
    },
  } as unknown as InstalledCapabilityPackage;
}

const uno = installed("uno", ["agent", "turn-game"], ["conversation-surface"]);
const chess = installed("chess", ["agent", "turn-game"], ["conversation-surface"]);
const calls = installed(
  "conversation-calls",
  ["agent", "conversation-calls"],
  ["conversation-toolbar", "conversation-surface"],
);
const surfaceAgent = installed("surface-agent", ["agent"], ["conversation-surface", "conversation-toolbar"]);
const inactiveGame = installed("poker", ["agent", "turn-game"], ["conversation-surface"], "error");
const packages = [uno, chess, calls, surfaceAgent, inactiveGame];
const chatMeta = { enableAgents: true, activeAgentIds: ["uno", "conversation-calls", "surface-agent"] };

const ids = (items: InstalledCapabilityPackage[]) => items.map((item) => item.id);
const turnGames = selectConversationTurnGamePackages(packages);
const surfaces = selectConversationSurfacePackages(packages, chatMeta);
assert.deepEqual(ids(turnGames), ["uno", "chess"], "every active turn game's board is mounted");
assert.deepEqual(ids(surfaces), ["surface-agent"], "the slot leaves out turn games and Calls");

// Each package's surface is mounted exactly once: the turn-game list plus the slot list, as ConversationView renders.
const mounted = [...ids(turnGames), ...ids(surfaces)];
for (const id of ["uno", "chess", "surface-agent"]) {
  assert.equal(mounted.filter((entry) => entry === id).length, 1, `${id} renders once`);
}
// The agent being on still counts: the game stays an enabled conversation package for its other slots.
assert.deepEqual(ids(selectEnabledConversationPackages(packages, chatMeta)), ["uno", "surface-agent"]);
assert.deepEqual(selectConversationSurfacePackages(packages, { activeAgentIds: ["surface-agent"] }), []);

const view = readFileSync(
  new URL("../../packages/client/src/components/chat/ConversationView.tsx", import.meta.url),
  "utf8",
);
assert.match(view, /const turnGamePackages = selectConversationTurnGamePackages\(installedCapabilities\);/u);
assert.match(
  view,
  /const conversationSurfacePackages = selectConversationSurfacePackages\(installedCapabilities, chatMeta\);/u,
);
assert.equal(view.match(/view="surface"/gu)?.length, 3, "turn games, Calls and the slot are the only surface mounts");

console.log("Conversation chats render each turn game board once.");
