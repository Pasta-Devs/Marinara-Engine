import {
  PROMPT_OVERRIDE_COLLECTION,
  PROMPT_OVERRIDE_REGISTRY,
  getPromptOverrideDef,
  normalizePromptOverrideRow,
  renderPromptOverrideTemplate,
  validatePromptOverrideTemplate,
  type PromptOverrideDefault,
  type PromptOverrideDetail,
  type PromptOverrideRow,
  type PromptOverrideSummary,
} from "../../../../engine/generation/prompt-overrides";
import { ApiError } from "../../../../shared/api/api-errors";
import { storageApi } from "../../../../shared/api/storage-api";

type StoredPromptOverride = Record<string, unknown>;

function declaredVariables(key: string): string[] {
  const definition = getPromptOverrideDef(key);
  return definition?.variables.map((variable) => variable.name) ?? [];
}

function unknownPromptKey(key: string): ApiError {
  return new ApiError(`Unknown prompt key: ${key}`, 404, { error: "Unknown prompt key", key });
}

async function readPromptOverride(key: string): Promise<PromptOverrideRow | null> {
  return normalizePromptOverrideRow(await storageApi.get<StoredPromptOverride>(PROMPT_OVERRIDE_COLLECTION, key), key);
}

export const promptOverridesApi = {
  async list(): Promise<PromptOverrideSummary[]> {
    const rows = await storageApi.list<StoredPromptOverride>(PROMPT_OVERRIDE_COLLECTION);
    const overrideByKey = new Map<string, PromptOverrideRow>();
    for (const row of rows) {
      const normalized = normalizePromptOverrideRow(row);
      if (normalized) overrideByKey.set(normalized.key, normalized);
    }

    return PROMPT_OVERRIDE_REGISTRY.map((definition) => {
      const row = overrideByKey.get(definition.key);
      return {
        key: definition.key,
        description: definition.description,
        variables: definition.variables,
        hasOverride: !!row,
        enabled: row?.enabled ?? false,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  },

  async get(key: string): Promise<PromptOverrideDetail> {
    const definition = getPromptOverrideDef(key);
    if (!definition) throw unknownPromptKey(key);
    return {
      key: definition.key,
      description: definition.description,
      variables: definition.variables,
      override: await readPromptOverride(definition.key),
    };
  },

  async getDefault(key: string): Promise<PromptOverrideDefault> {
    const definition = getPromptOverrideDef(key);
    if (!definition) throw unknownPromptKey(key);
    return {
      key: definition.key,
      template: definition.template,
      exampleContext: definition.exampleContext,
    };
  },

  async save(input: { key: string; template: string; enabled: boolean }): Promise<PromptOverrideRow> {
    const definition = getPromptOverrideDef(input.key);
    if (!definition) throw unknownPromptKey(input.key);
    if (!input.template.trim()) {
      throw new ApiError("Template must not be empty", 400, { error: "Template must not be empty" });
    }

    const validation = validatePromptOverrideTemplate(input.template, declaredVariables(definition.key));
    if (!validation.valid) {
      throw new ApiError("Template references unknown variables", 400, {
        error: "Template references unknown variables",
        unknownVariables: validation.unknownVariables,
        declaredVariables: declaredVariables(definition.key),
      });
    }

    const updatedAt = new Date().toISOString();
    const row = await readPromptOverride(definition.key);
    const payload = {
      key: definition.key,
      template: input.template,
      enabled: input.enabled,
      updatedAt,
    };
    const saved = row
      ? await storageApi.update<StoredPromptOverride>(PROMPT_OVERRIDE_COLLECTION, definition.key, payload)
      : await storageApi.create<StoredPromptOverride>(PROMPT_OVERRIDE_COLLECTION, {
          id: definition.key,
          ...payload,
        });

    return normalizePromptOverrideRow(saved, definition.key) ?? { ...payload, updatedAt };
  },

  async reset(key: string): Promise<void> {
    const definition = getPromptOverrideDef(key);
    if (!definition) throw unknownPromptKey(key);
    await storageApi.delete(PROMPT_OVERRIDE_COLLECTION, definition.key);
  },

  preview(key: string, template: string, context?: Record<string, string | number | undefined>): { rendered: string } {
    const definition = getPromptOverrideDef(key);
    if (!definition) throw unknownPromptKey(key);
    const declared = declaredVariables(definition.key);
    const validation = validatePromptOverrideTemplate(template, declared);
    if (!validation.valid) {
      throw new ApiError("Template references unknown variables", 400, {
        error: "Template references unknown variables",
        unknownVariables: validation.unknownVariables,
        declaredVariables: declared,
      });
    }
    return {
      rendered: renderPromptOverrideTemplate(template, { ...definition.exampleContext, ...(context ?? {}) }, declared),
    };
  },
};
