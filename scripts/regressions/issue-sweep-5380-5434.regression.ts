import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  workspaceMutationAuthorizationIssue,
  workspaceMutationSignature,
} from "../../packages/server/src/services/professor-mari/workspace-agent.service.js";

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
assert.match(workspaceAgent, /connection\.provider\.toLowerCase\(\) !== "custom"/u);

const pendingUpdateCommand = {
  id: "update-character",
  name: "app_data" as const,
  arguments: { action: "character.update", characterId: "char-1", patch: { appearance: "Blue coat" } },
};
assert.equal(
  workspaceMutationAuthorizationIssue(
    { ...pendingUpdateCommand, authorization: "Tak, zgadzam się." },
    {
      directUserText: "Tak, zgadzam się.",
      pendingMutationCategories: ["update"],
      pendingMutationSignatures: [workspaceMutationSignature(pendingUpdateCommand)],
    },
  ),
  null,
);
assert.match(
  workspaceMutationAuthorizationIssue(
    {
      ...pendingUpdateCommand,
      arguments: { ...pendingUpdateCommand.arguments, characterId: "different-character" },
      authorization: "Tak, zgadzam się.",
    },
    {
      directUserText: "Tak, zgadzam się.",
      pendingMutationCategories: ["update"],
      pendingMutationSignatures: [workspaceMutationSignature(pendingUpdateCommand)],
    },
  ) ?? "",
  /update operation|active user message/iu,
);
assert.match(
  workspaceMutationAuthorizationIssue(
    { ...pendingUpdateCommand, authorization: "pasta" },
    { directUserText: "Can we talk about pasta?", pendingMutationCategories: ["update"] },
  ) ?? "",
  /update operation|active user message/iu,
);
assert.match(
  workspaceMutationAuthorizationIssue(
    { ...pendingUpdateCommand, authorization: "No." },
    { directUserText: "No.", pendingMutationCategories: ["update"] },
  ) ?? "",
  /explicitly requests no workspace changes/iu,
);

process.stdout.write("Issue sweep 5380-5434 regression passed.\n");
