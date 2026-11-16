// Selfies in Conversation mode: which image connection a selfie uses and the setup it starts from.
import assert from "node:assert/strict";
import {
  resolveConversationSelfieConnectionId,
  resolveConversationSelfieSetup,
} from "../../../packages/client/src/lib/conversation-selfie-setup.js";

const conversationImageConnections = [
  { id: "text", provider: "openai", defaultForAgents: true },
  { id: "image-secondary", provider: "image_generation", defaultForAgents: false },
  { id: "image-default", provider: "image_generation", defaultForAgents: "true" },
];
assert.equal(
  resolveConversationSelfieConnectionId({
    currentConnectionId: null,
    selfieCommandEnabled: true,
    connections: conversationImageConnections,
  }),
  "image-default",
);
assert.equal(
  resolveConversationSelfieConnectionId({
    currentConnectionId: "image-explicit",
    selfieCommandEnabled: true,
    connections: conversationImageConnections,
  }),
  "image-explicit",
);
assert.equal(
  resolveConversationSelfieConnectionId({
    currentConnectionId: null,
    selfieCommandEnabled: false,
    connections: conversationImageConnections,
  }),
  null,
);
assert.deepEqual(
  resolveConversationSelfieSetup({
    commandToggles: {},
    selfieCommandAvailable: true,
    selfieCommandEnabled: true,
    currentConnectionId: null,
    connections: conversationImageConnections,
  }),
  {
    conversationCommandToggles: { selfie: true },
    imageGenConnectionId: "image-default",
  },
  "Conversation setup should persist both the enabled Selfie command and its default image connection",
);
