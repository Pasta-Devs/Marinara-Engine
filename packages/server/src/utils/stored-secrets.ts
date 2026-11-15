// ──────────────────────────────────────────────
// Utility: secrets kept in settings (chat metadata, settings profiles, translator defaults, connection headers)
// ──────────────────────────────────────────────
// Stored encrypted with the API-key helpers behind the `enc:v1:` prefix that custom-tool webhooks use. Values saved
// by older versions are plain text: they are read as they are and encrypted the next time they are saved. Responses
// carry STORED_SECRET_MASK instead of a value; a save that sends the mask (or leaves the field out) keeps the saved
// value, an empty string clears it, and anything else replaces it.
import {
  CHAT_METADATA_SECRET_KEYS,
  IMAGE_DEFAULTS_STORAGE_KEY,
  STORED_SECRET_MASK,
  STORED_SECRET_PREFIX,
  VIDEO_DEFAULTS_STORAGE_KEY,
  isStoredSecretPlaceholder,
  type ChatMetadataSecretKey,
} from "@marinara-engine/shared";
import { decryptApiKey, encryptApiKey } from "./crypto.js";

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);

export function isEncryptedStoredSecret(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(STORED_SECRET_PREFIX);
}

/** Encrypt a secret for storage. Empty stays empty and an already encrypted value is kept as it is. */
export function encryptStoredSecret(value: string): string {
  if (!value || value.startsWith(STORED_SECRET_PREFIX)) return value;
  return `${STORED_SECRET_PREFIX}${encryptApiKey(value)}`;
}

/** The usable value of a stored secret: decrypted, or a plain value saved by an older version as it is. */
export function decryptStoredSecret(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (value === STORED_SECRET_MASK) return "";
  return value.startsWith(STORED_SECRET_PREFIX) ? decryptApiKey(value.slice(STORED_SECRET_PREFIX.length)) : value;
}

/** What a response shows for a stored secret: the mask when one is saved, else an empty string. */
export function maskStoredSecret(value: unknown): string {
  return typeof value === "string" && value ? STORED_SECRET_MASK : "";
}

// ── Chat metadata (chats, a settings profile's metadata, translator defaults) ──

/**
 * Encrypt every plain secret in a metadata object before it is written. A mask that reached a write (a response
 * copied back whole) keeps the value in `previous`, the metadata being replaced. Returns the same object.
 */
export function sealChatMetadataSecrets<T extends Row>(metadata: T, previous?: Row | null): T {
  if (!isRecord(metadata)) return metadata;
  const target = metadata as Row;
  for (const key of CHAT_METADATA_SECRET_KEYS) {
    const value = target[key];
    if (typeof value !== "string" || !value || isEncryptedStoredSecret(value)) continue;
    if (value === STORED_SECRET_MASK) {
      const saved = isRecord(previous) ? previous[key] : undefined;
      if (typeof saved === "string" && saved && saved !== STORED_SECRET_MASK) target[key] = encryptStoredSecret(saved);
      else delete target[key];
    } else {
      target[key] = encryptStoredSecret(value);
    }
  }
  return metadata;
}

/** Whether metadata holds a mask in place of a secret (so a write must look up the saved value). */
export function hasChatMetadataSecretMask(metadata: unknown): boolean {
  return isRecord(metadata) && CHAT_METADATA_SECRET_KEYS.some((key) => metadata[key] === STORED_SECRET_MASK);
}

/** A copy of metadata with each saved secret shown as the mask. */
export function maskChatMetadataSecrets<T>(metadata: T): T {
  if (!isRecord(metadata)) return metadata;
  if (!CHAT_METADATA_SECRET_KEYS.some((key) => key in metadata)) return metadata;
  const copy: Row = { ...metadata };
  for (const key of CHAT_METADATA_SECRET_KEYS) {
    if (key in copy) copy[key] = maskStoredSecret(copy[key]);
  }
  return copy as T;
}

/** A chat-like row (metadata as an object or a JSON string) with its secrets masked. */
export function maskChatRowSecrets<T>(row: T): T {
  if (!isRecord(row) || !("metadata" in row)) return row;
  const metadata = row.metadata;
  if (typeof metadata === "string") {
    if (!CHAT_METADATA_SECRET_KEYS.some((key) => metadata.includes(`"${key}"`))) return row;
    try {
      const parsed = JSON.parse(metadata) as unknown;
      return isRecord(parsed) ? ({ ...row, metadata: JSON.stringify(maskChatMetadataSecrets(parsed)) } as T) : row;
    } catch {
      return row;
    }
  }
  return { ...row, metadata: maskChatMetadataSecrets(metadata) } as T;
}

/** The usable value of one secret in chat metadata. */
export function readChatMetadataSecret(metadata: unknown, key: ChatMetadataSecretKey): string {
  return isRecord(metadata) ? decryptStoredSecret(metadata[key]).trim() : "";
}

/**
 * Resolve the secrets in metadata sent by a client. A mask (or an encrypted value, which a client never holds)
 * takes the saved value from the first source that has one, or is dropped when `sources` is empty or none has one,
 * so a partial patch keeps what is stored. An empty string clears; any other value is new. Mutates `incoming`.
 */
export function resolveChatMetadataSecretPlaceholders(incoming: Row, ...sources: Array<Row | null | undefined>): Row {
  if (!isRecord(incoming)) return incoming;
  for (const key of CHAT_METADATA_SECRET_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const value = incoming[key];
    if (value === null || value === undefined) {
      incoming[key] = "";
      continue;
    }
    if (!isStoredSecretPlaceholder(value)) continue;
    const saved = sources.map((source) => (isRecord(source) ? source[key] : undefined)).find((v) => !!v);
    if (typeof saved === "string" && saved) incoming[key] = saved;
    else delete incoming[key];
  }
  return incoming;
}

// ── Connection custom headers (in `defaultParameters`, and in its image and video defaults) ──

function mapHeaders(headers: unknown, map: (value: string, name: string) => string | undefined): unknown {
  if (!isRecord(headers)) return headers;
  const out: Row = {};
  for (const [name, value] of Object.entries(headers)) {
    // A header object comes from request JSON: never copy a key that would reach the prototype.
    if (name === "__proto__" || name === "constructor" || name === "prototype") continue;
    if (typeof value !== "string") {
      out[name] = value;
      continue;
    }
    const next = map(value, name);
    if (next !== undefined) out[name] = next;
  }
  return out;
}

/** Usable header values: decrypted, plain values as they are, and masks (never a real value) left out. */
export function decryptCustomHeaders<T extends Record<string, string> | null | undefined>(headers: T): T {
  if (!isRecord(headers)) return headers;
  return mapHeaders(headers, (value) =>
    value === STORED_SECRET_MASK ? undefined : isEncryptedStoredSecret(value) ? decryptStoredSecret(value) : value,
  ) as T;
}

function parseDefaultParameters(raw: unknown): Row | null {
  if (isRecord(raw)) return raw;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A copy of `defaultParameters` (object or JSON string, returned in the same form) with each header value mapped. */
function mapConnectionHeaders<T>(raw: T, map: (value: string, name: string, holder: number) => string | undefined): T {
  const parsed = parseDefaultParameters(raw);
  if (!parsed) return raw;
  const root: Row = { ...parsed };
  let changed = false;
  const holders: Array<[Row, string | null]> = [
    [root, null],
    [root, IMAGE_DEFAULTS_STORAGE_KEY],
    [root, VIDEO_DEFAULTS_STORAGE_KEY],
  ];
  holders.forEach(([, key], index) => {
    const holder = key ? root[key] : root;
    if (!isRecord(holder) || !isRecord(holder.customHeaders)) return;
    const copy: Row = key ? { ...holder } : holder;
    copy.customHeaders = mapHeaders(holder.customHeaders, (value, name) => map(value, name, index));
    if (key) root[key] = copy;
    changed = true;
  });
  if (!changed) return raw;
  return (typeof raw === "string" ? JSON.stringify(root) : root) as T;
}

/** `defaultParameters` with every custom header value encrypted, ready to store. */
export function sealConnectionHeaderSecrets<T>(raw: T): T {
  return mapConnectionHeaders(raw, (value) =>
    value === STORED_SECRET_MASK ? undefined : value ? encryptStoredSecret(value) : value,
  );
}

/** `defaultParameters` with every custom header value shown as the mask, for responses. */
export function maskConnectionHeaderSecrets<T>(raw: T): T {
  return mapConnectionHeaders(raw, (value) => maskStoredSecret(value));
}

/** `defaultParameters` with usable (decrypted) header values, for code that sends them. */
export function decryptConnectionHeaderSecrets<T>(raw: T): T {
  return mapConnectionHeaders(raw, (value) =>
    value === STORED_SECRET_MASK ? undefined : isEncryptedStoredSecret(value) ? decryptStoredSecret(value) : value,
  );
}

/**
 * Resolve the custom headers a client sent back against the stored `defaultParameters`: a masked (or encrypted)
 * value keeps the stored value of the header with the same name in the same place, or is dropped when there is
 * none. Returns a new object.
 */
export function resolveConnectionHeaderPlaceholders(incoming: Row, stored: unknown): Row {
  const saved = parseDefaultParameters(stored);
  const savedHolders = saved
    ? [saved, saved[IMAGE_DEFAULTS_STORAGE_KEY], saved[VIDEO_DEFAULTS_STORAGE_KEY]]
    : [null, null, null];
  return mapConnectionHeaders(incoming, (value, name, holder) => {
    if (!isStoredSecretPlaceholder(value)) return value;
    const source = savedHolders[holder];
    const headers = isRecord(source) && isRecord(source.customHeaders) ? source.customHeaders : null;
    const match = headers
      ? Object.entries(headers).find(([savedName]) => savedName.toLowerCase() === name.toLowerCase())
      : undefined;
    return typeof match?.[1] === "string" && match[1] ? match[1] : undefined;
  });
}

// ── Anything else that shows stored rows (Professor Mari's database reads) ──

const SECRET_KEY_SET = new Set<string>(CHAT_METADATA_SECRET_KEYS);
const SECRET_KEY_PATTERN = new RegExp(`"(?:${[...CHAT_METADATA_SECRET_KEYS, "customHeaders"].join("|")})"`);

/**
 * A deep copy with every chat secret and connection header value masked, including inside JSON text columns.
 * Values that hold no secret are returned as they are.
 */
export function redactStoredSecretsDeep<T>(value: T, depth = 0): T {
  if (depth > 40) return value;
  if (typeof value === "string") {
    const text = value.trimStart();
    if ((text.startsWith("{") || text.startsWith("[")) && SECRET_KEY_PATTERN.test(value)) {
      try {
        const parsed = JSON.parse(value) as unknown;
        const redacted = redactStoredSecretsDeep(parsed, depth + 1);
        return (redacted === parsed ? value : JSON.stringify(redacted)) as T;
      } catch {
        return value;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = redactStoredSecretsDeep(item, depth + 1);
      if (next !== item) changed = true;
      return next;
    });
    return (changed ? out : value) as T;
  }
  if (!isRecord(value)) return value;
  let changed = false;
  const out: Row = {};
  for (const [key, item] of Object.entries(value)) {
    let next: unknown;
    if (SECRET_KEY_SET.has(key) && typeof item === "string") next = maskStoredSecret(item);
    else if (key === "customHeaders" && isRecord(item)) next = mapHeaders(item, (v) => maskStoredSecret(v));
    else next = redactStoredSecretsDeep(item, depth + 1);
    if (next !== item) changed = true;
    out[key] = next;
  }
  return (changed ? out : value) as T;
}
