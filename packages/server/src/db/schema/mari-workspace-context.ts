// ──────────────────────────────────────────────
// Schema: Mari Workspace Context (#5073)
//
// User-attached reference context for a Professor Mari workspace conversation —
// today, slices of the user's own chat history (all / a range / the last N
// messages) exported to JSON so Mari can read what is happening in a roleplay
// and give grounded creative feedback. Unlike a per-message file attachment,
// this is a persistent per-Mari-chat SET: it is injected into Mari's prompt as
// a preserved context block every turn regardless of message age, and the user
// manages it (add / remove to free tokens) through a Context Viewer.
//
// One row per attached item, scoped to the Mari workspace `chatId`. `kind`
// leaves room for future context sources (a whole roleplay, a game state) on
// the same channel. `content` is the already-serialized JSON the injector
// wraps verbatim; `tokenEstimate` is cached so the Context Viewer can show a
// per-item cost without re-tokenizing.
// ──────────────────────────────────────────────
import { fileTable, text, integer } from "../file-schema.js";

export const mariWorkspaceContext = fileTable("mari_workspace_context", {
  id: text("id").primaryKey(),
  /** The Professor Mari workspace chat this context belongs to (cascade parent). */
  chatId: text("chat_id").notNull(),
  /** Context source kind. "chat_history" today; reserved for future sources. */
  kind: text("kind").notNull().default("chat_history"),
  /** Human label shown in the Context Viewer, e.g. "Ada & the storm — last 20 messages". */
  label: text("label").notNull(),
  /** The chat this slice was exported FROM (empty when not applicable). */
  sourceChatId: text("source_chat_id").notNull().default(""),
  /** Already-serialized JSON the injector wraps verbatim into Mari's context. */
  content: text("content").notNull(),
  /** Cached token estimate for the item, so the Context Viewer needn't re-tokenize. */
  tokenEstimate: integer("token_estimate").notNull().default(0),
  createdAt: text("created_at").notNull(),
});
