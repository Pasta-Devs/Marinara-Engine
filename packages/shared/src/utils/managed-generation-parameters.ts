import {
  managedGenerationParameterDefinitionSchema,
  MAX_MANAGED_GENERATION_PARAMETER_DEFINITIONS,
} from "../schemas/app-settings.schema.js";
import type { ManagedGenerationParameterDefinition, ManagedGenerationParameterValueMap } from "../types/prompt.js";

const RESERVED_REQUEST_KEYS = new Set(
  [
    "frequency_penalty",
    "max_tokens",
    "messages",
    "model",
    "__proto__",
    "constructor",
    "presence_penalty",
    "prototype",
    "reasoning_effort",
    "service_tier",
    "stop",
    "stream",
    "temperature",
    "tool_choice",
    "tools",
    "top_k",
    "top_p",
    "verbosity",
  ].map((key) => key.toLowerCase()),
);

export function isReservedManagedGenerationParameterKey(requestKey: string): boolean {
  return RESERVED_REQUEST_KEYS.has(requestKey.trim().toLowerCase());
}

export function parseManagedGenerationParameterDefinitions(raw: unknown): ManagedGenerationParameterDefinition[] {
  let parsed = raw;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const definitions: ManagedGenerationParameterDefinition[] = [];
  const usedIds = new Set<string>();
  const usedKeys = new Set<string>();
  for (const candidate of parsed.slice(0, MAX_MANAGED_GENERATION_PARAMETER_DEFINITIONS)) {
    const result = managedGenerationParameterDefinitionSchema.safeParse(candidate);
    if (!result.success) continue;
    const definition = result.data;
    const normalizedKey = definition.requestKey.toLowerCase();
    if (
      definition.min > definition.max ||
      usedIds.has(definition.id) ||
      usedKeys.has(normalizedKey) ||
      isReservedManagedGenerationParameterKey(definition.requestKey)
    ) {
      continue;
    }
    usedIds.add(definition.id);
    usedKeys.add(normalizedKey);
    definitions.push({
      ...definition,
      ...(definition.tooltip ? { tooltip: definition.tooltip } : {}),
    });
  }
  return definitions;
}

function clampManagedValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolve connection/chat managed values into provider request parameters.
 * Later value maps take precedence, so an explicit chat disable overrides an
 * enabled connection default. Definitions are the authority: deleted or
 * invalid definitions can never leak stale stored values into a request.
 */
export function resolveManagedGenerationParameters(
  definitions: ManagedGenerationParameterDefinition[],
  ...valueMaps: Array<ManagedGenerationParameterValueMap | null | undefined>
): Record<string, number> {
  const resolved: Record<string, number> = {};
  for (const definition of definitions) {
    let selected: { enabled: boolean; value: number } | undefined;
    for (const valueMap of valueMaps) {
      if (valueMap && Object.prototype.hasOwnProperty.call(valueMap, definition.id)) {
        selected = valueMap[definition.id];
      }
    }
    if (!selected?.enabled || !Number.isFinite(selected.value)) continue;
    resolved[definition.requestKey] = clampManagedValue(selected.value, definition.min, definition.max);
  }
  return resolved;
}
