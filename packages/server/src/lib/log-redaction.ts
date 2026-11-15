// Keeps API keys and sign-in tokens out of the server log. Provider errors, debug request dumps and third-party
// messages can echo a key back; the log is a plain file people paste into bug reports.

/** Credential fields and headers, redacted at the record root, one level down and under a nested `headers` object. */
const CREDENTIAL_FIELDS = [
  "authorization",
  "Authorization",
  "apiKey",
  "api_key",
  "password",
  "access_token",
  "refresh_token",
  "id_token",
  "x-api-key",
  "x-goog-api-key",
  "xi-api-key",
  "x-admin-secret",
];

/** pino redact paths built from CREDENTIAL_FIELDS (bracket form, so hyphenated names stay valid). */
export const LOG_REDACT_PATHS = CREDENTIAL_FIELDS.flatMap((name) => {
  const key = `[${JSON.stringify(name)}]`;
  return [key, `*${key}`, `*.headers${key}`];
});

const SECRET_TEXT_PATTERNS: Array<[RegExp, string]> = [
  // Bearer / Basic credentials in a header echoed into text.
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gu, "$1 [redacted]"],
  // Common provider key shapes: OpenAI/Anthropic/OpenRouter (sk-...), Google (AIza...), xAI, Groq, Hugging Face.
  [/\bsk-[A-Za-z0-9_-]{16,}/gu, "sk-[redacted]"],
  // ElevenLabs (sk_...).
  [/\bsk_[A-Za-z0-9]{24,}/gu, "sk_[redacted]"],
  [/\bAIza[0-9A-Za-z_-]{30,}/gu, "AIza[redacted]"],
  [/\b(xai|gsk|hf|pplx|nvapi)[-_][A-Za-z0-9_-]{16,}/gu, "$1-[redacted]"],
  // key=... / api_key=... / token=... in URLs or messages.
  [/([?&;\s"']((?:api[_-]?)?key|token|access_token|secret)=)[^&\s"';]{8,}/giu, "$1[redacted]"],
  // Discord webhook tokens.
  [/(discord(?:app)?\.com\/api\/webhooks\/\d+\/)[A-Za-z0-9_-]{20,}/giu, "$1[redacted]"],
];

/** Replaces anything that looks like a key or token in free text. */
export function scrubSecretText(text: string): string {
  if (text.length < 12) return text;
  let out = text;
  for (const [pattern, replacement] of SECRET_TEXT_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}
