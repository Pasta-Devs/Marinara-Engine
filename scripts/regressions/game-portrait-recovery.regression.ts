import assert from "node:assert/strict";
import { buildMissingSceneAssetGenerationPayload } from "../../packages/client/src/components/game/game-asset-generation-payload.js";

const chatId = "game-chat";
const npc = {
  name: "Il Dottore",
  description: "A familiar character with an existing portrait.",
};
const libraryAvatar = "/api/avatars/file/dottore.png";
const generatedAvatar = `/api/avatars/npc/${chatId}/il-dottore.png?v=1`;
const baseInput = {
  gameImageGenerationEnabled: true,
  activeChatId: chatId,
  currentBackground: "backgrounds:forest",
  savedSceneBackground: "backgrounds:forest",
  assetMap: { "backgrounds:forest": { path: "/forest.png" } },
  sceneAssetNpcs: [npc],
  npcsNeedingAvatars: [],
};

assert.equal(
  buildMissingSceneAssetGenerationPayload({
    ...baseInput,
    npcAvatarLookup: new Map([["il dottore", libraryAvatar]]),
    failedNpcAvatarNames: [npc.name],
  }),
  null,
  "a library-avatar load error must not replace the character portrait",
);

const libraryBackgroundRecovery = buildMissingSceneAssetGenerationPayload({
  ...baseInput,
  currentBackground: null,
  savedSceneBackground: "backgrounds:generated:missing-scene",
  assetMap: {},
  npcAvatarLookup: new Map([["il dottore", libraryAvatar]]),
});
assert.equal(libraryBackgroundRecovery?.backgroundTag, "backgrounds:generated:missing-scene");
assert.equal(
  libraryBackgroundRecovery?.npcsNeedingAvatars,
  undefined,
  "recovering a missing background must not regenerate a library portrait",
);
assert.equal(libraryBackgroundRecovery?.forceNpcAvatarNames, undefined);

for (const recovery of [
  {
    label: "load error",
    input: { failedNpcAvatarNames: [npc.name] },
  },
  {
    label: "missing background",
    input: {
      currentBackground: null,
      savedSceneBackground: "backgrounds:generated:missing-scene",
      assetMap: {},
    },
  },
]) {
  const result = buildMissingSceneAssetGenerationPayload({
    ...baseInput,
    ...recovery.input,
    npcAvatarLookup: new Map([["il dottore", generatedAvatar]]),
  });
  assert.deepEqual(result?.npcsNeedingAvatars, [{ ...npc, gender: null, pronouns: null }], `${recovery.label} payload`);
  assert.deepEqual(result?.forceNpcAvatarNames, [npc.name], `${recovery.label} force list`);
}

console.log("Game portrait recovery regression passed.");
