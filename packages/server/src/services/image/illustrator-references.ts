import { stripMacroComments } from "@marinara-engine/shared";
import { readPreferredFullBodySpriteBase64 } from "../game/sprite.service.js";
import { readAvatarBase64 } from "../game/game-asset-generation.js";

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
  promptAliases: string[];
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
  characterIds: string[];
  personaId: string | null;
  referenceImages: string[];
  referenceNames: string[];
  referenceLine: string | null;
  appearanceNames: string[];
  appearanceBlock: string | null;
};

export function isNovelAiImageConnection(args: {
  model?: unknown;
  baseUrl?: unknown;
  imageService?: unknown;
  imageGenerationSource?: unknown;
}): boolean {
  return [args.model, args.baseUrl, args.imageService, args.imageGenerationSource].some((value) => {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "novelai" || normalized.includes("novelai.net") || /^nai-diffusion-/i.test(normalized);
  });
}

type ReferencePromptImageProvider = {
  model?: unknown;
  baseUrl?: unknown;
  imageService?: unknown;
  imageGenerationSource?: unknown;
  serviceHint?: unknown;
  source?: unknown;
};

const LOCAL_STABLE_DIFFUSION_SERVICES = new Set(["comfyui", "automatic1111", "drawthings"]);
const LOCAL_STABLE_DIFFUSION_PORTS = new Set(["8188", "7860"]);
const LOOPBACK_IMAGE_HOSTS = new Set(["localhost", "localhost.localdomain", "127.0.0.1", "::1"]);

function isLocalStableDiffusionUrl(value: unknown): boolean {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "")
      .toLowerCase();
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      LOOPBACK_IMAGE_HOSTS.has(hostname) &&
      LOCAL_STABLE_DIFFUSION_PORTS.has(url.port)
    );
  } catch {
    return false;
  }
}

function providerSuppressesReferencePromptLine(args: ReferencePromptImageProvider): boolean {
  if (
    isNovelAiImageConnection({
      model: args.model,
      baseUrl: args.baseUrl,
      imageService: args.imageService ?? args.serviceHint,
      imageGenerationSource: args.imageGenerationSource ?? args.source,
    })
  ) {
    return true;
  }
  const explicitServiceValues = [args.imageService, args.imageGenerationSource, args.serviceHint, args.source];
  return (
    explicitServiceValues.some(
      (value) => typeof value === "string" && LOCAL_STABLE_DIFFUSION_SERVICES.has(value.trim().toLowerCase()),
    ) || isLocalStableDiffusionUrl(args.baseUrl)
  );
}

/**
 * Providers for which the prose "Attached are reference images…" line should be
 * omitted from the image prompt. NovelAI receives references through its native
 * character-reference fields. Local Stable Diffusion backends receive reference
 * images out-of-band, so this prose does not encode the image and only consumes
 * prompt tokens. When a fallback is configured, every possible provider must
 * support omission because the same compiled prompt is reused for the retry.
 */
export function suppressesReferencePromptLine(
  args: ReferencePromptImageProvider,
  fallback?: ReferencePromptImageProvider | null,
): boolean {
  return providerSuppressesReferencePromptLine(args) && (!fallback || providerSuppressesReferencePromptLine(fallback));
}

const MAX_ILLUSTRATOR_REFERENCE_IMAGES = 6;
const MAX_ILLUSTRATOR_APPEARANCE_CHARS = 1400;
const NAME_STOPWORDS = new Set(["the", "a", "an", "il", "la", "le", "de", "van", "von", "dr", "mr", "ms"]);

export const ILLUSTRATOR_TEXT_NEGATIVE_PROMPT =
  "dialogue boxes, speech bubbles, word balloons, captions, narration boxes, text boxes, manga sound effect text, SFX lettering, readable text, letters, subtitles, watermark, logo, signature";

export const ILLUSTRATOR_NON_TEXT_ARTIFACT_NEGATIVE_PROMPT = "watermark, logo, signature";

const ILLUSTRATOR_RENDERED_TEXT_REQUEST_PATTERNS = [
  /\b(?:caption|sfx|sound effect|speech bubble|dialogue bubble|word balloon)s?\s*(?:\([^\n)]{1,80}\))?\s*:/iu,
  /\b(?:include|add|show|draw|render|display|feature|place|contain|use|keep|preserve)\b[^\n.!?]{0,100}\b(?:dialogue boxes?|speech bubbles?|word balloons?|captions?|narration boxes?|text boxes?|sfx lettering|sound effect text|readable text|comic lettering|manga lettering)\b/iu,
  /\b(?:expressive|readable|clear|clean|hand[- ]?lettered|stylized)(?:\s+(?:readable|comic|manga))*\s+(?:lettering|dialogue boxes?|speech bubbles?|word balloons?|captions?|sfx)\b/iu,
  /\b(?:short\s+)?readable text plan\b/iu,
  /\b(?:sign|poster|screen|label|title)\s+(?:reading|reads|saying)\b/iu,
];

export function illustratorPromptRequestsRenderedText(prompt: string): boolean {
  return ILLUSTRATOR_RENDERED_TEXT_REQUEST_PATTERNS.some((pattern) => pattern.test(prompt));
}

/**
 * Preserve the default ban on accidental image text for ordinary illustrations,
 * but do not contradict comic pages or other prompts that explicitly request
 * lettering. User- and agent-authored negative prompts remain intact.
 */
export function mergeIllustratorNegativePrompt(prompt: string, negativePrompt?: string | null): string {
  const builtInNegativePrompt = illustratorPromptRequestsRenderedText(prompt)
    ? ILLUSTRATOR_NON_TEXT_ARTIFACT_NEGATIVE_PROMPT
    : ILLUSTRATOR_TEXT_NEGATIVE_PROMPT;
  return [negativePrompt?.trim(), builtInNegativePrompt].filter(Boolean).join(", ");
}

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

function buildNameAliases(name: string, opts: { includeStandaloneTokens?: boolean } = {}): string[] {
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

  if (opts.includeStandaloneTokens !== false) {
    for (const token of tokens) {
      if (token.length >= 4 && !NAME_STOPWORDS.has(token)) aliases.add(token);
    }
  }

  return [...aliases].sort((a, b) => b.length - a.length);
}

export function normalizeIllustratorAppearance(value: unknown): string | null {
  const cleaned = typeof value === "string" ? stripMacroComments(value).replace(/\s+/g, " ").trim() : "";
  if (!cleaned) return null;
  if (cleaned.length <= MAX_ILLUSTRATOR_APPEARANCE_CHARS) return cleaned;
  const limit = MAX_ILLUSTRATOR_APPEARANCE_CHARS - 3;
  const clipped = cleaned.slice(0, limit).trimEnd();
  const wordBoundary = clipped.lastIndexOf(" ");
  return `${(wordBoundary > 0 ? clipped.slice(0, wordBoundary) : clipped).trimEnd()}...`;
}

export function readIllustratorAppearance(data: Record<string, unknown>): string | null {
  const extensions = parseRecord(data.extensions);
  return normalizeIllustratorAppearance(extensions.appearance) ?? normalizeIllustratorAppearance(data.appearance);
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
    appearance: readIllustratorAppearance(data),
    aliases: buildNameAliases(rawName),
    promptAliases: buildNameAliases(rawName, { includeStandaloneTokens: false }),
    sourceOrder,
  };
}

function readBestReferenceImage(characterId: string | null | undefined, avatarPath: string | null | undefined) {
  return readAvatarBase64(avatarPath) ?? readPreferredFullBodySpriteBase64(characterId)?.base64;
}

export async function resolveIllustratorCharacterReferences(args: {
  charactersStore: { list: () => Promise<CharacterRowLike[]> };
  chatCharacters: IllustratorChatCharacterReference[];
  persona?: IllustratorPersonaReference | null;
  requestedNames: string[];
  promptText: string;
  fallbackToChatCharacters?: boolean;
  maxReferences?: number;
  includeReferenceImages?: boolean;
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
      appearance: normalizeIllustratorAppearance(character.appearance) ?? fromDb?.appearance ?? null,
      aliases: buildNameAliases(character.name),
      promptAliases: buildNameAliases(character.name, { includeStandaloneTokens: false }),
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
    if (source.promptAliases.some((alias) => textContainsAlias(normalizedPromptText, alias))) {
      selected.set(source.id, source);
    }
  }

  const personaName = args.persona?.name?.trim() ?? "";
  const personaAliases = personaName ? buildNameAliases(personaName) : [];
  const personaPromptAliases = personaName ? buildNameAliases(personaName, { includeStandaloneTokens: false }) : [];
  const personaRequested =
    personaAliases.length > 0 &&
    (requestedNames.some((requestedName) =>
      personaAliases.some((alias) => alias === requestedName || textContainsAlias(requestedName, alias)),
    ) ||
      personaPromptAliases.some((alias) => textContainsAlias(normalizedPromptText, alias)));

  if (selected.size === 0 && args.fallbackToChatCharacters === true) {
    for (const character of args.chatCharacters) {
      const source = sourcesById.get(character.id);
      if (source) selected.set(source.id, source);
    }
  }

  const orderedSelectedSources = [...selected.values()].sort((a, b) => a.sourceOrder - b.sourceOrder);
  const orderedSources = orderedSelectedSources.slice(0, maxReferences);
  const referenceImages: string[] = [];
  const referenceNames: string[] = [];
  const appearanceLines: string[] = [];
  const appearanceNames: string[] = [];

  const pushAppearanceLine = (name: string, appearance: string | null | undefined) => {
    const trimmed = normalizeIllustratorAppearance(appearance);
    if (!trimmed || appearanceNames.includes(name)) return;
    appearanceNames.push(name);
    appearanceLines.push(`${name}'s Appearance: ${trimmed}`);
  };

  for (const source of orderedSources) {
    pushAppearanceLine(source.name, source.appearance);
  }

  for (const source of orderedSources) {
    if (args.includeReferenceImages === false) continue;
    const b64 = readBestReferenceImage(source.id, source.avatarPath);
    if (!b64) continue;
    referenceImages.push(b64);
    referenceNames.push(source.name);
  }

  if (
    args.includeReferenceImages !== false &&
    args.persona &&
    personaRequested &&
    referenceImages.length < maxReferences
  ) {
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
    // Gallery persistence is not constrained by the reference-image cap: every
    // depicted character should receive the generated image even when only the
    // first few likeness references can be sent to the provider.
    characterIds: orderedSelectedSources.map((source) => source.id),
    personaId: args.persona && personaRequested ? args.persona.id : null,
    referenceImages,
    referenceNames,
    referenceLine:
      referenceNames.length > 0
        ? `Attached are reference images of ${referenceNames.join(", ")}. Use them only to preserve character likeness and visual identity; the written scene prompt is authoritative for composition, setting, action, mood, framing, and whether any text appears.`
        : null,
    appearanceNames,
    appearanceBlock: appearanceLines.length > 0 ? `Character appearance notes:\n${appearanceLines.join("\n")}` : null,
  };
}
