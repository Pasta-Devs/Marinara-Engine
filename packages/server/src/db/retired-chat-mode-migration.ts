type Row = Record<string, unknown>;

/** Tables whose rows carry a `mode` column holding a ChatMode. */
export const RETIRED_CHAT_MODE_TABLES = ["chats", "chat_folders", "chat_presets"] as const;

/**
 * `visual_novel` was retired as a chat mode; Roleplay is its behavioural successor.
 * Existing installs still hold rows written before the removal, and those rows are
 * now unreachable: every lookup filters by one of the three live modes, so a
 * legacy chat, folder, or settings profile would simply stop showing up.
 *
 * Idempotent: rows with a live mode are returned untouched.
 */
export function migrateRetiredChatModeRow(row: Row): Row {
  if (row.mode !== "visual_novel") return row;
  return { ...row, mode: "roleplay" };
}
