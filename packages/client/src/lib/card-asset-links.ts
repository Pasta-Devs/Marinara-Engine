import { useChatStore } from "../stores/chat.store";

export const CARD_ASSET_INSERT_EVENT = "marinara:insert-card-asset";

export interface CardAssetInsertDetail {
  markdown: string;
  chatId?: string;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodeSegment(segment: string): string {
  return encodeURIComponent(decodeSegment(segment));
}

function encodePath(segments: string[]): string {
  return segments.filter(Boolean).map(encodeSegment).join("/");
}

function activeChatId(): string | null {
  return useChatStore.getState().activeChatId ?? null;
}

export function normalizeCardAssetImageSyntax(text: string): string {
  let result = "";
  let outputCursor = 0;
  let candidateStart = -1;

  for (let index = 0; index < text.length; index++) {
    const character = text[index]!;
    if (character === "\n") {
      candidateStart = -1;
      continue;
    }
    if (character === "(" && candidateStart < 0) {
      candidateStart = index;
      continue;
    }
    if (character !== ")" || candidateStart < 0) continue;

    if (!text.startsWith("[card://", index + 1)) {
      candidateStart = -1;
      continue;
    }
    const urlStart = index + 2;
    let urlEnd = urlStart;
    while (urlEnd < text.length && text[urlEnd] !== "]" && !/\s/u.test(text[urlEnd]!)) urlEnd++;
    if (urlEnd <= urlStart + "card://".length || text[urlEnd] !== "]") {
      candidateStart = -1;
      continue;
    }

    const safeAlt = text
      .slice(candidateStart + 1, index)
      .replace(/[\]\r\n]/g, " ")
      .trim();
    result += `${text.slice(outputCursor, candidateStart)}![${safeAlt}](${text.slice(urlStart, urlEnd)})`;
    outputCursor = urlEnd + 1;
    index = urlEnd;
    candidateStart = -1;
  }

  return result + text.slice(outputCursor);
}

/**
 * Chat-wide gallery filename index for `card://self` fallback resolution:
 * which of the chat's characters owns which gallery filenames, in chat order.
 */
export interface ChatGalleryIndex {
  /** Chat character ids in chat order (fallback priority: first match wins). */
  order: string[];
  /** Character id -> set of gallery filenames (decoded, as stored on disk). */
  byCharacter: Map<string, Set<string>>;
}

/**
 * Rewrite portable `card://self/gallery/<file>` references to a concrete
 * character's card URL. Applied to message text BEFORE markdown rendering so
 * the shared renderers keep their current signatures.
 *
 * Resolution order: the SPEAKING character always wins. When a chat-wide
 * gallery index is supplied and it shows the speaker does NOT own the file
 * while another chat character does, the reference resolves to that character
 * instead (first match in chat order) — so merged group replies and
 * mis-attributed segments still show the right art. When the index knows no
 * owner (or none is supplied), the speaker rewrite is kept: the index is a
 * cache and may simply not know about a freshly added image.
 *
 * With no speaker (user/system messages) the text is returned untouched:
 * `resolveCardAssetUrl` then falls through on the unknown `self` scope and the
 * browser shows a broken image — the same visible failure any other
 * unresolvable card:// link produces.
 */
const SELF_GALLERY_PREFIX_RE = /card:\/\/self\/gallery\//gi;
// Prefix + captured filename, for index-aware per-occurrence resolution. The
// filename ends at the same boundaries the markdown/HTML parsers use: a
// closing paren, quote, angle bracket, backtick, bracket, or whitespace.
const SELF_GALLERY_REF_RE = /card:\/\/self\/gallery\/([^)\s"'`<>\]]*)/gi;

function decodeRefFilename(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveSelfCardAssets(
  text: string,
  characterId?: string | null,
  galleryIndex?: ChatGalleryIndex | null,
): string {
  if (!text || !characterId) return text;
  const prefixFor = (id: string) => `card://characters/${encodeURIComponent(id)}/gallery/`;
  const speakerPrefix = prefixFor(characterId);
  // Function replacers so `$`-sequences in ids/filenames can never be
  // interpreted as replacement patterns.
  if (!galleryIndex) {
    // Filenames after the prefix are never touched on this path.
    return text.replace(SELF_GALLERY_PREFIX_RE, () => speakerPrefix);
  }
  return text.replace(SELF_GALLERY_REF_RE, (_match, rawFilename: string) => {
    const filename = decodeRefFilename(rawFilename);
    const speakerOwns = galleryIndex.byCharacter.get(characterId)?.has(filename);
    // Fall back to another owner only once the speaker's own gallery has
    // actually loaded (it has an entry in the index): an unresolved query is
    // unknown ownership, not confirmed non-ownership, and treating them the
    // same would flash another character's same-named image until it resolves.
    if (!speakerOwns && galleryIndex.byCharacter.has(characterId)) {
      const owner = galleryIndex.order.find(
        (id) => id !== characterId && galleryIndex.byCharacter.get(id)?.has(filename),
      );
      if (owner) return `${prefixFor(owner)}${rawFilename}`;
    }
    return `${speakerPrefix}${rawFilename}`;
  });
}

export function resolveCardAssetUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed.toLowerCase().startsWith("card://")) return rawUrl;

  const withoutProtocol = trimmed.slice("card://".length);
  const [withoutHash] = withoutProtocol.split("#");
  const [pathOnly] = (withoutHash ?? "").split("?");
  const rawParts = (pathOnly ?? "").split("/").filter(Boolean);
  if (rawParts.length === 0) return rawUrl;

  const scope = rawParts[0]!.toLowerCase();
  const parts = rawParts.slice(1);

  if (scope === "gallery") {
    if (parts.length >= 2) {
      return `/api/gallery/file/${encodePath([parts[0]!, parts.slice(1).join("/")])}`;
    }
    const chatId = activeChatId();
    if (chatId && parts[0]) {
      return `/api/gallery/asset/${encodeSegment(chatId)}/gallery/${encodePath(parts)}`;
    }
  }

  if (scope === "characters" && parts.length >= 3 && parts[1] === "gallery") {
    return `/api/characters/${encodeSegment(parts[0]!)}/gallery/file/${encodePath(parts.slice(2))}`;
  }

  if (scope === "personas" && parts.length >= 3 && parts[1] === "gallery") {
    return `/api/characters/personas/${encodeSegment(parts[0]!)}/gallery/file/${encodePath(parts.slice(2))}`;
  }

  // `self` is resolved before render by resolveSelfCardAssets(). Reaching here
  // means there was no speaker context (user/system message, unknown speaker) —
  // fall through to rawUrl like any other unresolvable scope. Do NOT wire the
  // active chat's character in here: that would silently resolve `self` inside
  // user messages to an arbitrary participant.
  if (scope === "self") return rawUrl;

  if (scope === "sprites") {
    const first = parts[0]?.toLowerCase();
    if ((first === "facial" || first === "fullbody") && parts.length >= 2) {
      const chatId = activeChatId();
      if (chatId) {
        return `/api/gallery/asset/${encodeSegment(chatId)}/sprites/${encodePath(parts)}`;
      }
    }
    if (parts.length >= 2) {
      return `/api/sprites/${encodeSegment(parts[0]!)}/file/${encodePath(parts.slice(1))}`;
    }
  }

  return rawUrl;
}

export function buildCardAssetMarkdown(label: string, cardUrl: string): string {
  const alt = label.replace(/[\]\r\n]/g, " ").trim() || "image";
  return `![${alt}](${cardUrl})`;
}

export function dispatchCardAssetInsert(markdown: string, chatId?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<CardAssetInsertDetail>(CARD_ASSET_INSERT_EVENT, { detail: { markdown, chatId } }),
  );
}
