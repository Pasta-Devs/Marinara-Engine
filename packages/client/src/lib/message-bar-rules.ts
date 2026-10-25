// ──────────────────────────────────────────────
// What the message bar may do in a chat
// ──────────────────────────────────────────────
// In a novel the bar only steers: Send writes the next passage, and anything typed there is guidance for
// it, never a message of yours (the AI already writes the protagonist). Every rule that follows from that
// lives here, so a new bar feature has one place to check.
import { buildGuidedGenerationInstructionMessage, buildNovelGuideInstructionMessage } from "@marinara-engine/shared";

export interface MessageBarRules {
  /** The bar's text is always guidance for the next reply, and Send works with an empty bar. */
  steersOnly: boolean;
  /** Attach files; they would need a message of yours. */
  attachments: boolean;
  /** The Post only quick reply, which posts a message of yours. */
  postOnly: boolean;
  /** The Guide reply quick reply; in a novel Send already sends the text as guidance. */
  guideReply: boolean;
  /** Impersonate in any form: a novel has no turn of yours to write. */
  impersonate: boolean;
  /** Submitting a ready location move, which rides on a turn of yours. */
  spatialMoves: boolean;
  /** Slash commands the bar does not offer. */
  hiddenSlashCommands: ReadonlySet<string>;
  /** The guidance message for a direction typed in the bar. */
  guideInstruction: (direction: string) => string;
}

const CHAT_RULES: MessageBarRules = {
  steersOnly: false,
  attachments: true,
  postOnly: true,
  guideReply: true,
  impersonate: true,
  spatialMoves: true,
  hiddenSlashCommands: new Set(),
  guideInstruction: buildGuidedGenerationInstructionMessage,
};

const NOVEL_RULES: MessageBarRules = {
  steersOnly: true,
  attachments: false,
  postOnly: false,
  guideReply: false,
  impersonate: false,
  spatialMoves: false,
  // /send would post a message of yours into the manuscript.
  hiddenSlashCommands: new Set(["impersonate", "impersonate_prompt", "send"]),
  guideInstruction: buildNovelGuideInstructionMessage,
};

/** The bar's rules for a chat. The same object comes back each time, so it is safe in hook dependencies. */
export function getMessageBarRules(novel: boolean | undefined): MessageBarRules {
  return novel ? NOVEL_RULES : CHAT_RULES;
}
