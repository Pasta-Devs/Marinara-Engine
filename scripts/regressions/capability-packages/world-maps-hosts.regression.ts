// World Maps (the hierarchical-maps package) is told the chat's mode wherever the app shows it: the Roleplay and Game
// inputs' runtime controls and the Game Map on desktop and phone (#4532). Chat Settings describes it with a short
// feature summary instead of repeating how to install it (#4533). Reads component source; e2e/core-flows.e2e.ts
// ("World Maps stays in Agents and Chat Settings") opens the package's controls, but its stub never checks the props.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../../packages/client/src/${path}`, import.meta.url), "utf8");
const findCapabilityHosts = (source: string, packageId: string, view: string) =>
  (source.match(/<CapabilityElement\b[\s\S]*?\/>/gu) ?? []).filter(
    (host) => host.includes(`packageId="${packageId}"`) && host.includes(`view="${view}"`),
  );
const sourceBetween = (source: string, startMarker: string, endMarker: string, label: string) => {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `${label} start marker must exist`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end > start, `${label} end marker must exist after its start marker`);
  return source.slice(start, end);
};

const roleplayRuntimeHosts = findCapabilityHosts(read("components/chat/ChatInput.tsx"), "hierarchical-maps", "runtime");
assert.equal(roleplayRuntimeHosts.length, 1, "Roleplay must expose exactly one World Maps runtime host");
assert.match(
  roleplayRuntimeHosts[0],
  /capabilityProps=\{\{[\s\S]*?chatId: activeChatId,[\s\S]*?chatMode: mode,/u,
  "Roleplay World Maps runtime controls must preserve the active chat mode",
);

const gameRuntimeHosts = findCapabilityHosts(read("components/game/GameInput.tsx"), "hierarchical-maps", "runtime");
assert.equal(gameRuntimeHosts.length, 1, "Game input must expose exactly one World Maps runtime host");
assert.match(
  gameRuntimeHosts[0],
  /capabilityProps=\{\{[\s\S]*?chatId: draftKey,[\s\S]*?chatMode: "game",/u,
  "Game World Maps runtime controls must identify their supported chat mode",
);

const gameWorldMapHosts = findCapabilityHosts(read("components/game/GameMap.tsx"), "hierarchical-maps", "world-map");
assert.equal(gameWorldMapHosts.length, 2, "Game Map must expose exactly its desktop and mobile World Maps hosts");
const desktopWorldMapHosts = gameWorldMapHosts.filter((host) => !host.includes("compact: true,"));
const mobileWorldMapHosts = gameWorldMapHosts.filter((host) => host.includes("compact: true,"));
assert.equal(desktopWorldMapHosts.length, 1, "Desktop Game Map must expose one non-compact World Maps host");
assert.equal(mobileWorldMapHosts.length, 1, "Mobile Game Map must expose one compact World Maps host");
for (const [surface, host] of [
  ["Desktop", desktopWorldMapHosts[0]],
  ["Mobile", mobileWorldMapHosts[0]],
] as const) {
  assert.match(
    host,
    /capabilityProps=\{\{[\s\S]*?chatId,[\s\S]*?chatMode: "game",/u,
    `${surface} Game World Maps host must identify its supported chat mode`,
  );
}

assert.match(
  read("features/chat-settings/agents/use-chat-agents.ts"),
  /const worldMapsSettingsDescription = localizeUi\("ui\.chat\.chatsettingsdrawer\.worldMapsFeatureSummary"\);/u,
  "Chat Settings must source the World Maps feature summary from localization",
);
const englishLocale = JSON.parse(read("localization/locales/en.json")) as Record<string, unknown>;
const worldMapsFeatureSummary = englishLocale["ui.chat.chatsettingsdrawer.worldMapsFeatureSummary"];
assert.equal(typeof worldMapsFeatureSummary, "string", "The World Maps settings summary must have English text");
assert.doesNotMatch(
  String(worldMapsFeatureSummary),
  /Add the Agent|Chat Settings|Tracker Agents/iu,
  "The World Maps settings summary must not repeat installation guidance",
);
const standaloneRoleplayAgentSettings = sourceBetween(
  read("features/chat-settings/agents/agent-settings-renderers.tsx"),
  "const renderStandaloneRoleplayAgentSettingsCard =",
  "const renderAgentPromptTemplateSelect =",
  "Standalone Roleplay agent settings renderer",
);
assert.match(
  standaloneRoleplayAgentSettings,
  /agent\.id === "hierarchical-maps"[\s\S]*?<CapabilityElement[\s\S]*?<AgentSettingsCard[\s\S]*?agent\.id === "hierarchical-maps"[\s\S]*?worldMapsSettingsDescription/u,
  "Standalone Roleplay World Maps settings must use the concise feature summary",
);
const roleplayActiveAgentCards = sourceBetween(
  read("features/chat-settings/agents/RoleplayAgentsSection.tsx"),
  "{/* Active agents in this category */}",
  "{inactiveInCat.length > 0 ? (",
  "Roleplay active-agent settings cards",
);
assert.match(
  roleplayActiveAgentCards,
  /agent\.id === "hierarchical-maps"[\s\S]{0,120}\? worldMapsSettingsDescription[\s\S]{0,80}: agent\.description/u,
  "Roleplay Chat Settings must omit package-installation guidance from the active World Maps card",
);

// Opening a map's linked lore from Chat Settings closes the drawer first, from every Chat Settings Maps host (the
// Agents cards, so across the drawer, its Agents state and the Roleplay and Game cards).
const chatSettingsMapsSource = [
  "ChatSettingsDrawer.tsx",
  "agents/use-chat-agents.ts",
  "agents/RoleplayAgentsSection.tsx",
  "agents/GameAgentsSection.tsx",
  "agents/agent-settings-renderers.tsx",
]
  .map((path) => read(`features/chat-settings/${path}`))
  .join("\n");
assert.match(
  chatSettingsMapsSource,
  /const openLorebookFromSettings = useCallback\([\s\S]{0,220}closeForSurface\(\);[\s\S]{0,80}openLorebookDetail\(lorebookId\);/u,
  "Opening linked Maps lore from Chat Settings must close the drawer before navigating",
);
assert.equal(
  chatSettingsMapsSource.match(/onOpenLorebook: openLorebookFromSettings/gu)?.length,
  2,
  "Every Chat Settings Maps host must use the close-and-open lorebook callback",
);
console.info("World Maps host checks passed.");
