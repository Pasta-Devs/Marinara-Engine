import {
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  agentLorebookAttachmentsSchema,
  normalizeAdvancedMemorySettings,
  type Chat,
} from "@marinara-engine/shared";
import { getChatCharacterIds } from "./chat-macros";

export type ChatWizardMode = "conversation" | "roleplay";
export interface ChatWizardDefaults {
  connectionId: string | null;
  promptPresetId: string | null;
  personaId: string | null;
  personaCharacterId: string | null;
  characterIds: string[];
  metadata: Record<string, unknown>;
}

// Reuse the profile's generated-state exclusions, but keep identity/setup choices:
// defaults are a wizard snapshot, not a profile or a copy of a running chat.
const excluded = new Set([
  ...CHAT_PRESET_EXCLUDED_METADATA_KEYS.filter(
    (key) => !["activeLorebookIds", "agentLorebookAttachments", "presetChoices", "spriteCharacterIds"].includes(key),
  ),
  "conversationSetupComplete",
  "advancedMemoryState",
]);

export function captureChatWizardDefaults(chat: Chat, overrides: Record<string, unknown> = {}): ChatWizardDefaults {
  const metadata = { ...readChatMetadata(chat), ...overrides };
  if (metadata.advancedMemory) {
    metadata.advancedMemory = {
      ...normalizeAdvancedMemorySettings(metadata.advancedMemory),
      knowledgeStarts: {},
      knowledgeConfirmed: false,
    };
  }
  return {
    connectionId: chat.connectionId ?? null,
    promptPresetId: chat.promptPresetId ?? null,
    personaId: chat.personaId ?? null,
    personaCharacterId: chat.personaCharacterId ?? null,
    characterIds: getChatCharacterIds(chat),
    metadata: Object.fromEntries(Object.entries(metadata).filter(([key]) => !excluded.has(key))),
  };
}

export function readChatMetadata(chat: Chat): Record<string, unknown> {
  try {
    const raw = typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata;
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/** Shared mode defaults cannot carry a binding owned by the source chat. Keep full snapshots for same-chat reset. */
export function reusableChatWizardDefaults(defaults: ChatWizardDefaults): ChatWizardDefaults {
  const metadata = { ...defaults.metadata };
  delete metadata.agentLorebookAttachments;
  return { ...defaults, metadata };
}

export function wizardDefaultsMetadataPatch(current: ChatWizardDefaults, target: ChatWizardDefaults) {
  const patch = { ...Object.fromEntries(Object.keys(current.metadata).map((key) => [key, null])), ...target.metadata };
  if (
    Object.hasOwn(current.metadata, "agentLorebookAttachments") ||
    Object.hasOwn(target.metadata, "agentLorebookAttachments")
  ) {
    const currentAttachments = agentLorebookAttachmentsSchema.safeParse(current.metadata.agentLorebookAttachments);
    const targetAttachments = agentLorebookAttachmentsSchema.safeParse(target.metadata.agentLorebookAttachments);
    // The route merges maps: explicitly disable reset entries, leaving concurrently added agents untouched.
    patch.agentLorebookAttachments = {
      ...Object.fromEntries(
        Object.keys(currentAttachments.success ? currentAttachments.data : {}).map((id) => [
          id,
          { enabled: false, lorebookId: null },
        ]),
      ),
      ...(targetAttachments.success ? targetAttachments.data : {}),
    };
  }
  return patch;
}
