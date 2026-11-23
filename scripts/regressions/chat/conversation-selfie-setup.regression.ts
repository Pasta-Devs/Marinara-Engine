// Selfies in Conversation mode: which image model a selfie uses and the setup it starts from.
import assert from "node:assert/strict";
import { resolveConversationSelfieSetup } from "../../../packages/client/src/lib/conversation-selfie-setup.js";
import {
  resolveSelfieImageConnectionId,
  selfieFollowsImagesDefault,
} from "../../../packages/shared/src/utils/conversation-selfie-model.js";

// Setup switches selfies on without copying the Images default into the chat.
assert.deepEqual(
  resolveConversationSelfieSetup({
    commandToggles: {},
    selfieCommandAvailable: true,
    selfieCommandEnabled: true,
    currentConnectionId: null,
  }),
  { conversationCommandToggles: { selfie: true }, imageGenConnectionId: null },
  "Conversation setup should switch selfies on and leave the model to the Images default",
);
// A Selfie model the chat already has is kept.
assert.equal(
  resolveConversationSelfieSetup({
    commandToggles: {},
    selfieCommandAvailable: true,
    selfieCommandEnabled: true,
    currentConnectionId: " image-explicit ",
  }).imageGenConnectionId,
  "image-explicit",
);

// The chat's own model wins; with selfies switched on and none of its own, the Images default draws.
assert.equal(resolveSelfieImageConnectionId({ imageGenConnectionId: "own" }, "images-default"), "own");
assert.equal(
  resolveSelfieImageConnectionId({ conversationCommandToggles: { selfie: true } }, "images-default"),
  "images-default",
);
assert.equal(selfieFollowsImagesDefault({ conversationCommandToggles: { selfie: true } }), true);
// An older chat that never switched selfies on and never chose a model does not start taking selfies.
assert.equal(resolveSelfieImageConnectionId({}, "images-default"), "");
assert.equal(resolveSelfieImageConnectionId({ conversationCommandToggles: { selfie: false } }, "images-default"), "");
assert.equal(
  selfieFollowsImagesDefault({ imageGenConnectionId: "own", conversationCommandToggles: { selfie: true } }),
  false,
);

console.log("conversation-selfie-setup regression passed");
