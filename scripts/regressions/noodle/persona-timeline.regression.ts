import assert from "node:assert/strict";
import {
  formatNoodleTimelineForPrompt,
  NOODLE_PERSONA_IDENTITY_INSTRUCTION,
} from "../../../packages/server/src/services/noodle/noodle-prompt.js";
import "../fixtures/regression-agent-definitions.js";

const personaA = {
  id: "noodle-account-a",
  kind: "persona" as const,
  entityId: "persona-a",
  handle: "persona_a",
  displayName: "Persona A",
  avatarUrl: null,
  avatarCrop: null,
};
const personaB = {
  id: "noodle-account-b",
  kind: "persona" as const,
  entityId: "persona-b",
  handle: "persona_b",
  displayName: "Persona B",
  avatarUrl: null,
  avatarCrop: null,
};
const formattedPersonaTimeline = formatNoodleTimelineForPrompt(
  [
    {
      id: "post-a",
      authorAccountId: personaA.id,
      authorSnapshot: personaA,
      content: "Post from A",
      imageUrl: null,
      imagePrompt: null,
      metadata: {},
      createdAt: "2026-07-16T00:00:00.000Z",
    },
    {
      id: "post-b",
      authorAccountId: personaB.id,
      authorSnapshot: personaB,
      content: "Post from B",
      imageUrl: null,
      imagePrompt: null,
      metadata: {},
      createdAt: "2026-07-16T00:01:00.000Z",
    },
  ],
  [
    {
      id: "reply-b",
      postId: "post-a",
      parentInteractionId: null,
      actorAccountId: personaB.id,
      actorSnapshot: personaB,
      type: "reply",
      content: "B replies as B",
      imageUrl: null,
      createdAt: "2026-07-16T00:02:00.000Z",
    },
  ],
);
assert.match(formattedPersonaTimeline, /Persona A \(@persona_a; persona accountKey=persona:persona-a\)/);
assert.match(formattedPersonaTimeline, /Persona B \(@persona_b; persona accountKey=persona:persona-b\)/);
assert.match(formattedPersonaTimeline, /replyId=reply-b.*accountKey=persona:persona-b/);
assert.match(NOODLE_PERSONA_IDENTITY_INSTRUCTION, /separate user identity/);
