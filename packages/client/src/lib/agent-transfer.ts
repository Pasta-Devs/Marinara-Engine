const TRANSFER_UNSAFE_AGENT_SETTING_KEYS = new Set([
  "spotifyAccessToken",
  "spotifyRefreshToken",
  "spotifyExpiresAt",
  "spotifyScope",
  "youtubeApiKey",
  "sourceLorebookIds",
  "sourceFileIds",
  "writableLorebookId",
  "writableLorebookIds",
  "targetLorebookId",
  "imageConnectionId",
  "lorebookWriteEnabled",
]);

const TRANSFER_UNSAFE_ENABLED_TOOLS = new Set(["save_lorebook_entry"]);

export function sanitizeAgentSettingsForTransfer(settings: Record<string, unknown>) {
  const sanitized = { ...settings };
  for (const key of TRANSFER_UNSAFE_AGENT_SETTING_KEYS) {
    delete sanitized[key];
  }

  if (Array.isArray(sanitized.enabledTools)) {
    sanitized.enabledTools = sanitized.enabledTools.filter(
      (tool): tool is string => typeof tool === "string" && !TRANSFER_UNSAFE_ENABLED_TOOLS.has(tool),
    );
  }

  return sanitized;
}
