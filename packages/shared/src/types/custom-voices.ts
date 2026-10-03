// Connection-bound metadata only. Audio and consent remain at the backend.
export type CustomVoiceProfile = "vllm-omni" | null;
export interface ManagedCustomVoice {
  id: string;
  displayName: string;
  status: "pending" | "ready" | "uncertain" | "unavailable" | "deleted";
  createdAt: string;
}
export interface CustomVoiceManagement {
  connectionId: string;
  snapshot: string;
  destination: string;
  profile: CustomVoiceProfile;
  capability: "unknown" | "unsupported" | "explicit";
  voices: ManagedCustomVoice[];
  providerVoices: string[];
  assignments: Record<string, string[]>;
  error?: string;
}
