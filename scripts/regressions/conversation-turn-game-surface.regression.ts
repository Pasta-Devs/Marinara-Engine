// A Conversation chat mounts each turn game's board once. Games declare the `conversation-surface` slot, and
// ConversationView mounts every turn game's surface on its own, so with the game's agent on in the chat the slot must
// not mount it a second time (two UNO boards, two pool tables). Other packages in the slot, and Calls, are unchanged.
// A normal send also resumes the bots' turns and logs their prompts in debug mode. Reads source for that part.
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

// #4940-#4942: a normal Conversation send resumes the turn-game bots, stops quietly when cancelled, and logs their final prompts in debug mode or with DEBUG_AGENTS.
{
  const generateRouteSource = readFileSync(
    new URL("../../packages/server/src/routes/generate.routes.ts", import.meta.url),
    "utf8",
  );
  const turnGameBotRunnerSource = readFileSync(
    new URL("../../packages/server/src/services/turn-games/turn-game-bot-runner.service.ts", import.meta.url),
    "utf8",
  );
  const turnGameCommandRuntimeSource = readFileSync(
    new URL("../../packages/server/src/services/generation/turn-game-command-runtime.ts", import.meta.url),
    "utf8",
  );
  const turnGameResumeBlock =
    /\/\/ A normal chat send can claim[\s\S]*?\/\/ Signal completion before the slow illustration tail/u.exec(
      generateRouteSource,
    )?.[0] ?? "";
  assert.match(turnGameResumeBlock, /chatMode === "conversation"/u);
  assert.match(turnGameResumeBlock, /await runTurnGameBotTurns\(/u);
  assert.match(
    turnGameResumeBlock,
    /if \(generationSignal\.aborted \|\| isAbortLikeError\(turnGameErr\)\) return;/u,
    "Turn-game recovery must propagate cancellation without logging it as a failure",
  );
  assert.match(
    turnGameResumeBlock,
    /await runTurnGameBotTurns\([\s\S]*?if \(generationSignal\.aborted\) return;/u,
    "Turn-game recovery must re-check cancellation after a bot runner resolves",
  );
  assert.match(turnGameResumeBlock, /logger\.warn\(turnGameErr/u);
  assert.match(
    generateRouteSource,
    /logDebugOverride\(requestDebug \|\| isDebugAgentsEnabled\(\), message, \.\.\.args\)/u,
    "Turn-game prompt logging must honor both UI debug mode and DEBUG_AGENTS",
  );
  assert.equal(
    (generateRouteSource.match(/debugLog: turnGameDebugLog/gu) ?? []).length,
    3,
    "Every production turn-game runner path must receive the request-aware debug logger",
  );
  assert.match(turnGameCommandRuntimeSource, /debugLog: args\.debugLog/u);
  assert.match(
    turnGameBotRunnerSource,
    /args\.debugLog\?\.\([\s\S]*?debugJson\(moveMessages\)[\s\S]*?provider\.chatComplete\(moveMessages/u,
    "Turn-game bot moves must log the final provider prompt immediately before submission",
  );
}
console.log("Conversation chats render each turn game board once.");
