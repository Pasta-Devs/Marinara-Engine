// Connection-bound metadata only. Audio and consent remain at the backend.
export type CustomVoiceProfile = "vllm-omni" | "openai-compatible" | null;
export interface ManagedCustomVoice {
  id: string;
  /** Intended registration name, retained when the provider assigns a different ID. */
  providerName?: string;
  /** Actual generic provider identity confirmed by registration or unambiguous recovery. */
  identityConfirmed?: boolean;
  displayName: string;
  status: "pending" | "ready" | "uncertain" | "unavailable" | "deleted";
  createdAt: string;
}
export interface CustomVoiceManagement {
  connectionId: string;
  /** Mutation confirmation token bound to the connection and saved profile revision. */
  snapshot: string;
  destination: string;
  profile: CustomVoiceProfile;
  capability: "unknown" | "unsupported" | "explicit";
  voices: ManagedCustomVoice[];
  providerVoices: string[];
  assignments: Record<string, string[]>;
  error?: string;
}
