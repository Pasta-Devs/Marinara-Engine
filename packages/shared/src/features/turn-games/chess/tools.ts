// ──────────────────────────────────────────────
// Chess — model-facing move tool
// ──────────────────────────────────────────────
// NOT registered in the global tool registry. The runner injects this only on
// a bot seat's turn (scoped per active game). The human never uses it — the
// board UI posts moves to the REST endpoint directly — so the schema is tuned
// purely for the model: a single SAN string copied verbatim from the legal-move
// list that `describeForModel` provides.

import type { ToolDefinition } from "../../function-calls/tool-definitions.js";

export const chessMoveToolManifest = {
  name: "chess_move",
  description:
    "Make your chess move in Standard Algebraic Notation (SAN). Copy EXACTLY one move from the legal-move list " +
    'you were given — e.g. "e4", "Nf3", "exd5", "O-O", "e8=Q", "Qxf7#". Never invent a move that is not on the list.',
  parameters: {
    type: "object",
    properties: {
      san: {
        type: "string",
        description: "Your move in SAN, copied verbatim from the legal-move list.",
      },
    },
    required: ["san"],
  },
} satisfies ToolDefinition;

/** All chess tools. */
export const CHESS_TOOL_MANIFESTS: readonly ToolDefinition[] = [chessMoveToolManifest];
