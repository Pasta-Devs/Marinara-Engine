// Illustrator's image settings: what a newly added Illustrator inherits, which image connection and size it uses,
// how many images it makes and which variants it retries, and the connection its prompts are written with.
import assert from "node:assert/strict";
import { normalizeIllustratorImagesPerGeneration } from "../../../packages/shared/src/utils/illustrator-generation-count.js";
import {
  resolveIllustratorPromptRuntime,
  type IllustratorPromptConnection,
} from "../../../packages/server/src/services/generation/illustrator-prompt-runtime.js";
import { resolveIllustratorImageConnectionId } from "../../../packages/server/src/services/generation/illustrator-background-generation.js";
import { resolveIllustratorImageSize } from "../../../packages/server/src/services/image/image-generation-settings.js";
import { generateIllustratorImageVariants } from "../../../packages/server/src/services/image/illustrator-image-variants.js";
import {
  buildAgentAddMetadataPatch,
  buildInitialAgentAddSetupState,
} from "../../../packages/client/src/components/chat/AgentAddSetupFields.js";

const inheritedIllustratorSetup = buildInitialAgentAddSetupState({
  agentId: "illustrator",
  settings: { includeCharacterAppearance: true, useAvatarReferences: false },
  metadata: {},
  musicPlayerSource: "off",
  roleplaySpriteScale: 1,
});
const inheritedIllustratorPatch = buildAgentAddMetadataPatch(
  "illustrator",
  inheritedIllustratorSetup,
  {},
  {
    illustratorDefaults: { includeCharacterAppearance: true, useAvatarReferences: false },
  },
);
assert.equal(Object.hasOwn(inheritedIllustratorPatch, "illustratorIncludeCharacterAppearance"), false);
assert.equal(Object.hasOwn(inheritedIllustratorPatch, "illustratorUseAvatarReferences"), false);
const staleIllustratorMetadata = {
  illustratorIncludeCharacterAppearance: true,
  illustratorUseAvatarReferences: false,
};
assert.deepEqual(
  buildAgentAddMetadataPatch("illustrator", inheritedIllustratorSetup, staleIllustratorMetadata, {
    illustratorDefaults: { includeCharacterAppearance: true, useAvatarReferences: false },
  }),
  {
    illustratorIncludeCharacterAppearance: null,
    illustratorUseAvatarReferences: null,
  },
);
assert.deepEqual(resolveIllustratorImageSize({ width: 960, height: 540 }, "landscape"), {
  width: 960,
  height: 540,
});
assert.deepEqual(resolveIllustratorImageSize({ width: 540, height: 960 }, "landscape"), {
  width: 960,
  height: 540,
});
assert.deepEqual(resolveIllustratorImageSize({ width: 960, height: 540 }, "portrait"), {
  width: 540,
  height: 960,
});
assert.equal(
  resolveIllustratorImageConnectionId(
    "game",
    { gameImageConnectionId: " game-images ", illustratorImageConnectionId: "roleplay-images" },
    "agent-images",
  ),
  "game-images",
);
assert.equal(
  resolveIllustratorImageConnectionId(
    "roleplay",
    { gameImageConnectionId: "game-images", illustratorImageConnectionId: " roleplay-images " },
    "agent-images",
  ),
  "roleplay-images",
);
assert.equal(resolveIllustratorImageConnectionId("game", {}, " agent-images "), "agent-images");
assert.equal(normalizeIllustratorImagesPerGeneration(undefined), 1);
assert.equal(normalizeIllustratorImagesPerGeneration("3"), 3);
assert.equal(normalizeIllustratorImagesPerGeneration(99), 4);
const attemptedImageVariants: number[] = [];
assert.deepEqual(
  await generateIllustratorImageVariants({
    count: 3,
    generate: async (index) => {
      attemptedImageVariants.push(index);
      if (index === 1) throw new Error("one variant failed");
      return `image-${index}`;
    },
  }),
  ["image-0", "image-2"],
);
assert.deepEqual(attemptedImageVariants, [0, 1, 2]);
const mainPromptConnection: IllustratorPromptConnection = {
  id: "main-prompt-connection",
  name: "Main prompt connection",
  provider: "openai",
  baseUrl: "https://main.example.test/v1",
  apiKey: "main-key",
  model: "gpt-4o",
};
const selfiePromptConnection: IllustratorPromptConnection = {
  id: "selfie-prompt-connection",
  name: "Selfie prompt connection",
  provider: "openai",
  baseUrl: "https://selfie.example.test/v1",
  apiKey: "selfie-key",
  model: "gpt-4.1-mini",
};
const requestedSelfiePromptConnections: string[] = [];
const selfiePromptConnections = {
  async getWithKey(id: string) {
    requestedSelfiePromptConnections.push(id);
    return id === selfiePromptConnection.id ? selfiePromptConnection : null;
  },
  async getFallbackForAgents() {
    return null;
  },
};
const overriddenSelfiePromptRuntime = await resolveIllustratorPromptRuntime({
  chatMetadata: { illustratorPromptConnectionId: selfiePromptConnection.id },
  defaultConnection: mainPromptConnection,
  defaultConnectionId: mainPromptConnection.id,
  connections: selfiePromptConnections,
  resolveBaseUrl: (connection) => connection.baseUrl ?? "",
});
assert.equal(overriddenSelfiePromptRuntime.connectionId, selfiePromptConnection.id);
assert.equal(overriddenSelfiePromptRuntime.model, selfiePromptConnection.model);
assert.deepEqual(requestedSelfiePromptConnections, [selfiePromptConnection.id]);
const defaultSelfiePromptRuntime = await resolveIllustratorPromptRuntime({
  chatMetadata: {},
  defaultConnection: mainPromptConnection,
  defaultConnectionId: mainPromptConnection.id,
  connections: selfiePromptConnections,
  resolveBaseUrl: (connection) => connection.baseUrl ?? "",
});
assert.equal(defaultSelfiePromptRuntime.connectionId, mainPromptConnection.id);
assert.equal(defaultSelfiePromptRuntime.model, mainPromptConnection.model);
await assert.rejects(
  resolveIllustratorPromptRuntime({
    chatMetadata: { illustratorPromptConnectionId: "deleted-selfie-prompt-connection" },
    defaultConnection: mainPromptConnection,
    defaultConnectionId: mainPromptConnection.id,
    connections: selfiePromptConnections,
    resolveBaseUrl: (connection) => connection.baseUrl ?? "",
  }),
  /selected selfie Prompt Model connection could not be found/u,
);
