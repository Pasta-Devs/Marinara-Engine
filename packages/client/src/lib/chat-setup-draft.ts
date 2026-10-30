import {
  CHAT_PRESET_EXCLUDED_METADATA_KEYS,
  CHAT_PRESET_EXCLUDED_PACKAGE_METADATA_KEYS,
  TRANSLATOR_SETTINGS_KEYS,
  normalizeTranslatorSettings,
  type Chat,
  type ChatPreset,
} from "@marinara-engine/shared";

type SetupField = "connectionId" | "promptPresetId" | "personaId" | "personaCharacterId" | "characterIds";

/** Advance only fields written by the known automatic task, never unrelated values in its response. */
export function advanceChatSetupDraft<T extends Pick<Chat, "metadata">>(
  initial: T,
  response: Chat,
  fields: readonly SetupField[],
  metadataKeys: readonly string[] = [],
): T {
  const allowed = new Set(metadataKeys.filter((key) => key !== "metadataWriteOrdinals"));
  const metadata = {
    ...initial.metadata,
    ...Object.fromEntries([...allowed].map((key) => [key, response.metadata[key]])),
  };
  if (allowed.size && response.metadata.metadataWriteOrdinals) {
    const before = initial.metadata.metadataWriteOrdinals ?? {};
    const after = response.metadata.metadataWriteOrdinals;
    metadata.metadataWriteOrdinals = Object.fromEntries([
      ...Object.entries(before).filter(([key]) => !allowed.has(key)),
      ...Object.entries(after).filter(([key]) => allowed.has(key)),
    ]);
  }
  return { ...initial, ...Object.fromEntries(fields.map((key) => [key, response[key]])), metadata };
}

/** The starred profile owns settings only; never adopt preserved chat history or unrelated response fields. */
export function advanceStarredProfileDraft(
  initial: Chat,
  response: Chat,
  profile: ChatPreset,
  connectionId?: string | null,
): Chat {
  const sceneSettings = new Set(["sceneVideoConnectionId", "sceneVideoFirstFrame"]);
  const excluded = new Set([...CHAT_PRESET_EXCLUDED_METADATA_KEYS, ...CHAT_PRESET_EXCLUDED_PACKAGE_METADATA_KEYS]);
  const chatOwned = (key: string) =>
    excluded.has(key) || (key.startsWith("scene") && !sceneSettings.has(key)) || key.startsWith("multiplayer");
  const settings = profile.settings.metadata ?? {};
  const translatorKeys = new Set<string>(TRANSLATOR_SETTINGS_KEYS);
  const metadata: Record<string, unknown> = {
    // These are the profile writer's fixed defaults, including the install's translator defaults.
    ...normalizeTranslatorSettings(response.metadata),
    summary: null,
    tags: [],
    enableAgents: true,
    activeToolIds: [],
    chatSettingsHintDismissed: false,
    ...Object.fromEntries(Object.entries(settings).filter(([key]) => !chatOwned(key) && !translatorKeys.has(key))),
    ...normalizeTranslatorSettings(settings),
    ...Object.fromEntries(Object.entries(initial.metadata).filter(([key]) => chatOwned(key))),
    appliedChatPresetId: profile.id,
  };
  // Older profiles leave these chat-owned selections alone; absent selections gain only known empty defaults.
  for (const [key, fallback] of Object.entries({
    activeAgentIds: [],
    agentOverrides: {},
    agentPromptTemplateIds: {},
    customAgentImageSettings: {},
  })) {
    if (!(key in settings)) metadata[key] = initial.metadata[key] ?? fallback;
  }
  for (const key of ["windowLayout", "background", ...sceneSettings]) {
    if (!(key in settings) && key in initial.metadata) metadata[key] = initial.metadata[key];
  }
  const memoryKeys = new Set(["knowledgeStarts", "knowledgeConfirmed", "narratorCharacterId"]);
  const ownMemory = Object.fromEntries(
    Object.entries(initial.metadata.advancedMemory ?? {}).filter(([key]) => memoryKeys.has(key)),
  );
  if (Object.keys(ownMemory).length) {
    metadata.advancedMemory = { ...settings.advancedMemory, ...ownMemory };
  }
  // Starting picks the server just copied in (persona, lorebooks).
  if (profile.settings.lorebookIds?.length) metadata.activeLorebookIds = response.metadata.activeLorebookIds;
  return {
    ...initial,
    connectionId: connectionId !== undefined ? connectionId : (profile.settings.connectionId ?? null),
    promptPresetId: profile.settings.promptPresetId ?? null,
    ...(profile.settings.personaId ? { personaId: response.personaId } : {}),
    metadata: metadata as Chat["metadata"],
  };
}
