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

// Inline media (images, PDFs, audio sent as base64) can run to several MB per value, and debug mode prints every
// prompt that carries one, so a single Mari round could bury the console. The log copy keeps what identifies the
// file: its type, its size and the two ends of the encoded text. LOG_INLINE_MEDIA=full prints it whole again.

/** Encoded text shorter than this stays as it is: a short value costs nothing and may be the point of the line. */
const INLINE_MEDIA_MIN_LENGTH = 64;
/** Characters kept from each end of the encoded text, enough to tell two files apart. */
const INLINE_MEDIA_EDGE_LENGTH = 16;
// The media type may be left out (`data:;base64,...`); RFC 2397 then means text/plain.
// MIME-style base64 is wrapped at 64 or 76 columns. A line break, raw or JSON-escaped as `\n`, continues the payload
// only after a run of 60 to 76 characters (a wrapped line, not the end of a compact payload), and only into a run
// that ends its own line (or the text, or a JSON string). A word after the payload, on its line or the next, stays
// outside the match.
const DATA_URL_PATTERN =
  /data:([\w.+-]+\/[\w.+-]+)?((?:;[\w.+-]+=[^;,"\s]*)*);base64,([A-Za-z0-9+/_-]+(?:(?<=(?:,|\n|\\n)[A-Za-z0-9+/_-]{60,76})(?:\r?\n|(?:\\r)?\\n)[A-Za-z0-9+/_-]+(?==*(?:\r?\n|\\r|\\n|$|["'\],;)}])))*=*)/gu;
const BASE64_TEXT = /^[A-Za-z0-9+/_-]+=*$/u;
const LINE_BREAKS = /\r|\n|\\r|\\n/gu;
const WHITESPACE = /\s+/gu;
const MEDIA_TYPE_FIELDS = ["media_type", "mime_type", "mimeType"] as const;

function mediaTypeOf(record: Record<string, unknown>) {
  for (const field of MEDIA_TYPE_FIELDS) {
    const value = record[field];
    if (typeof value === "string") return value;
  }
  return undefined;
}

function formatEncodedSize(encodedLength: number) {
  const bytes = Math.floor((encodedLength * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The marker that stands in for one base64 payload, e.g. `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`. */
export function inlineMediaMarker(mediaType: string, base64: string) {
  const head = base64.slice(0, INLINE_MEDIA_EDGE_LENGTH);
  const tail = base64.slice(-INLINE_MEDIA_EDGE_LENGTH);
  // ASCII "...", not "…": a Windows console that does not read UTF-8 prints "…" as "ÔÇª".
  return `[${mediaType} base64, ~${formatEncodedSize(base64.length)}: ${head}...${tail}]`;
}

/** Whether the log keeps inline media whole (`LOG_INLINE_MEDIA=full`). Read per line, so a .env reload applies. */
// Read from process.env directly: config/runtime-config.ts leads back to the logger, which imports this file.
export function isFullInlineMediaLogging() {
  return process.env.LOG_INLINE_MEDIA?.trim().toLowerCase() === "full";
}

/** Replaces each `data:<type>;base64,<payload>` in free text with its marker. */
export function shortenInlineMediaText(text: string): string {
  if (!text.includes(";base64,") || isFullInlineMediaLogging()) return text;
  return text.replace(DATA_URL_PATTERN, (match, mediaType: string | undefined, _params: string, payload: string) => {
    const base64 = payload.replace(LINE_BREAKS, "");
    return base64.length < INLINE_MEDIA_MIN_LENGTH ? match : inlineMediaMarker(mediaType || "text/plain", base64);
  });
}

/**
 * Text and its attached pictures (`ChatMessage.images`) for a prompt printed as text, each picture as its marker:
 * a log that prints only the text would hide that pictures went out at all.
 */
export function messageTextWithImagesForLog(content: string, images?: readonly string[]): string {
  if (!images?.length) return content;
  const lines = images.map((image, index) => `[attached picture ${index + 1}: ${shortenInlineMediaText(image)}]`);
  return [content, ...lines].join("\n");
}

function shortenInlineMediaValue(value: unknown): unknown {
  if (typeof value === "string") return shortenInlineMediaText(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  // Anthropic (`source: { media_type, data }`) and Google (`inline_data: { mime_type, data }`) carry the payload bare.
  const record = value as Record<string, unknown>;
  const data = record.data;
  if (typeof data !== "string" || data.length < INLINE_MEDIA_MIN_LENGTH) return value;
  const mediaType = mediaTypeOf(record);
  if (!mediaType) return value;
  // Wrapped base64 is tested and sized without its line breaks.
  const base64 = data.replace(WHITESPACE, "");
  if (!BASE64_TEXT.test(base64)) return value;
  return { ...record, data: inlineMediaMarker(mediaType, base64) };
}

type JsonReplacer = (this: unknown, key: string, value: unknown) => unknown;

/**
 * A JSON.stringify replacer that shortens inline media, after the caller's own replacer if there is one. It returns
 * new values and never edits the one being printed, so the payload that is sent stays whole.
 */
export function inlineMediaLogReplacer(replacer?: JsonReplacer): JsonReplacer | undefined {
  if (isFullInlineMediaLogging()) return replacer;
  return function (this: unknown, key: string, value: unknown) {
    return shortenInlineMediaValue(replacer ? replacer.call(this, key, value) : value);
  };
}
