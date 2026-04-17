// ──────────────────────────────────────────────
// Export/Import Envelope Types
// ──────────────────────────────────────────────

/** Supported export entity types. */
export type ExportType =
  | "marinara_character"
  | "marinara_persona"
  | "marinara_lorebook"
  | "marinara_preset"
  | "marinara_chat_preset"
  | "marinara_profile";

/** Wrapper envelope for exported data. */
export interface ExportEnvelope<T = unknown> {
  type: ExportType;
  version: 1;
  exportedAt: string;
  data: T;
}
