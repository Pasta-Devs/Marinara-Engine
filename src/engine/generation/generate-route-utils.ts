import { generationParametersSchema } from "../contracts/schemas/prompt.schema";
import type { GenerationParameters } from "../contracts/types/prompt";
import { getAttachmentFilename, type PromptAttachment } from "../shared/attachments/image-attachments";
import { parseRecord, readNonNegativeInteger, readString } from "./runtime-records";

export type StoredGenerationParameters = Partial<GenerationParameters>;
export type { PromptAttachment };
export { getAttachmentFilename };

const TEXT_ATTACHMENT_CHAR_LIMIT = 60_000;
const IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT = 6 * 1024 * 1024;
const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "csv",
  "json",
  "jsonl",
  "log",
  "markdown",
  "md",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeCustomParameters(
  base: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(base ?? {}) };
  if (!next) return merged;
  for (const [key, value] of Object.entries(next)) {
    if (value === undefined) continue;
    const current = merged[key];
    if (isPlainRecord(current) && isPlainRecord(value)) {
      merged[key] = mergeCustomParameters(current, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function shouldPreferLatestVisibleGameState(input: {
  attachments?: unknown[] | null;
  impersonate?: boolean;
  regenerateMessageId?: string | null;
  userMessage?: string | null;
}): boolean {
  if (input.impersonate === true || !!input.regenerateMessageId) return true;
  return !input.userMessage?.trim() && !input.attachments?.length;
}

export function resolveVisibleGameStateAnchor(
  messages: Array<{ role?: unknown; id?: unknown; activeSwipeIndex?: unknown }>,
): { messageId: string; swipeIndex: number } | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]!;
    if (message.role !== "assistant" || typeof message.id !== "string" || !message.id) continue;
    const swipeIndex =
      typeof message.activeSwipeIndex === "number" &&
      Number.isInteger(message.activeSwipeIndex) &&
      message.activeSwipeIndex >= 0
        ? message.activeSwipeIndex
        : 0;
    return { messageId: message.id, swipeIndex };
  }
  return null;
}

export function resolveRegenerationGameStateAnchor(
  messages: Array<{ role?: unknown; id?: unknown; activeSwipeIndex?: unknown }>,
  regenerateMessageId: string | null | undefined,
): { messageId: string; swipeIndex: number } | null {
  if (!regenerateMessageId) return resolveVisibleGameStateAnchor(messages);
  const targetIndex = messages.findIndex((message) => message.id === regenerateMessageId);
  if (targetIndex < 0) return resolveVisibleGameStateAnchor(messages);
  return resolveVisibleGameStateAnchor(messages.slice(0, targetIndex));
}

export function resolveRegenerationGameStateFallbackMessageIds(
  messages: Array<{ role?: unknown; id?: unknown; activeSwipeIndex?: unknown; swipeIndex?: unknown }>,
  regenerateMessageId: string | null | undefined,
): Array<{ messageId: string; swipeIndex: number }> | null {
  if (!regenerateMessageId) return null;
  const targetIndex = messages.findIndex((message) => message.id === regenerateMessageId);
  const boundedMessages = targetIndex >= 0 ? messages.slice(0, targetIndex) : messages;
  const targets = new Map<string, { messageId: string; swipeIndex: number }>();
  const addTarget = (target: { messageId: string; swipeIndex: number }) =>
    targets.set(`${target.messageId}\u0000${target.swipeIndex}`, target);
  addTarget({ messageId: "", swipeIndex: 0 });
  for (const message of boundedMessages) {
    if (message.role === "assistant" && typeof message.id === "string" && message.id.trim()) {
      addTarget({
        messageId: message.id.trim(),
        swipeIndex: readNonNegativeInteger(message.activeSwipeIndex ?? message.swipeIndex, 0),
      });
    }
  }
  return Array.from(targets.values());
}

export function extractImageAttachmentDataUrls(attachments: PromptAttachment[] | undefined): string[] {
  return (attachments ?? [])
    .filter((attachment) => typeof attachment.type === "string" && attachment.type.startsWith("image/"))
    .map((attachment) => attachment.data)
    .filter((data): data is string => typeof data === "string" && data.length > 0)
    .filter((data) => estimateDataUrlBytes(data) <= IMAGE_ATTACHMENT_PROVIDER_BYTE_LIMIT);
}

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return utf8ByteLength(dataUrl);

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  if (!meta.includes(";base64")) {
    try {
      return utf8ByteLength(decodeURIComponent(payload));
    } catch {
      return utf8ByteLength(payload);
    }
  }

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function isReadableTextAttachment(attachment: PromptAttachment): boolean {
  const type = typeof attachment.type === "string" ? attachment.type.toLowerCase() : "";
  if (type.startsWith("text/")) return true;
  if (
    type === "application/json" ||
    type === "application/ld+json" ||
    type === "application/xml" ||
    type === "application/x-yaml" ||
    type === "application/yaml"
  ) {
    return true;
  }

  const name = getAttachmentFilename(attachment).toLowerCase();
  const extension = name.includes(".") ? name.split(".").pop() : "";
  return !!extension && TEXT_ATTACHMENT_EXTENSIONS.has(extension);
}

function decodeDataUrlText(dataUrl: string): string | null {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex < 0) return null;

  const meta = dataUrl.slice(0, commaIndex).toLowerCase();
  const payload = dataUrl.slice(commaIndex + 1);
  try {
    if (meta.includes(";base64")) {
      return new TextDecoder("utf-8", { fatal: false }).decode(base64ToBytes(payload));
    }
    return decodeURIComponent(payload);
  } catch {
    return null;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReadableAttachmentBlocks(attachments: PromptAttachment[] | undefined): string[] {
  return (attachments ?? []).flatMap((attachment) => {
    if (!isReadableTextAttachment(attachment) || typeof attachment.data !== "string") return [];
    const decoded = decodeDataUrlText(attachment.data);
    if (!decoded?.trim()) return [];

    const filename = getAttachmentFilename(attachment);
    const type = typeof attachment.type === "string" && attachment.type.trim() ? attachment.type.trim() : "text/plain";
    const trimmed =
      decoded.length > TEXT_ATTACHMENT_CHAR_LIMIT
        ? `${decoded.slice(0, TEXT_ATTACHMENT_CHAR_LIMIT)}\n\n[Attachment truncated after ${TEXT_ATTACHMENT_CHAR_LIMIT} characters.]`
        : decoded;

    return [
      [
        `<attached_file name="${escapeXmlAttribute(filename)}" type="${escapeXmlAttribute(type)}">`,
        trimmed,
        `</attached_file>`,
      ].join("\n"),
    ];
  });
}

export function appendReadableAttachmentsToContent(
  content: string,
  attachments: PromptAttachment[] | undefined,
): string {
  const blocks = buildReadableAttachmentBlocks(attachments);
  if (blocks.length === 0) return content;
  return `${content}${content.trim() ? "\n\n" : ""}${blocks.join("\n\n")}`;
}

/** Parse connection/chat stored generation parameters without injecting schema defaults. */
function parseStoredGenerationParameters(raw: unknown): StoredGenerationParameters | null {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const result = generationParametersSchema.partial().safeParse(parsed);
  if (result.success) return result.data;

  // Older installs or extension callers may leave one malformed field in an
  // otherwise useful parameter blob. Salvage valid scalar fields instead of
  // dropping the whole advanced-parameter fallback.
  const source = parsed as Record<string, unknown>;
  const out: StoredGenerationParameters = {};
  for (const key of [
    "temperature",
    "topP",
    "topK",
    "minP",
    "maxTokens",
    "maxContext",
    "frequencyPenalty",
    "presencePenalty",
    "seed",
  ] as const) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  if (
    source.reasoningEffort === null ||
    ["none", "minimal", "low", "medium", "high", "xhigh", "maximum"].includes(String(source.reasoningEffort))
  ) {
    out.reasoningEffort = source.reasoningEffort as StoredGenerationParameters["reasoningEffort"];
  }
  if (source.verbosity === null || ["low", "medium", "high"].includes(String(source.verbosity))) {
    out.verbosity = source.verbosity as StoredGenerationParameters["verbosity"];
  }
  if (
    source.serviceTier === null ||
    ["auto", "default", "flex", "scale", "priority", "standard_only"].includes(String(source.serviceTier))
  ) {
    out.serviceTier = source.serviceTier as StoredGenerationParameters["serviceTier"];
  }
  if (typeof source.assistantPrefill === "string") out.assistantPrefill = source.assistantPrefill;
  if (isPlainRecord(source.customParameters)) {
    out.customParameters = source.customParameters;
  }
  if (isPlainRecord(source.custom_params)) {
    out.custom_params = source.custom_params;
  }
  for (const key of [
    "squashSystemMessages",
    "showThoughts",
    "useMaxContext",
    "strictRoleFormatting",
    "singleUserMessage",
  ] as const) {
    const value = source[key];
    if (typeof value === "boolean") out[key] = value;
  }
  if (Array.isArray(source.stopSequences) && source.stopSequences.every((item) => typeof item === "string")) {
    out.stopSequences = source.stopSequences;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function mergeStoredGenerationParameters(...sources: Array<unknown>): StoredGenerationParameters | null {
  const merged: StoredGenerationParameters = {};

  for (const source of sources) {
    const parsed = parseStoredGenerationParameters(source);
    if (!parsed) continue;
    const { customParameters, custom_params: customParams, ...rest } = parsed;
    Object.assign(merged, rest);
    if (customParams) {
      merged.custom_params = mergeCustomParameters(merged.custom_params, customParams);
    }
    if (customParameters) {
      merged.customParameters = mergeCustomParameters(merged.customParameters, customParameters);
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

export function generationParameterSources(
  connection: Record<string, unknown> | null | undefined,
  input: Record<string, unknown> | null | undefined,
  chat?: Record<string, unknown> | null,
  promptPresetParameters?: unknown,
): unknown[] {
  const meta = parseRecord(chat?.metadata);
  const mode = readString(chat?.mode || chat?.chatMode);
  const setupConfig = parseRecord(meta.gameSetupConfig);
  return [
    promptPresetParameters,
    mode === "game" ? setupConfig.generationParameters : null,
    mode === "game" ? meta.gameGenerationParameters : null,
    connection?.defaultParameters,
    meta.chatParameters,
    input?.parameters,
  ];
}

function trackerCharacterIdKey(character: Record<string, unknown>) {
  return typeof character.characterId === "string" ? character.characterId.trim().toLowerCase() : "";
}

function trackerCharacterNameKey(character: Record<string, unknown>) {
  return typeof character.name === "string" ? character.name.trim().toLowerCase() : "";
}

function trackerCharacterKey(character: Record<string, unknown>) {
  return trackerCharacterIdKey(character) || trackerCharacterNameKey(character) || null;
}

function isManualTrackerCharacterId(value: unknown): boolean {
  return typeof value === "string" && value.trim().startsWith("manual-");
}

function canUseManualTrackerNameFallback(character: Record<string, unknown>) {
  const id = trackerCharacterIdKey(character);
  if (!id || isManualTrackerCharacterId(id)) return true;
  const name = trackerCharacterNameKey(character);
  return !!name && id === name;
}

function readTrackerAvatarPath(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function preserveTrackerCharacterUiFields(
  nextCharacters: Array<Record<string, unknown>>,
  previousCharacters: Array<Record<string, unknown>>,
): void {
  const previousByKey = new Map<string, Record<string, unknown>>();
  const previousManualByName = new Map<string, Record<string, unknown>>();
  const previousNameCounts = new Map<string, number>();
  for (const character of previousCharacters) {
    const key = trackerCharacterKey(character);
    if (key) previousByKey.set(key, character);
    const name = trackerCharacterNameKey(character);
    if (name) previousNameCounts.set(name, (previousNameCounts.get(name) ?? 0) + 1);
    if (name && isManualTrackerCharacterId(character.characterId)) previousManualByName.set(name, character);
  }

  for (const character of nextCharacters) {
    const key = trackerCharacterKey(character);
    const name = trackerCharacterNameKey(character);
    const previous =
      (key ? previousByKey.get(key) : null) ??
      (name && previousNameCounts.get(name) === 1 && canUseManualTrackerNameFallback(character)
        ? previousManualByName.get(name)
        : null);
    const previousPortraitFocusX = previous?.portraitFocusX;
    const previousPortraitFocusY = previous?.portraitFocusY;
    const previousPortraitZoom = previous?.portraitZoom;
    const previousAvatarPath = readTrackerAvatarPath(previous?.avatarPath);
    if (!readTrackerAvatarPath(character.avatarPath) && previousAvatarPath) {
      character.avatarPath = previousAvatarPath;
    }
    if (
      typeof character.portraitFocusX !== "number" &&
      typeof previousPortraitFocusX === "number" &&
      Number.isFinite(previousPortraitFocusX)
    ) {
      character.portraitFocusX = previousPortraitFocusX;
    }
    if (
      typeof character.portraitFocusY !== "number" &&
      typeof previousPortraitFocusY === "number" &&
      Number.isFinite(previousPortraitFocusY)
    ) {
      character.portraitFocusY = previousPortraitFocusY;
    }
    if (
      (typeof character.portraitZoom !== "number" || !Number.isFinite(character.portraitZoom)) &&
      typeof previousPortraitZoom === "number" &&
      Number.isFinite(previousPortraitZoom)
    ) {
      character.portraitZoom = previousPortraitZoom;
    }
  }
}
