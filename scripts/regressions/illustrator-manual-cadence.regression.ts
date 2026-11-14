import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import {
  getAgentRunIntervalMeta,
  parseCadenceInputValue,
  stepCadenceValue,
} from "../../packages/client/src/lib/agent-cadence.js";
import {
  applyIllustratorChatRunInterval,
  shouldSkipAgentByMessageInterval,
} from "../../packages/server/src/services/generation/agent-cadence.js";
import { normalizeIllustratorRunInterval } from "../../packages/shared/src/utils/illustrator-generation-count.js";
import { resolveMusicDjExternalFolder } from "../../packages/shared/src/utils/music-dj-folder.js";
import {
  applyAgentAddSetupToAgentSettings,
  buildAgentAddMetadataPatch,
  buildInitialAgentAddSetupState,
  musicFolderInUse,
  type AgentAddSetupState,
} from "../../packages/client/src/components/chat/AgentAddSetupFields.js";

const illustrator = getAgentRunIntervalMeta("illustrator")!;
assert.equal(illustrator.min, 0, "Illustrator setup must offer manual-only cadence");
assert.equal(illustrator.defaultValue, 5, "automatic cadence remains the default");
assert.equal(parseCadenceInputValue("0", 5, 100, illustrator.min), 0);
assert.equal(parseCadenceInputValue("-1", 5, 100, illustrator.min), 0);
assert.equal(parseCadenceInputValue("101", 5, 100, illustrator.min), 100);
assert.equal(parseCadenceInputValue("", 5, 100, illustrator.min), 5);
assert.equal(parseCadenceInputValue("0", 8, 100), 1, "other agents keep their positive minimum");
assert.equal(stepCadenceValue(1, -1, 100, illustrator.min), 0, "Illustrator arrows reach manual-only cadence");
assert.equal(stepCadenceValue(0, -1, 100, illustrator.min), 0);
assert.equal(stepCadenceValue(1, -1, 100), 1, "other agents retain their positive stepping minimum");
assert.equal(getAgentRunIntervalMeta("lorebook-keeper")?.min ?? 1, 1);
assert.equal(getAgentRunIntervalMeta("custom", false)?.min ?? 1, 1);

let historyReads = 0;
const agentsStore = {
  async getLastSuccessfulRunByType() {
    historyReads++;
    return null;
  },
};
const base = { agentsStore, chatId: "manual-only", agentType: "illustrator", fallbackInterval: 5, messages: [] };
for (const value of [0, "0"]) {
  assert.equal(await shouldSkipAgentByMessageInterval({ ...base, settings: { runInterval: value } }), true);
}
assert.equal(historyReads, 0, "manual-only must skip even before the first successful run");
for (const value of [undefined, null, "", false, -1, "invalid", 1, 5]) {
  assert.equal(
    await shouldSkipAgentByMessageInterval({ ...base, settings: { runInterval: value } }),
    false,
    `invalid or automatic cadence ${String(value)} must not become manual-only`,
  );
}
assert.equal(
  await shouldSkipAgentByMessageInterval({ ...base, agentType: "lorebook-keeper", settings: { runInterval: 0 } }),
  false,
  "zero must not disable unrelated agents",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({
    ...base,
    agentsStore: {
      async getLastSuccessfulRunByType() {
        return { messageId: "prior" };
      },
    },
    settings: { runInterval: 5 },
    messages: [
      { id: "prior", role: "assistant" },
      { id: "new", role: "user" },
    ],
  }),
  true,
  "ordinary interval gating remains intact",
);

// Persona and character turns share the same interval, irrespective of recipient visibility.
const mixedHistory = [
  { id: "checkpoint", role: "assistant" },
  { id: "persona", role: "user", personaId: "mari" },
  { id: "character", role: "assistant", characterId: "dottore", extra: { hiddenFromAICharacterIds: ["narrator"] } },
];
const mixedCadence = {
  ...base,
  agentsStore: {
    async getLastSuccessfulRunByType() {
      return { messageId: "checkpoint" };
    },
  },
  settings: { runInterval: 3 },
};
assert.equal(await shouldSkipAgentByMessageInterval({ ...mixedCadence, messages: mixedHistory.slice(0, 2) }), true);
assert.equal(await shouldSkipAgentByMessageInterval({ ...mixedCadence, messages: mixedHistory }), false);

// Each chat can set its own Illustrator Run Interval; the agent's value is only the default.
for (const value of [undefined, null, "", " ", "soon", true, Number.NaN]) {
  assert.equal(normalizeIllustratorRunInterval(value), null, `${String(value)} leaves the chat on the agent default`);
}
assert.equal(normalizeIllustratorRunInterval(0), 0);
assert.equal(normalizeIllustratorRunInterval("3"), 3);
assert.equal(normalizeIllustratorRunInterval(2.7), 2);
assert.equal(normalizeIllustratorRunInterval(-4), 0);
assert.equal(normalizeIllustratorRunInterval(250), 100);

const chatSettings = (agentRunInterval: number, chatMetadata?: Record<string, unknown>, chatMode = "roleplay") =>
  applyIllustratorChatRunInterval("illustrator", { runInterval: agentRunInterval }, chatMetadata, chatMode);
assert.equal(chatSettings(5, { illustratorRunInterval: 2 }).runInterval, 2, "the chat value wins");
assert.equal(chatSettings(5, {}).runInterval, 5, "a missing chat value falls back to the agent");
assert.equal(chatSettings(5, { illustratorRunInterval: null }).runInterval, 5, "a cleared chat value falls back");
assert.equal(chatSettings(5).runInterval, 5);
assert.equal(
  applyIllustratorChatRunInterval("lorebook-keeper", { runInterval: 8 }, { illustratorRunInterval: 2 }, "roleplay")
    .runInterval,
  8,
  "other agents ignore the Illustrator chat value",
);
assert.equal(
  chatSettings(5, { illustratorRunInterval: 2 }, "game").runInterval,
  5,
  "Game orders illustrations by scenes, so it ignores the chat value",
);
const sinceLastImage = {
  ...base,
  agentsStore: {
    async getLastSuccessfulRunByType() {
      return { messageId: "prior" };
    },
  },
  messages: [
    { id: "prior", role: "assistant" },
    { id: "new", role: "user" },
  ],
};
assert.equal(
  await shouldSkipAgentByMessageInterval({
    ...sinceLastImage,
    settings: chatSettings(5, { illustratorRunInterval: 1 }),
  }),
  false,
  "a chat value of 1 runs on every message even though the agent waits 5",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({
    ...sinceLastImage,
    settings: chatSettings(5, { illustratorRunInterval: null }),
  }),
  true,
  "without a chat value the agent's interval still applies",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({ ...base, settings: chatSettings(1, { illustratorRunInterval: 0 }) }),
  true,
  "a chat value of 0 stops automatic runs even when the agent runs every message",
);
assert.equal(
  await shouldSkipAgentByMessageInterval({ ...base, settings: chatSettings(0, { illustratorRunInterval: 3 }) }),
  false,
  "a chat value brings back automatic runs when the agent default is manual-only",
);

// The add window saves the interval to the chat (only when it differs) and never to the agent.
const illustratorSetup = buildInitialAgentAddSetupState({
  agentId: "illustrator",
  settings: { runInterval: 5 },
  metadata: {},
  musicPlayerSource: "spotify",
  roleplaySpriteScale: 1,
});
const addPatch = (runInterval: number, metadata: Record<string, unknown> = {}) =>
  buildAgentAddMetadataPatch("illustrator", illustratorSetup, metadata, {
    runInterval,
    illustratorDefaults: { includeCharacterAppearance: false, useAvatarReferences: false, runInterval: 5 },
  });
assert.equal(addPatch(0).illustratorRunInterval, 0, "a different interval is saved to the chat");
assert.equal(Object.hasOwn(addPatch(5), "illustratorRunInterval"), false, "the agent default is not copied");
assert.equal(
  addPatch(5, { illustratorRunInterval: 2 }).illustratorRunInterval,
  null,
  "the default clears a chat value",
);
assert.equal(
  Object.hasOwn(
    buildAgentAddMetadataPatch("lorebook-keeper", illustratorSetup, {}, { runInterval: 3 }),
    "illustratorRunInterval",
  ),
  false,
  "other agents never write the Illustrator chat value",
);
assert.equal(applyAgentAddSetupToAgentSettings("illustrator", illustratorSetup, { runInterval: 5 }).runInterval, 5);

// Music DJ "Apply to" (#8901): this chat, its only character, or all chats. Each folder is saved to its own place.
const musicSettings = {
  customMusicSource: "game-assets",
  customMusicExternalFolder: "/music/default",
  customMusicCharacterFolders: { keyleth: "/music/keyleth" },
};
const musicSetup = (metadata: Record<string, unknown> = {}, chatCharacters = [{ id: "nazuna", name: "Nazuna" }]) =>
  buildInitialAgentAddSetupState({
    agentId: "spotify",
    settings: musicSettings,
    metadata,
    musicPlayerSource: "custom",
    roleplaySpriteScale: 1,
    chatCharacters,
  });
assert.equal(
  musicSetup().customMusicFolderTarget,
  "default",
  "with no chat or character folder, edits go to all chats",
);
assert.deepEqual(musicSetup().customMusicCharacter, { id: "nazuna", name: "Nazuna" });
assert.equal(musicSetup({ customMusicExternalFolder: "/music/chat" }).customMusicFolderTarget, "chat");
assert.equal(musicSetup({}, [{ id: "keyleth", name: "Keyleth" }]).customMusicFolderTarget, "character");
assert.equal(musicSetup({}, [{ id: "keyleth", name: "Keyleth" }]).customMusicCharacterFolder, "/music/keyleth");
assert.equal(
  musicSetup({}, [
    { id: "nazuna", name: "Nazuna" },
    { id: "keyleth", name: "Keyleth" },
  ]).customMusicCharacter,
  null,
  "a group chat offers no character",
);
// Add saves every folder edited in the window to its own place, whichever "Apply to" is showing, so what it saves is
// what "In use" showed. Each edit below is what the window's controls set.
const nazuna = [{ id: "nazuna", name: "Nazuna" }];
const keyleth = [{ id: "keyleth", name: "Keyleth" }];
const chatWithFolder = { customMusicExternalFolder: "/music/chat" };
const useDefault = { customMusicFolderTarget: "chat", customMusicChatFolder: "" } as const;
const unlink = { customMusicFolderTarget: "character", customMusicCharacterFolder: "" } as const;
const addMusicDj = (
  metadata: Record<string, unknown>,
  chatCharacters: Array<{ id: string; name: string }>,
  ...edits: Array<Partial<AgentAddSetupState>>
) => {
  const setup = edits.reduce<AgentAddSetupState>(
    (state, edit) => ({ ...state, ...edit }),
    musicSetup(metadata, chatCharacters),
  );
  const settings = applyAgentAddSetupToAgentSettings("spotify", setup, musicSettings);
  const patch = buildAgentAddMetadataPatch("spotify", setup, metadata);
  assert.deepEqual(
    resolveMusicDjExternalFolder({
      settings,
      chatMetadata: { ...metadata, ...patch },
      chatCharacterIds: chatCharacters.map((character) => character.id),
    }),
    musicFolderInUse(setup),
    `Add saves the folder "In use" shows after ${JSON.stringify(edits)}`,
  );
  return {
    source: settings.customMusicSource,
    defaultFolder: settings.customMusicExternalFolder,
    characterFolders: settings.customMusicCharacterFolders,
    chatFolder: patch.customMusicExternalFolder,
  };
};
assert.deepEqual(
  addMusicDj(chatWithFolder, keyleth),
  {
    source: "game-assets",
    defaultFolder: "/music/default",
    characterFolders: { keyleth: "/music/keyleth" },
    chatFolder: undefined,
  },
  "an untouched window keeps every saved folder",
);
assert.deepEqual(addMusicDj({}, nazuna, { customMusicFolderTarget: "chat", customMusicChatFolder: " /music/chat " }), {
  source: "game-assets",
  defaultFolder: "/music/default",
  characterFolders: { keyleth: "/music/keyleth" },
  chatFolder: "/music/chat",
});
assert.deepEqual(
  addMusicDj({}, nazuna, { customMusicFolderTarget: "character", customMusicCharacterFolder: "/music/nazuna" }),
  {
    source: "game-assets",
    defaultFolder: "/music/default",
    characterFolders: { keyleth: "/music/keyleth", nazuna: "/music/nazuna" },
    chatFolder: undefined,
  },
);
assert.deepEqual(
  addMusicDj({}, nazuna, {
    customMusicFolderTarget: "default",
    customMusicSource: "folder",
    customMusicExternalFolder: "/music/new-default",
  }),
  {
    source: "folder",
    defaultFolder: "/music/new-default",
    characterFolders: { keyleth: "/music/keyleth" },
    chatFolder: undefined,
  },
);
assert.deepEqual(
  addMusicDj(
    {},
    nazuna,
    { customMusicFolderTarget: "chat", customMusicChatFolder: "/music/a" },
    { customMusicFolderTarget: "default", customMusicSource: "folder", customMusicExternalFolder: "/music/b" },
  ),
  {
    source: "folder",
    defaultFolder: "/music/b",
    characterFolders: { keyleth: "/music/keyleth" },
    chatFolder: "/music/a",
  },
  "switching Apply to keeps the folder typed for this chat",
);
assert.deepEqual(
  addMusicDj(
    {},
    nazuna,
    { customMusicFolderTarget: "character", customMusicCharacterFolder: "/music/nazuna" },
    { customMusicFolderTarget: "chat" },
  ).characterFolders,
  { keyleth: "/music/keyleth", nazuna: "/music/nazuna" },
  "switching Apply to keeps the character's new folder",
);
assert.equal(
  addMusicDj(chatWithFolder, nazuna, useDefault, { customMusicFolderTarget: "default" }).chatFolder,
  null,
  "Use default still clears this chat's folder after switching Apply to",
);
assert.deepEqual(
  addMusicDj(chatWithFolder, keyleth, useDefault, unlink),
  {
    source: "game-assets",
    defaultFolder: "/music/default",
    characterFolders: {},
    chatFolder: null,
  },
  "Use default and then Unlink clear both folders",
);
// The add window's Game Assets subfolders (#8916): "All chats" edits the default, "This chat" edits this chat's own,
// and each is saved only to its own place. A `customMusicFolder` older chats hold only copied the default.
const gameAssetsDefault = { customMusicSource: "game-assets", customMusicFolder: "music/exploration" };
const addGameAssetsFolder = (metadata: Record<string, unknown>, edit: Partial<AgentAddSetupState> = {}) => {
  const initial = buildInitialAgentAddSetupState({
    agentId: "spotify",
    settings: gameAssetsDefault,
    metadata,
    musicPlayerSource: "custom",
    roleplaySpriteScale: 1,
  });
  const setup = { ...initial, ...edit };
  const patch = buildAgentAddMetadataPatch("spotify", setup, metadata);
  return {
    target: initial.customMusicFolderTarget,
    shown: initial.customMusicChatGameAssetsFolder,
    defaultFolder: applyAgentAddSetupToAgentSettings("spotify", setup, gameAssetsDefault).customMusicFolder,
    chatFolder: patch.customMusicGameAssetsFolder,
    writesLegacyKey: "customMusicFolder" in patch,
  };
};
const untouched = {
  target: "default",
  shown: "",
  defaultFolder: "music/exploration",
  chatFolder: undefined,
  writesLegacyKey: false,
};
assert.deepEqual(addGameAssetsFolder({}), untouched, "an untouched window leaves the chat on the default subfolder");
assert.deepEqual(
  addGameAssetsFolder({ customMusicFolder: "music" }),
  untouched,
  "an older chat's copied customMusicFolder is not taken for the chat's own subfolder",
);
assert.deepEqual(
  addGameAssetsFolder({}, { customMusicFolderTarget: "chat", customMusicChatGameAssetsFolder: " combat " }),
  { ...untouched, chatFolder: "music/combat" },
  "This chat saves the typed subfolder to this chat and never to the default",
);
assert.deepEqual(
  addGameAssetsFolder({}, { customMusicFolder: "combat" }),
  { ...untouched, defaultFolder: "music/combat" },
  "All chats saves the typed subfolder to the default and never to this chat",
);
assert.deepEqual(
  addGameAssetsFolder({ customMusicGameAssetsFolder: "music/combat" }),
  { ...untouched, target: "chat", shown: "music/combat" },
  "a chat with its own subfolder opens on This chat, showing and keeping it",
);
assert.equal(
  addGameAssetsFolder({ customMusicGameAssetsFolder: "music/combat" }, { customMusicChatGameAssetsFolder: "" })
    .chatFolder,
  null,
  "clearing This chat's subfolder sends the chat back to the default",
);

// The drawer keeps This chat selected when its Game Assets subfolder is saved or cleared (Dottore on #8939).
assert.match(
  readFileSync(
    new URL("../../packages/client/src/features/chat-settings/ChatSettingsDrawer.tsx", import.meta.url),
    "utf8",
  ),
  /const saveCustomMusicFolder = \(target: "chat" \| "default", value: string\) => \{\s*if \(target === "chat"\) \{[\s\S]{0,200}setMusicFolderTargetChoice\(\{ chatId: chat\.id, target: "chat" \}\);/u,
  "clearing This chat's Game Assets subfolder keeps Apply to on This chat",
);

// Run the production formatter without booting browser hooks in Node.
const hookSource = readFileSync(new URL("../../packages/client/src/hooks/use-generate.ts", import.meta.url), "utf8");
const sourceFile = ts.createSourceFile("use-generate.ts", hookSource, ts.ScriptTarget.Latest, true);
const formatter = sourceFile.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === "formatAgentBubble",
);
assert.ok(formatter);
const compiled = ts.transpileModule(formatter.getText(sourceFile), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const english = JSON.parse(
  readFileSync(new URL("../../packages/client/src/localization/locales/en.json", import.meta.url), "utf8"),
);
const bubble = new Function("translate", `${compiled}; return formatAgentBubble;`)((key: string) => english[key]);
assert.equal(
  bubble("illustrator", "Illustrator", { shouldGenerate: false, reason: "The scene has not changed." }),
  "🎨 No illustration requested this time — The scene has not changed.",
);
assert.equal(
  bubble("illustrator", "Illustrator", { shouldGenerate: true, prompt: "The laboratory." }),
  "🎨 Illustration requested",
);
assert.equal(
  bubble("illustrator", "Illustrator", { generated: true, chosen: "scene.png", reason: "The scene changed." }),
  "🎨 Scene background generated — The scene changed.",
);
for (const data of [
  {},
  { generated: true, chosen: " " },
  { shouldGenerate: true, prompt: " " },
  { shouldGenerate: "true", prompt: "The laboratory." },
]) {
  assert.equal(
    bubble("illustrator", "Illustrator", data),
    "🎨 Illustrator returned no usable image decision or prompt",
  );
}

const manualRoute = readFileSync(
  new URL("../../packages/server/src/routes/generate/retry-agents-route.ts", import.meta.url),
  "utf8",
);
assert.ok(manualRoute.includes("isManualIllustratorImageRequest"));
assert.ok(!manualRoute.includes("shouldSkipAgentByMessageInterval"), "manual generation must bypass cadence");
console.info("Illustrator manual-only cadence regressions passed");
