import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readSource(path: string) {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), "utf8");
}

const homeBrowser = readSource("packages/client/src/components/chat/HomeBrowserHub.tsx");
const agentCatalog = readSource("packages/client/src/components/agents/AgentCatalogView.tsx");
const agentModeFilter = readSource("packages/client/src/components/agents/AgentModeFilter.tsx");
const uiStore = readSource("packages/client/src/stores/ui.store.ts");
const widgetEditor = readSource("packages/client/src/components/game/GameWidgetSetupEditor.tsx");
const roleplaySurface = readSource("packages/client/src/components/chat/ChatRoleplaySurface.tsx");
const branchSelector = readSource("packages/client/src/components/chat/ChatBranchSelector.tsx");
const gameSurface = readSource("packages/client/src/components/game/GameSurface.tsx");
const gameNarration = readSource("packages/client/src/components/game/GameNarration.tsx");
const chatRoutes = readSource("packages/server/src/routes/chats.routes.ts");

assert.match(
  homeBrowser,
  /openAgentCatalog\(activeRecommendation\.manifest\.id\)/u,
  "Discovery Desk must open the displayed Agent",
);
assert.match(uiStore, /agentCatalogInitialPackageId: packageId \?\? null/u);
assert.match(agentModeFilter, /export type AgentModeFilterValue = "all" \| ChatMode/u);
assert.match(agentCatalog, /<AgentModeFilter className="mt-2" value=\{modeFilter\} onChange=\{setModeFilter\} \/>/u);
assert.match(agentCatalog, /modeFilter === "all" \|\| packageModes\(manifest\.id\)\.includes\(modeFilter\)/u);
assert.match(agentCatalog, /const hasActiveFilters = Boolean\(query\.trim\(\)\) \|\| modeFilter !== "all";/u);

assert.match(widgetEditor, /ui\.game\.gamewidgetsetupeditor\.id/u);
assert.match(
  widgetEditor,
  /event\.currentTarget\.value = replaceWidgetId\(widget\.id, event\.currentTarget\.value\);/u,
);

const themedCountBadge = /mari-chrome-muted-badge[^"]*text-\[var\(--marinara-chat-chrome-accent\)\]/u;
assert.match(roleplaySurface, themedCountBadge);
assert.match(branchSelector, themedCountBadge);

assert.match(gameSurface, /const turnKey = narrationTurnKey\(msg\);/u);
assert.match(gameSurface, /setNarrationDoneTurnKey\(null\);\s+setActiveChoices\(null\);/u);
assert.match(gameSurface, /gameNarrationMessageId: turnKey/u);
assert.match(gameNarration, /stale out-of-range cursor must restart[\s\S]*?: 0;/u);
assert.match(chatRoutes, /delete settingsToKeep\.gameNarrationIndex;/u);
assert.match(chatRoutes, /delete settingsToKeep\.gameNarrationMessageId;/u);

console.log("Assigned issue sweep regressions passed.");
