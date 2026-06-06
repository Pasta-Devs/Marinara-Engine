import { boolish, type JsonRecord } from "./runtime-records";

export type IllustratorAvatarReferenceMode = "inherit" | "enabled" | "disabled";

const AVATAR_REFERENCES_OVERRIDE_DISABLED = "disabled";

function avatarReferencesDisabledExplicitly(settings: JsonRecord | null | undefined): boolean {
  return settings?.useAvatarReferencesOverride === AVATAR_REFERENCES_OVERRIDE_DISABLED;
}

export function illustratorAvatarReferenceMode(settings: JsonRecord | null | undefined): IllustratorAvatarReferenceMode {
  if (avatarReferencesDisabledExplicitly(settings)) return "disabled";
  if (boolish(settings?.useAvatarReferences, false)) return "enabled";
  if (settings?.useAvatarReferences !== undefined && settings.useAvatarReferences !== null) {
    // Pre-marker false rows came from the old true-by-default checkbox, so they
    // are the only recoverable signal for a deliberate legacy opt-out.
    return "disabled";
  }
  return "inherit";
}

export function illustratorAvatarReferencesEnabled(
  settings: JsonRecord | null | undefined,
  chatMeta: JsonRecord | null | undefined = null,
): boolean {
  const mode = illustratorAvatarReferenceMode(settings);
  if (mode === "enabled") return true;
  if (mode === "disabled") return false;
  return boolish(chatMeta?.illustrationUseAvatarReferences, false);
}

export function serializeIllustratorAvatarReferenceSettings(
  mode: IllustratorAvatarReferenceMode,
): Record<string, unknown> {
  if (mode === "enabled") {
    return { useAvatarReferences: true };
  }
  if (mode === "disabled") {
    return {
      useAvatarReferences: false,
      useAvatarReferencesOverride: AVATAR_REFERENCES_OVERRIDE_DISABLED,
    };
  }
  return {};
}
