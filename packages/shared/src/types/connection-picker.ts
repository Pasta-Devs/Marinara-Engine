/** Saved model kinds the Engine can select. Audio means an audio-generation model;
 * embeddings, voice and transcription sources have separate device/settings flows. */
export type ConnectionPickerKind = "chat" | "image" | "video" | "audio" | "decision" | "all";

export interface ConnectionPickerOptions {
  /** Saved Model row id, not an account id or a provider's catalog model id. */
  value?: string | null;
  kind?: ConnectionPickerKind;
  /** Package-owned translated title and label. The Engine supplies defaults. */
  title?: string;
  defaultLabel?: string;
  /** Offer null as the caller's default/inherited choice. Defaults to true. */
  includeDefault?: boolean;
  /** Chat only, explicitly opted in; the caller must support the local sidecar id. */
  includeLocalSidecar?: boolean;
}

export type ConnectionPickerResult = { status: "selected"; value: string | null } | { status: "cancelled" };

/** UI-only API injected as capabilityProps.ui. It never saves configuration,
 * changes the active chat, exposes keys, or changes a global default. */
export interface CapabilityClientUi {
  pickConnection(options?: ConnectionPickerOptions): Promise<ConnectionPickerResult>;
}
