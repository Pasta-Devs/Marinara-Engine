import { normalizeTextForMatch, resolveMacros, type MacroContext } from "@marinara-engine/shared";

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

export function parsePersonaMacroData(raw: Record<string, unknown> | null | undefined): MacroPersonaData | null {
  if (!raw) return null;

  return {
    personaId: getString(raw.id),
    name: getString(raw.name) || "User",
    description: getString(raw.description),
    personality: getString(raw.personality),
    backstory: getString(raw.backstory),
    appearance: getString(raw.appearance),
    scenario: getString(raw.scenario),
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
  personas: Array<Record<string, unknown>> | undefined,
): MacroPersonaData | undefined {
  if (!personas?.length) return undefined;

  const chatPersonaId = typeof chat?.personaId === "string" ? chat.personaId : null;
  const allowGlobalFallback = chat?.mode !== "game";
  const selectedPersona =
    (chatPersonaId ? personas.find((persona) => getString(persona.id) === chatPersonaId) : null) ??
    (allowGlobalFallback ? personas.find((persona) => persona.isActive === true || persona.isActive === "true") : null);

  return parsePersonaMacroData(selectedPersona ?? null) ?? undefined;
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
  userName,
  variables = {},
  lastInput,
}: {
  persona?: MacroPersonaData | null;
  primaryCharacter?: MacroCharacterData | null;
  characters?: MacroCharacterData[];
  userName?: string;
  variables?: Record<string, string>;
  lastInput?: string;
}): MacroContext {
  const fallbackCharacter = primaryCharacter ?? characters[0] ?? null;

  return {
    user: userName ?? persona?.name ?? "User",
    char: fallbackCharacter?.name ?? "Character",
    characters: characters.map((character) => character.name).filter((name) => name.trim().length > 0),
    variables,
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
const VARIABLE_OP_MACRO_RE = /\{\{\s*(?:setvar|addvar|incvar|decvar|getvar)\b/i;
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
    const cacheable =
      !touchesVariables && !variablesTouched && template.length <= RESOLVER_CACHE_MAX_TEMPLATE_LENGTH;
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

export function resolveInputMacrosForChat(
  template: string,
  chat: { characterIds?: unknown; personaId?: string | null; mode?: string | null } | null | undefined,
  characters: Array<{ id: string; data: unknown }> | undefined,
  personas: Array<Record<string, unknown>> | undefined,
  lastInput?: string,
): string {
  return createInputMacroResolverForChat(chat, characters, personas, lastInput)(template);
}

export function createInputMacroResolverForChat(
  chat: { characterIds?: unknown; personaId?: string | null; mode?: string | null } | null | undefined,
  characters: Array<{ id: string; data: unknown }> | undefined,
  personas: Array<Record<string, unknown>> | undefined,
  lastInput?: string,
) {
  const chatCharacters = selectChatCharacters(chat, characters);
  const activePersona = selectActivePersona(chat, personas);
  return createMessageMacroResolver({
    persona: activePersona,
    primaryCharacter: chatCharacters[0] ?? null,
    characters: chatCharacters,
    lastInput,
  });
}
