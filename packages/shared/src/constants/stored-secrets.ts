// ──────────────────────────────────────────────
// Stored secrets: values the server keeps encrypted and never sends back
// ──────────────────────────────────────────────

/**
 * What the server sends instead of a saved secret (the same mask as connection API keys). Sending it back
 * unchanged keeps the saved value; an empty string clears it; any other value replaces it.
 */
export const STORED_SECRET_MASK = "••••••••";

/** Prefix of a secret encrypted at rest (shared with custom-tool webhook URLs). */
export const STORED_SECRET_PREFIX = "enc:v1:";

/** Chat settings that hold a credential: the DeepL key and the Discord mirror webhook (its token is in the URL). */
export const CHAT_METADATA_SECRET_KEYS = ["translationDeeplApiKey", "discordWebhookUrl"] as const;
export type ChatMetadataSecretKey = (typeof CHAT_METADATA_SECRET_KEYS)[number];

/** Whether a value stands for the saved secret instead of a new one: the mask, or a value already encrypted. */
export function isStoredSecretPlaceholder(value: unknown): boolean {
  return typeof value === "string" && (value === STORED_SECRET_MASK || value.startsWith(STORED_SECRET_PREFIX));
}

/** Whether a response value says a secret is saved (the UI shows it as saved instead of showing its text). */
export function isStoredSecretMask(value: unknown): boolean {
  return value === STORED_SECRET_MASK;
}
