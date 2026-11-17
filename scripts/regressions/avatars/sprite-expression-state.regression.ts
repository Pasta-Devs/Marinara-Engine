// Sprites on the stage: the transition each display mode uses, the expression each character shows and which turn
// sets it, and the lowest opacity a sprite can have.
import assert from "node:assert/strict";
import {
  SPRITE_DISPLAY_OPACITY_MIN,
  SPRITE_DISPLAY_OPACITY_PERCENT_MIN,
} from "../../../packages/client/src/components/chat/sprite-display-modes.js";
import { resolveSpriteTransition } from "../../../packages/client/src/lib/sprite-transition.js";
import {
  resolveLatestSpriteExpressionTurn,
  resolveSpriteExpressionState,
} from "../../../packages/client/src/lib/sprite-expression-state.js";

assert.equal(resolveSpriteTransition("full-body", "none"), "crossfade");
assert.equal(resolveSpriteTransition("full-body", "shake"), "shake");
assert.equal(resolveSpriteTransition("expressions", "none"), "none");
assert.deepEqual(
  resolveSpriteExpressionState([{ extra: { spriteExpressions: { "character-a": "happy" } } }, { extra: {} }]),
  { "character-a": "happy" },
);
assert.deepEqual(
  resolveSpriteExpressionState(
    [
      { extra: { spriteExpressions: { "character-a": "happy" } } },
      { extra: { spriteExpressions: { persona: "excited" } } },
      { extra: JSON.stringify({ spriteExpressions: { "character-c": "angry" } }) },
    ],
    { "character-b": "thinking" },
  ),
  {
    "character-a": "happy",
    "character-b": "thinking",
    "character-c": "angry",
    persona: "excited",
  },
);
assert.deepEqual(
  resolveSpriteExpressionState([
    { extra: { spriteExpressions: { "character-a": "happy" } } },
    { extra: { spriteExpressions: { "character-a": "neutral" } } },
  ]),
  { "character-a": "neutral" },
);
const completedExpressionMessages = [
  { id: "completed", role: "assistant", extra: { expressionSpriteIds: ["character-a", "persona"] } },
  { id: "user", role: "user", extra: {} },
  { id: "pending", role: "assistant", extra: {} },
];
assert.deepEqual(resolveLatestSpriteExpressionTurn(completedExpressionMessages), {
  characterIds: ["character-a", "persona"],
  messageId: "completed",
  messageIndex: 0,
});
assert.deepEqual(
  resolveLatestSpriteExpressionTurn([
    ...completedExpressionMessages,
    {
      id: "empty",
      role: "assistant",
      extra: JSON.stringify({ expressionSpriteIds: [], spriteExpressions: { "character-a": "happy" } }),
    },
  ]),
  { characterIds: [], messageId: "empty", messageIndex: 3 },
  "a completed empty result is distinct from a pending or failed expression turn",
);
assert.deepEqual(
  resolveLatestSpriteExpressionTurn([
    { id: "legacy-persona", role: "user", extra: { spriteExpressions: { persona: "happy" } } },
    { id: "legacy", role: "assistant", extra: { spriteExpressions: { "character-b": "neutral" } } },
  ]),
  { characterIds: ["character-b", "persona"], messageId: "legacy", messageIndex: 1 },
  "legacy expression turns retain both character and persona owners",
);
assert.equal(resolveLatestSpriteExpressionTurn([{ id: "pending", role: "assistant", extra: {} }]), undefined);
assert.deepEqual(
  resolveLatestSpriteExpressionTurn([
    completedExpressionMessages[0]!,
    { id: "user", role: "user", extra: { spriteExpressions: { persona: "happy" } } },
    { id: "regenerating", role: "assistant", extra: {} },
  ]),
  { characterIds: ["character-a", "persona"], messageId: "completed", messageIndex: 0 },
  "a retained persona appearance alone does not prove the pending assistant's expressions completed",
);
assert.deepEqual(
  resolveLatestSpriteExpressionTurn([
    { id: "persona-only", role: "assistant", extra: { expressionSpriteIds: ["persona"] } },
  ]),
  { characterIds: ["persona"], messageId: "persona-only", messageIndex: 0 },
  "the completion marker identifies persona-only turns without relying on retained user appearances",
);
assert.equal(resolveLatestSpriteExpressionTurn(undefined), undefined);
assert.equal(SPRITE_DISPLAY_OPACITY_MIN, 0, "sprite opacity must support a fully transparent endpoint");
assert.equal(SPRITE_DISPLAY_OPACITY_PERCENT_MIN, 0, "sprite opacity controls must expose zero percent");
