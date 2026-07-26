// ──────────────────────────────────────────────
// Export/Import Envelope Types
// ──────────────────────────────────────────────

import type { ChatMode } from "./chat.js";

/** Supported export entity types. */
export type ExportType =
  | "marinara_character"
  | "marinara_persona"
  | "marinara_lorebook"
  | "marinara_preset"
  | "marinara_chat_preset"
  | "marinara_chat_settings_profile"
  | "marinara_memory_recall"
  | "marinara_profile";

/** Wrapper envelope for exported data. */
export interface ExportEnvelope<T = unknown> {
  type: ExportType;
  version: 1;
  exportedAt: string;
  data: T;
}

export interface ChatMemoryRecallExportChunk {
  content: string;
  embedding: number[] | null;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMemoryRecallExportPayload {
  sourceChat: {
    id: string;
    name: string;
    mode: ChatMode;
    memoryCount: number;
  };
  chunks: ChatMemoryRecallExportChunk[];
}

export interface ChatMemoryRecallImportResult {
  imported: number;
  skipped: number;
  replaced: boolean;
}
