// ──────────────────────────────────────────────
// UNO — model-facing move tools
// ──────────────────────────────────────────────
// These are NOT registered in the global tool registry. The runner injects
// them only on a bot seat's turn (scoped per active game), so they never leak
// into normal conversation. `parseToolCall` (in engine.ts) maps a call here
// onto a typed UnoMove that the engine validates.

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";

const COLOR_ENUM = ["red", "yellow", "green", "blue", "wild"];
const VALUE_ENUM = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2", "wild", "wild4"];
const DECLARED_COLOR_ENUM = ["red", "yellow", "green", "blue"];
// Jump-in is always a colored card identical to the top — the engine rejects
// wild jump-ins — so omit wild/wild4 to keep the model from proposing them.
const JUMP_IN_VALUE_ENUM = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "skip", "reverse", "draw2"];

export const playCardToolManifest = {
  name: "play_card",
  description:
    "Play one card from your hand onto the discard pile. Must match the active color OR the top card's value, or be a wild. " +
    "If you play a Wild or Wild Draw Four you MUST set declared_color. Set say_uno=true on the play that leaves you with one card. " +
    "If the 7-0 rule is on, playing a 7 requires swap_target (the exact name of the player to swap hands with).",
  parameters: {
    type: "object",
    properties: {
      color: {
        type: "string",
        description: "The card's color (use 'wild' for Wild / Wild Draw Four).",
        enum: COLOR_ENUM,
      },
      value: { type: "string", description: "The card's value/face.", enum: VALUE_ENUM },
      declared_color: {
        type: "string",
        description:
          "Required when playing a wild: choose the color best represented among the colored cards remaining in your hand; do not default to the current color.",
        enum: DECLARED_COLOR_ENUM,
      },
      say_uno: { type: "boolean", description: "Set true when this play leaves you holding exactly one card." },
      swap_target: {
        type: "string",
        description: "When playing a 7 under the 7-0 rule: the exact name of the player to swap hands with.",
      },
    },
    required: ["color", "value"],
  },
} satisfies ToolDefinition;

export const drawCardToolManifest = {
  name: "draw_card",
  description:
    "Draw from the draw pile. Use this when you have no playable card, or to take an accumulated +2/+4 penalty.",
  parameters: { type: "object", properties: {} },
} satisfies ToolDefinition;

export const passTurnToolManifest = {
  name: "pass_turn",
  description: "After voluntarily drawing a card, keep it and end your turn without playing.",
  parameters: { type: "object", properties: {} },
} satisfies ToolDefinition;

export const callUnoToolManifest = {
  name: "call_uno",
  description: "Declare UNO out loud while you are holding exactly one card, to avoid being caught and penalized.",
  parameters: { type: "object", properties: {} },
} satisfies ToolDefinition;

export const catchUnoToolManifest = {
  name: "catch_uno",
  description: "Catch another player who reached one card without declaring UNO. They draw the penalty.",
  parameters: {
    type: "object",
    properties: { target: { type: "string", description: "The exact name of the player you are catching." } },
    required: ["target"],
  },
} satisfies ToolDefinition;

export const jumpInToolManifest = {
  name: "jump_in",
  description:
    "Out of turn, play a card identical to the top card (same color AND value) to jump the queue. Only allowed when the jump-in rule is on.",
  parameters: {
    type: "object",
    properties: {
      color: { type: "string", description: "The card's color.", enum: DECLARED_COLOR_ENUM },
      value: { type: "string", description: "The card's value, identical to the top card.", enum: JUMP_IN_VALUE_ENUM },
    },
    required: ["color", "value"],
  },
} satisfies ToolDefinition;

/** All UNO tools, returned unfiltered by `toolManifests`. Legality isn't enforced by
 * shrinking this list — it's enforced by `applyMove` rejecting illegal calls after the fact. */
export const UNO_TOOL_MANIFESTS: readonly ToolDefinition[] = [
  playCardToolManifest,
  drawCardToolManifest,
  passTurnToolManifest,
  callUnoToolManifest,
  catchUnoToolManifest,
  jumpInToolManifest,
];

export const UNO_TOOL_NAMES: readonly string[] = UNO_TOOL_MANIFESTS.map((t) => t.name);
