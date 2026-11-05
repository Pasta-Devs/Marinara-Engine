import {
  normalizeTextForMatch,
  resolveChatPersonaCandidate,
  resolveMacros,
  usesLorebookIncludes,
  type MacroContext,
  type Persona,
  type ScopedRegexMode,
} from "@marinara-engine/shared";
import { api, requestTimeoutSignal } from "./api-client";
import { parseChatMetadata } from "./chat-display";

export interface MacroCharacterData {
  id?: string;
  name: string;
  description?: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
  example?: string;
  systemPrompt?: string;
  postHistoryInstructions?: string;
}

export interface MacroPersonaData {
  personaId?: string;
  name: string;
  description?: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export function getChatCharacterIds(chat: { characterIds?: unknown } | null | undefined): string[] {
  if (!chat) return [];

  const raw = chat.characterIds;
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.filter((value): value is string => typeof value === "string" && value.length > 0)));
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed)
        ? Array.from(new Set(parsed.filter((value): value is string => typeof value === "string" && value.length > 0)))
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function parseCharacterMacroData(
  raw: { id?: string; data: unknown } | null | undefined,
): MacroCharacterData | null {
  if (!raw) return null;

  try {
    const parsed = typeof raw.data === "string" ? JSON.parse(raw.data) : raw.data;
    const data = getRecord(parsed);
    if (!data) return { id: raw.id, name: "Unknown" };
    const extensions = getRecord(data.extensions);
    return {
      id: raw.id,
      name: getString(data.name) || "Unknown",
      description: getString(data.description),
      personality: getString(data.personality),
      backstory: getString(extensions?.backstory),
      appearance: getString(extensions?.appearance),
      scenario: getString(data.scenario),
      example: getString(data.mes_example),
      systemPrompt: getString(data.system_prompt),
      postHistoryInstructions: getString(data.post_history_instructions),
    };
  } catch {
    return { id: raw.id, name: "Unknown" };
  }
}

function toMacroPersonaData(persona: Persona): MacroPersonaData {
  return {
    personaId: persona.id,
    name: persona.name || "User",
    description: persona.description,
    personality: persona.personality,
    backstory: persona.backstory,
    appearance: persona.appearance,
    scenario: persona.scenario,
  };
}

function toMacroPersonaDataFromCharacter(character: MacroCharacterData): MacroPersonaData {
  return {
    personaId: character.id,
    name: character.name,
    description: character.description,
    personality: character.personality,
    backstory: character.backstory,
    appearance: character.appearance,
    scenario: character.scenario,
  };
}

export function selectChatCharacters(
  chat: { characterIds?: unknown } | null | undefined,
  characters: Array<{ id: string; data: unknown }> | undefined,
): MacroCharacterData[] {
  const chatCharacterIds = getChatCharacterIds(chat);
  if (chatCharacterIds.length === 0 || !characters?.length) return [];

  const byId = new Map<string, MacroCharacterData>();
  for (const character of characters) {
    const parsed = parseCharacterMacroData(character);
    if (parsed) byId.set(character.id, parsed);
  }

  return chatCharacterIds.map((id) => byId.get(id)).filter((value): value is MacroCharacterData => !!value);
}

export function selectActivePersona(
  chat: { personaId?: string | null; mode?: string | null } | null | undefined,
  personas: Persona[] | undefined,
): MacroPersonaData | undefined {
  if (!personas?.length) return undefined;

  const selectedPersona = resolveChatPersonaCandidate(personas, chat?.personaId);

  return selectedPersona ? toMacroPersonaData(selectedPersona) : undefined;
}

export function findCharacterByName(
  characters: Iterable<MacroCharacterData>,
  name: string | null | undefined,
): MacroCharacterData | undefined {
  if (!name) return undefined;
  const needle = normalizeTextForMatch(name);
  if (!needle) return undefined;

  for (const character of characters) {
    if (normalizeTextForMatch(character.name) === needle) {
      return character;
    }
  }

  return undefined;
}

export function buildMessageMacroContext({
  persona,
  primaryCharacter,
  characters = [],
  inactiveCharacterIds,
  userName,
  variables = {},
  chatVariables,
  lastInput,
}: {
  persona?: MacroPersonaData | null;
  primaryCharacter?: MacroCharacterData | null;
  characters?: MacroCharacterData[];
  inactiveCharacterIds?: unknown;
  userName?: string;
  variables?: Record<string, string>;
  /** The chat's own variables (`metadata.macroVariables`). Preset `variables` win over them, as in the prompt. */
  chatVariables?: Record<string, string>;
  lastInput?: string;
}): MacroContext {
  const fallbackCharacter = primaryCharacter ?? characters[0] ?? null;
  const inactiveIds = new Set(Array.isArray(inactiveCharacterIds) ? inactiveCharacterIds : []);

  return {
    user: userName ?? persona?.name ?? "User",
    char: fallbackCharacter?.name ?? "Character",
    characters: characters.map((character) => character.name).filter((name) => name.trim().length > 0),
    groupCharacters: characters
      .filter((character) => !character.id || !inactiveIds.has(character.id))
      .map((character) => character.name)
      .filter((name) => name.trim().length > 0),
    variables,
    // A copy per context: {{setvar}} writes into localVariables, and showing a
    // message must never change the chat's variables or leak into another message.
    ...(chatVariables ? { localVariables: { ...chatVariables } } : {}),
    lastInput,
    characterFields: fallbackCharacter
      ? {
          description: fallbackCharacter.description ?? "",
          personality: fallbackCharacter.personality ?? "",
          backstory: fallbackCharacter.backstory ?? "",
          appearance: fallbackCharacter.appearance ?? "",
          scenario: fallbackCharacter.scenario ?? "",
          example: fallbackCharacter.example ?? "",
          systemPrompt: fallbackCharacter.systemPrompt ?? "",
          postHistoryInstructions: fallbackCharacter.postHistoryInstructions ?? "",
        }
      : undefined,
    personaFields: persona
      ? {
          description: persona.description ?? "",
          personality: persona.personality ?? "",
          backstory: persona.backstory ?? "",
          appearance: persona.appearance ?? "",
          scenario: persona.scenario ?? "",
        }
      : undefined,
  };
}

export function resolveMessageMacros(
  template: string,
  context: Parameters<typeof buildMessageMacroContext>[0],
  options?: { randomSeed?: string },
): string {
  return createMessageMacroResolver(context, options)(template);
}

/**
 * Variable-op macros make resolution order-dependent (writes mutate the shared
 * context; reads observe them), so templates containing them are never cached.
 */
const VARIABLE_OP_MACRO_RE = /\{\{\s*(?:setvar|addvar|addnumvar|incvar|decvar|getvar)\b/i;
/** Macros that change a chat variable. Only the server saves a chat variable's new value. */
export const VARIABLE_WRITE_MACRO_RE = /\{\{\s*(?:setvar|addvar|addnumvar|incvar|decvar)\b/i;
/** Only short templates (regex replacements, trims, patterns) are worth caching. */
const RESOLVER_CACHE_MAX_TEMPLATE_LENGTH = 2048;

export function createMessageMacroResolver(
  context: Parameters<typeof buildMessageMacroContext>[0],
  options?: { randomSeed?: string },
) {
  const macroContext = buildMessageMacroContext(context);
  // #3164: one resolver instance serves every regex-script replacement / trim /
  // pattern string of a single display computation, and scripts frequently share
  // the same replacement — with a fixed (context, seed), identical templates
  // resolve identically, so repeats are served from a per-instance cache. The
  // cache is disabled from the first variable-write onward: conditionals and the
  // {{name}} catch-all can read variables without matching the var-op pattern,
  // and a write in between would make a cached repeat stale.
  const cache = new Map<string, string>();
  let variablesTouched = false;
  return (template: string) => {
    const touchesVariables = VARIABLE_OP_MACRO_RE.test(template);
    if (touchesVariables) variablesTouched = true;
    const cacheable = !touchesVariables && !variablesTouched && template.length <= RESOLVER_CACHE_MAX_TEMPLATE_LENGTH;
    if (cacheable) {
      const cached = cache.get(template);
      if (cached !== undefined) return cached;
    }
    const resolved = resolveMacros(template, macroContext, { trimResult: false, randomSeed: options?.randomSeed });
    if (cacheable) cache.set(template, resolved);
    return resolved;
  };
}

export function isPromptPreviewMacro(input: string): boolean {
  return /^\{\{\s*(?:prompt|prompt_preview|preview_prompt)\s*\}\}$/i.test(input.trim());
}

/** The persona a chat speaks as: a character acting as the persona, else the chosen persona. */
function selectChatPersona(
  chat: { personaId?: string | null; personaCharacterId?: string | null; mode?: string | null } | null | undefined,
  characters: Array<{ id: string; data: unknown }> | undefined,
  personas: Persona[] | undefined,
): MacroPersonaData | undefined {
  if (!chat?.personaCharacterId) return selectActivePersona(chat, personas);
  const characterPersona = parseCharacterMacroData(
    characters?.find((character) => character.id === chat.personaCharacterId),
  );
  return characterPersona ? toMacroPersonaDataFromCharacter(characterPersona) : undefined;
}

/** How much of a greeting a choice list shows. */
const GREETING_PREVIEW_MAX_LENGTH = 500;

/**
 * A greeting as the add-character preview shows it: resolved like a displayed
 * message (the chat's variables, `{{user}}` for the chat's persona, `{{char}}`
 * for this card), THEN cut. Cutting first could leave half a `{{tag}}` that no
 * longer resolves. The message the player adds still stores the raw text; it
 * resolves when displayed.
 */
export function resolveGreetingPreview(
  template: string,
  {
    character,
    chat,
    characters,
    personas,
    chatVariables,
  }: {
    /** The card the greeting belongs to. */
    character: { id: string; data: unknown };
    chat: Parameters<typeof createInputMacroResolverForChat>[0];
    characters: Array<{ id: string; data: unknown }> | undefined;
    personas: Persona[] | undefined;
    chatVariables: Record<string, string>;
  },
): { text: string; cut: boolean } {
  const card = parseCharacterMacroData(character);
  const chatCharacters = selectChatCharacters(chat, characters);
  const resolved = resolveMessageMacros(
    template,
    {
      persona: selectChatPersona(chat, characters, personas),
      primaryCharacter: card,
      characters: chatCharacters.some((entry) => entry.id === character.id)
        ? chatCharacters
        : card
          ? [...chatCharacters, card]
          : chatCharacters,
      inactiveCharacterIds: chat?.mode === "game" ? undefined : parseChatMetadata(chat?.metadata).inactiveCharacterIds,
      chatVariables,
    },
    // Fixed per card, so a {{random}} in the preview doesn't re-roll on every render.
    { randomSeed: `greeting:${character.id}` },
  );
  return resolved.length > GREETING_PREVIEW_MAX_LENGTH
    ? { text: resolved.slice(0, GREETING_PREVIEW_MAX_LENGTH), cut: true }
    : { text: resolved, cut: false };
}

export function createInputMacroResolverForChat(
  chat:
    | {
        characterIds?: unknown;
        personaId?: string | null;
        personaCharacterId?: string | null;
        mode?: string | null;
        metadata?: unknown;
      }
    | null
    | undefined,
  characters: Array<{ id: string; data: unknown }> | undefined,
  personas: Persona[] | undefined,
  lastInput?: string,
  variables?: Record<string, string>,
) {
  const chatCharacters = selectChatCharacters(chat, characters);
  return createMessageMacroResolver({
    persona: selectChatPersona(chat, characters, personas),
    primaryCharacter: chatCharacters[0] ?? null,
    characters: chatCharacters,
    inactiveCharacterIds: chat?.mode === "game" ? undefined : parseChatMetadata(chat?.metadata).inactiveCharacterIds,
    lastInput,
    variables,
  });
}

/** How long a send waits for the server to put lorebook entries in before sending the include as written. */
const EXPAND_INCLUDES_TIMEOUT_MS = 10_000;

/**
 * `{{include::...}}` reads lorebooks, which only the server has, so the server puts the
 * entries in and the caller's macro pass then fills in their macros with the rest (#7607).
 * Without a chat, or if the server fails or does not answer in time, the include stays as
 * written and the prompt fills it in, as before. Exported for turns that skip
 * prepareUserInputMessage but fill in macros the same way (Game).
 */
export async function expandMessageIncludes(text: string, chatId: string | null | undefined): Promise<string> {
  // A short-form name is looked up in the chat's lorebooks, so without a chat it would read as empty.
  if (!chatId || !usesLorebookIncludes(text)) return text;
  try {
    const result = await api.post<{ text?: unknown }>(
      "/lorebooks/expand-includes",
      { text, chatId },
      { signal: requestTimeoutSignal(EXPAND_INCLUDES_TIMEOUT_MS) },
    );
    return typeof result?.text === "string" ? result.text : text;
  } catch (error) {
    console.warn("[chat-macros] Could not fill in lorebook includes; sending them as written", error);
    return text;
  }
}

/**
 * What a composer send stores as the user's message: user-input regex scripts, optional
 * input translation, then the macros. Send, Post Only and /send all store this text, so
 * a stored message holds the resolved macros the chat shows and the model reads (#7585),
 * lorebook includes too (#7607).
 */
export async function prepareUserInputMessage(
  text: string,
  {
    chat,
    characters,
    personas,
    applyToUserInput,
    onTranslationError,
  }: {
    chat:
      | (NonNullable<Parameters<typeof createInputMacroResolverForChat>[0]> & { id?: string; metadata?: unknown })
      | null
      | undefined;
    characters: Array<{ id: string; data: unknown }> | undefined;
    personas: Persona[] | undefined;
    applyToUserInput: (
      text: string,
      options: { resolveMacros: (value: string) => string; scopedMode?: ScopedRegexMode | null },
    ) => string;
    onTranslationError: () => void;
  },
): Promise<string> {
  const resolveInputMacros = createInputMacroResolverForChat(chat, characters, personas, text);
  const chatMeta = parseChatMetadata(chat?.metadata);
  // First pass: resolve macros against raw input, so {{input}} uses the pre-translation text.
  let message = applyToUserInput(text, {
    resolveMacros: resolveInputMacros,
    scopedMode: chatMeta.scopedRegexMode,
  });

  // Input translation: translate user's message before sending
  if (chatMeta.translateInput && message.trim()) {
    try {
      const { translateText } = await import("./translate-text");
      const translated = await translateText(message, "input");
      if (translated.trim()) message = translated;
    } catch {
      onTranslationError();
    }
  }

  // Final pass: resolve macros introduced by translation while {{input}} still points to raw.
  // Lorebook includes go in first, as resolveMacros puts them in before every other macro.
  return resolveInputMacros(await expandMessageIncludes(message, chat?.id));
}
