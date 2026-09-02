import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const readSource = (path: string) => readFileSync(join(repositoryRoot, path), "utf8");

const chatRoutes = readSource("packages/server/src/routes/chats.routes.ts");
assert.match(chatRoutes, /swipes\/others\/:index/u);
assert.match(chatRoutes, /\^\\d\+\$[\s\S]*Number\.isSafeInteger\(keepIndex\)/u);
assert.match(
  chatRoutes,
  /\.sort\(\(a: any, b: any\) => b\.index - a\.index\)[\s\S]*removeSwipe/u,
  "deleting other swipes must remove them from highest index down so the selected swipe stays stable",
);

const generateRoute = readSource("packages/server/src/routes/generate.routes.ts");
const personaResolution = generateRoute.indexOf("personaDescription = resolvePersonaPromptMacros(personaDescription)");
const illustratorConsumption = generateRoute.indexOf("resolveIllustratorCharacterReferences({");
assert.ok(personaResolution >= 0 && illustratorConsumption > personaResolution);
assert.match(generateRoute, /deferCharacterMacros \? \{ deferCharacterMacros: "all" \} : undefined/u);
assert.match(generateRoute, /appearance: resolvePersonaPromptMacros\(personaFields\.appearance \?\? ""\)/u);

const gameSurface = readSource("packages/client/src/components/game/GameSurface.tsx");
assert.match(
  gameSurface,
  /const narrationUpdatesBlocked =[\s\S]*gameInputGenerationBlocked[\s\S]*assetGenerationBlocksScene/u,
);
assert.match(gameSurface, /visibleNarrationMessages\.map/u);

const widgetPanel = readSource("packages/client/src/components/game/GameWidgetPanel.tsx");
const widgetEditor = readSource("packages/client/src/components/game/GameWidgetSetupEditor.tsx");
assert.match(widgetPanel, /mode === "initial"[\s\S]*<GameWidgetSetupEditor/u);
assert.match(widgetEditor, /const duplicateWidget = \(widget: HudWidget\)/u);
assert.match(widgetEditor, /config: structuredClone\(widget\.config\)/u);
assert.match(widgetEditor, /startingValue: Math\.min\(max,/u);

const workspaceAgent = readSource("packages/server/src/services/professor-mari/workspace-agent.service.ts");
// #5721 narrowed the sweep's blanket custom-provider carve-out: LOCAL custom
// endpoints (llama.cpp/vLLM/Ollama/Unsloth) now get the hidden-reasoning
// disable; remote custom endpoints keep the sweep's send-nothing behavior.
assert.match(workspaceAgent, /isLocalInferenceBaseUrl\(connection\.baseUrl \?\? ""\)/u);

process.stdout.write("Issue sweep 5380-5434 regression passed.\n");
