import type { StorageGateway } from "../capabilities/storage";
import { boolish, readString, type JsonRecord } from "./runtime-records";
import promptOverrideManifest from "./prompt-overrides.manifest.json";

export const PROMPT_OVERRIDE_COLLECTION = "prompt-overrides";

const VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const VARIABLE_PATTERN = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

type PromptOverrideVariable = {
  name: string;
  description: string;
  example?: string;
};

export type PromptOverrideKeyDef<TContext extends Record<string, string | number | undefined>> = {
  key: string;
  description: string;
  variables: readonly PromptOverrideVariable[];
  template: string;
  defaultBuilder: (context: TContext) => string;
  exampleContext: TContext;
};

export type PromptOverrideRow = {
  key: string;
  template: string;
  enabled: boolean;
  updatedAt: string | null;
};

export type PromptOverrideSummary = {
  key: string;
  description: string;
  variables: readonly PromptOverrideVariable[];
  hasOverride: boolean;
  enabled: boolean;
  updatedAt: string | null;
};

export type PromptOverrideDetail = {
  key: string;
  description: string;
  variables: readonly PromptOverrideVariable[];
  override: PromptOverrideRow | null;
};

export type PromptOverrideDefault = {
  key: string;
  template: string;
  exampleContext: Record<string, string | number | undefined>;
};

type ConversationSelfiePromptContext = Record<string, string | number | undefined> & {
  appearance: string;
  charName: string;
  selfieTagsBlock: string;
};

export type ImagePromptOverrideContext = Record<string, string | number | undefined> & {
  defaultPrompt: string;
};

export type TemplateValidationResult = {
  valid: boolean;
  unknownVariables: string[];
};

type PromptOverrideManifestEntry = {
  key: string;
  description: string;
  variables: readonly PromptOverrideVariable[];
  template: string;
  exampleContext: Record<string, string | number | undefined>;
};

const manifestEntries = promptOverrideManifest as readonly PromptOverrideManifestEntry[];

function requiredManifestEntry(key: string): PromptOverrideManifestEntry {
  const entry = manifestEntries.find((item) => item.key === key);
  if (!entry) throw new Error(`Missing prompt override manifest entry: ${key}`);
  return entry;
}

function promptOverrideDef<TContext extends Record<string, string | number | undefined>>(
  key: string,
  defaultBuilder?: (context: TContext) => string,
): PromptOverrideKeyDef<TContext> {
  const entry = requiredManifestEntry(key);
  return {
    key: entry.key,
    description: entry.description,
    variables: entry.variables,
    template: entry.template,
    defaultBuilder:
      defaultBuilder ??
      ((context) => {
        const defaultPrompt = context.defaultPrompt;
        return defaultPrompt === undefined || defaultPrompt === null ? entry.template : String(defaultPrompt);
      }),
    exampleContext: entry.exampleContext as TContext,
  };
}

const CONVERSATION_SELFIE_PROMPT_OVERRIDE = promptOverrideDef<ConversationSelfiePromptContext>(
  "conversation.selfie",
  () => requiredManifestEntry("conversation.selfie").template,
);

const SPRITE_PORTRAIT_SINGLE_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("sprite.portraitSingle");
const SPRITE_EXPRESSION_SHEET_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("sprite.expressionSheet");
const SPRITE_FULL_BODY_SINGLE_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("sprite.fullBodySingle");
const SPRITE_FULL_BODY_SHEET_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("sprite.fullBodySheet");
const SPRITE_FULL_BODY_EXPRESSION_SHEET_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>(
  "sprite.fullBodyExpressionSheet",
);
export const GAME_BACKGROUND_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("game.background");
export const GAME_ILLUSTRATION_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("game.illustration");
export const GAME_PORTRAIT_PROMPT_OVERRIDE = promptOverrideDef<ImagePromptOverrideContext>("game.portrait");

export const PROMPT_OVERRIDE_REGISTRY = [
  CONVERSATION_SELFIE_PROMPT_OVERRIDE,
  SPRITE_PORTRAIT_SINGLE_PROMPT_OVERRIDE,
  SPRITE_EXPRESSION_SHEET_PROMPT_OVERRIDE,
  SPRITE_FULL_BODY_SINGLE_PROMPT_OVERRIDE,
  SPRITE_FULL_BODY_SHEET_PROMPT_OVERRIDE,
  SPRITE_FULL_BODY_EXPRESSION_SHEET_PROMPT_OVERRIDE,
  GAME_BACKGROUND_PROMPT_OVERRIDE,
  GAME_ILLUSTRATION_PROMPT_OVERRIDE,
  GAME_PORTRAIT_PROMPT_OVERRIDE,
] as const;

type RegisteredPromptOverrideDef = (typeof PROMPT_OVERRIDE_REGISTRY)[number];

const REGISTRY_BY_KEY: ReadonlyMap<string, RegisteredPromptOverrideDef> = new Map(
  PROMPT_OVERRIDE_REGISTRY.map((definition) => [definition.key, definition]),
);

export function getPromptOverrideDef(key: string) {
  return REGISTRY_BY_KEY.get(key);
}

export function validatePromptOverrideTemplate(
  template: string,
  declared: readonly string[],
): TemplateValidationResult {
  const allowed = new Set(declared);
  const seen = new Set<string>();
  const unknownVariables: string[] = [];
  let searchIndex = 0;

  while (searchIndex < template.length) {
    const start = template.indexOf("${", searchIndex);
    if (start === -1) break;
    const end = template.indexOf("}", start + 2);
    const name = end === -1 ? template.slice(start + 2) : template.slice(start + 2, end);
    const reportedName = name || "<empty>";
    if (!seen.has(reportedName)) {
      seen.add(reportedName);
      if (end === -1 || !VARIABLE_NAME_PATTERN.test(name) || !allowed.has(name)) unknownVariables.push(reportedName);
    }
    if (end === -1) break;
    searchIndex = end + 1;
  }

  return { valid: unknownVariables.length === 0, unknownVariables };
}

export function renderPromptOverrideTemplate(
  template: string,
  context: Record<string, string | number | undefined>,
  declared: readonly string[],
): string {
  const allowed = new Set(declared);
  return template.replace(VARIABLE_PATTERN, (raw, name: string) => {
    if (!allowed.has(name)) return raw;
    const value = context[name];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function normalizePromptOverrideRow(row: unknown, fallbackKey?: string): PromptOverrideRow | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  const record = row as JsonRecord;
  const key = readString(record.key).trim() || readString(record.id).trim() || fallbackKey?.trim() || "";
  const template = readString(record.template);
  if (!key || !template.trim()) return null;
  return {
    key,
    template,
    enabled: boolish(record.enabled, true),
    updatedAt: readString(record.updatedAt).trim() || readString(record.createdAt).trim() || null,
  };
}

export async function loadRegisteredPrompt<TContext extends Record<string, string | number | undefined>>(
  storage: StorageGateway,
  definition: PromptOverrideKeyDef<TContext>,
  context: TContext,
): Promise<string> {
  try {
    const row = normalizePromptOverrideRow(
      await storage.get(PROMPT_OVERRIDE_COLLECTION, definition.key),
      definition.key,
    );
    if (row?.enabled) {
      const declared = definition.variables.map((variable) => variable.name);
      const validation = validatePromptOverrideTemplate(row.template, declared);
      if (validation.valid) {
        return renderPromptOverrideTemplate(row.template, context, declared);
      }
      console.warn(
        `[prompt-overrides] Falling back to default for ${definition.key}; unknown variables: ${validation.unknownVariables.join(", ")}`,
      );
    }
  } catch (error) {
    console.warn(`[prompt-overrides] Falling back to default for ${definition.key}`, error);
  }

  return definition.defaultBuilder(context);
}

function buildConversationSelfiePromptContext(input: {
  appearance: string;
  charName: string;
  selfieTagsBlock?: string;
}): ConversationSelfiePromptContext {
  return {
    appearance: input.appearance,
    charName: input.charName,
    selfieTagsBlock: input.selfieTagsBlock ?? "",
  };
}

export async function resolveConversationSelfieSystemPrompt(input: {
  storage: StorageGateway;
  chatPromptTemplate?: string | null;
  appearance: string;
  charName: string;
  selfieTagsBlock?: string;
}): Promise<string> {
  const context = buildConversationSelfiePromptContext(input);
  const declared = CONVERSATION_SELFIE_PROMPT_OVERRIDE.variables.map((variable) => variable.name);
  const chatPromptTemplate = input.chatPromptTemplate?.trim() ?? "";

  if (chatPromptTemplate) {
    const validation = validatePromptOverrideTemplate(chatPromptTemplate, declared);
    if (validation.valid) {
      return renderPromptOverrideTemplate(chatPromptTemplate, context, declared);
    }
    console.warn(
      `[prompt-overrides] Falling back from chat-scoped ${CONVERSATION_SELFIE_PROMPT_OVERRIDE.key}; unknown variables: ${validation.unknownVariables.join(", ")}`,
    );
  }

  return loadRegisteredPrompt(input.storage, CONVERSATION_SELFIE_PROMPT_OVERRIDE, context);
}
