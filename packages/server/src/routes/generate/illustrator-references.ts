import { stripMacroComments } from "@marinara-engine/shared";
import { readPreferredFullBodySpriteBase64 } from "../../services/game/sprite.service.js";
import { readAvatarBase64 } from "../../services/game/game-asset-generation.js";

type CharacterRowLike = {
  id: string;
  data: unknown;
  avatarPath?: string | null;
};

type CharacterReferenceSource = {
  id: string;
  name: string;
  avatarPath: string | null;
  appearance: string | null;
  aliases: string[];
  sourceOrder: number;
};

export type IllustratorPersonaReference = {
  id: string | null;
  name: string;
  avatarPath?: string | null;
  appearance?: string | null;
};

export type IllustratorChatCharacterReference = {
  id: string;
  name: string;
  avatarPath?: string | null;
  appearance?: string | null;
};

export type IllustratorReferenceResolution = {
  referenceImages: string[];
  referenceNames: string[];
  referenceLine: string | null;
  appearanceNames: string[];
  appearanceBlock: string | null;
};

const MAX_ILLUSTRATOR_REFERENCE_IMAGES = 6;
const MAX_ILLUSTRATOR_APPEARANCE_CHARS = 1400;
const NAME_STOPWORDS = new Set(["the", "a", "an", "il", "la", "le", "de", "van", "von", "dr", "mr", "ms"]);

export const ILLUSTRATOR_TEXT_NEGATIVE_PROMPT =
  "dialogue boxes, speech bubbles, word balloons, captions, narration boxes, text boxes, manga sound effect text, SFX lettering, readable text, letters, subtitles, watermark, logo, signature";

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeReferenceName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameAliases(name: string): string[] {
  const normalized = normalizeReferenceName(name);
  if (!normalized) return [];

  const aliases = new Set<string>([normalized]);
  const withoutParenthetical = normalizeReferenceName(name.replace(/\([^)]*\)/g, " "));
  if (withoutParenthetical) aliases.add(withoutParenthetical);

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length > 1) {
    const withoutLeadingTitle = tokens.filter((token, index) => index > 0 || !NAME_STOPWORDS.has(token)).join(" ");
    if (withoutLeadingTitle) aliases.add(withoutLeadingTitle);
  }

  for (const token of tokens) {
    if (token.length >= 4 && !NAME_STOPWORDS.has(token)) aliases.add(token);
  }

  return [...aliases].sort((a, b) => b.length - a.length);
}

function readAppearance(data: Record<string, unknown>): string | null {
  const extensions = parseRecord(data.extensions);
  const raw =
    typeof extensions.appearance === "string"
      ? extensions.appearance
      : typeof data.appearance === "string"
        ? data.appearance
        : "";
  const cleaned = stripMacroComments(raw).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_ILLUSTRATOR_APPEARANCE_CHARS
    ? `${cleaned.slice(0, MAX_ILLUSTRATOR_APPEARANCE_CHARS).trimEnd()}...`
    : cleaned;
}

function textContainsAlias(normalizedText: string, alias: string): boolean {
  if (!normalizedText || !alias) return false;
  return new RegExp(`(?:^| )${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`).test(normalizedText);
}

function characterRowToSource(row: CharacterRowLike, sourceOrder: number): CharacterReferenceSource | null {
  const data = parseRecord(row.data);
  const rawName = typeof data.name === "string" ? stripMacroComments(data.name).trim() : "";
  if (!rawName) return null;
  return {
    id: row.id,
    name: rawName,
    avatarPath: typeof row.avatarPath === "string" ? row.avatarPath : null,
    appearance: readAppearance(data),
    aliases: buildNameAliases(rawName),
    sourceOrder,
  };
}

function readBestReferenceImage(characterId: string | null | undefined, avatarPath: string | null | undefined) {
  return readPreferredFullBodySpriteBase64(characterId)?.base64 ?? readAvatarBase64(avatarPath);
}

export async function resolveIllustratorCharacterReferences(args: {
  charactersStore: { list: () => Promise<CharacterRowLike[]> };
  chatCharacters: IllustratorChatCharacterReference[];
  persona?: IllustratorPersonaReference | null;
  requestedNames: string[];
  promptText: string;
  fallbackToChatCharacters?: boolean;
  maxReferences?: number;
}): Promise<IllustratorReferenceResolution> {
  const maxReferences = Math.max(1, Math.min(args.maxReferences ?? MAX_ILLUSTRATOR_REFERENCE_IMAGES, 12));
  const allRows = await args.charactersStore.list().catch(() => []);
  const allSources = allRows
    .map((row, index) => characterRowToSource(row, index + args.chatCharacters.length))
    .filter((source): source is CharacterReferenceSource => Boolean(source));
  const allSourcesById = new Map(allSources.map((source) => [source.id, source]));

  const sourcesById = new Map<string, CharacterReferenceSource>();
  args.chatCharacters.forEach((character, index) => {
    const fromDb = allSourcesById.get(character.id);
    sourcesById.set(character.id, {
      id: character.id,
      name: character.name,
      avatarPath: character.avatarPath ?? fromDb?.avatarPath ?? null,
      appearance: character.appearance ?? fromDb?.appearance ?? null,
      aliases: buildNameAliases(character.name),
      sourceOrder: index,
    });
  });
  for (const source of allSources) {
    if (!sourcesById.has(source.id)) sourcesById.set(source.id, source);
  }

  const sources = [...sourcesById.values()];
  const normalizedPromptText = normalizeReferenceName(args.promptText);
  const requestedNames = args.requestedNames.map((name) => normalizeReferenceName(name)).filter(Boolean);
  const selected = new Map<string, CharacterReferenceSource>();

  for (const requestedName of requestedNames) {
    const match = sources.find(
      (source) =>
        source.aliases.some((alias) => alias === requestedName || textContainsAlias(requestedName, alias)) ||
        source.aliases.some((alias) => textContainsAlias(alias, requestedName)),
    );
    if (match) selected.set(match.id, match);
  }

  for (const source of sources) {
    if (selected.has(source.id)) continue;
    if (source.aliases.some((alias) => textContainsAlias(normalizedPromptText, alias))) selected.set(source.id, source);
  }

  const personaName = args.persona?.name?.trim() ?? "";
  const personaAliases = personaName ? buildNameAliases(personaName) : [];
  const personaRequested =
    personaAliases.length > 0 &&
    (requestedNames.some((requestedName) =>
      personaAliases.some((alias) => alias === requestedName || textContainsAlias(requestedName, alias)),
    ) ||
      personaAliases.some((alias) => textContainsAlias(normalizedPromptText, alias)));

  if (selected.size === 0 && args.fallbackToChatCharacters === true) {
    for (const character of args.chatCharacters) {
      const source = sourcesById.get(character.id);
      if (source) selected.set(source.id, source);
    }
  }

  const orderedSources = [...selected.values()]
    .sort((a, b) => a.sourceOrder - b.sourceOrder)
    .slice(0, maxReferences);
  const referenceImages: string[] = [];
  const referenceNames: string[] = [];
  const appearanceLines: string[] = [];
  const appearanceNames: string[] = [];

  const pushAppearanceLine = (name: string, appearance: string | null | undefined) => {
    const trimmed = appearance?.trim();
    if (!trimmed || appearanceNames.includes(name)) return;
    appearanceNames.push(name);
    appearanceLines.push(`${name}'s Appearance: ${trimmed}`);
  };

  for (const source of orderedSources) {
    pushAppearanceLine(source.name, source.appearance);
  }

  for (const source of orderedSources) {
    const b64 = readBestReferenceImage(source.id, source.avatarPath);
    if (!b64) continue;
    referenceImages.push(b64);
    referenceNames.push(source.name);
  }

  if (args.persona && personaRequested && referenceImages.length < maxReferences) {
    const b64 = readBestReferenceImage(args.persona.id, args.persona.avatarPath ?? null);
    if (b64) {
      referenceImages.push(b64);
      referenceNames.push(args.persona.name);
    }
  }
  if (args.persona && personaRequested) {
    pushAppearanceLine(args.persona.name, args.persona.appearance);
  }

  return {
    referenceImages,
    referenceNames,
    referenceLine:
      referenceNames.length > 0
        ? `Attached are reference images of ${referenceNames.join(", ")}. Use them only to preserve character likeness and visual identity; the written scene prompt is authoritative for composition, setting, action, mood, framing, and whether any text appears.`
        : null,
    appearanceNames,
    appearanceBlock:
      appearanceLines.length > 0 ? `Character appearance notes:\n${appearanceLines.join("\n")}` : null,
  };
}
