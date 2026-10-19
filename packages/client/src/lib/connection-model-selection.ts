// What picking a model changes on a connection, and the merged model list a picker shows. The full
// connection editor and the quick model pickers share these, so a pick has the same effect everywhere.
import {
  rankModelMatch,
  type APIProvider,
  type ConnectionModelCost,
  type KnownModel,
  type ModelParameterCapabilities,
} from "@marinara-engine/shared";

/** A model as a provider's model list reports it (see GET /connections/:id/models). */
export type RemoteConnectionModel = {
  id: string;
  name: string;
  context?: number;
  maxOutput?: number;
  capabilities?: ModelParameterCapabilities;
  /** NanoGPT: whether the model is covered by the subscription. */
  subscriptionIncluded?: boolean;
  /** NanoGPT: input tokens charged per token of subscription quota (2 = 2x). */
  inputTokenMultiplier?: number;
  /** The cost badge the server worked out; left out when unknown. */
  cost?: Exclude<ConnectionModelCost, null>;
  deprecated?: true;
  /** When the provider retires the model (ISO date). */
  retiresAt?: string;
};

export type ConnectionModelOption = {
  id: string;
  name: string;
  context: number;
  maxOutput: number;
  capabilities?: ModelParameterCapabilities;
  subscriptionIncluded?: boolean;
  inputTokenMultiplier?: number;
  cost?: Exclude<ConnectionModelCost, null>;
  deprecated?: true;
  retiresAt?: string;
  /** Came from the provider's own list rather than Marinara's built-in one. */
  isRemote: boolean;
};

const STALE_GROK_CLI_MODEL_IDS = new Set(["grok-build-latest", "grok-build-0.1"]);

/** Grok CLI retired these IDs; an empty model makes the CLI use its own default. */
export function normalizeGrokCliEditorModel(provider: APIProvider | string, model: string): string {
  return provider === "grok_subscription" && STALE_GROK_CLI_MODEL_IDS.has(model.trim()) ? "" : model;
}

/**
 * The connection fields a model pick sets: the model, its context window when known, and the provider's
 * output limit when the provider's own list reports one. Every other field, such as the vision, image or
 * embedding model, is left alone.
 */
export function connectionFieldsForModelPick(
  provider: APIProvider | string,
  model: { id: string; context?: number; maxOutput?: number; isRemote?: boolean },
): { model: string; maxContext?: number; maxTokensOverride?: number } {
  return {
    model: normalizeGrokCliEditorModel(provider, model.id),
    ...(model.context ? { maxContext: Number(model.context) } : {}),
    ...(model.isRemote && model.maxOutput ? { maxTokensOverride: Number(model.maxOutput) } : {}),
  };
}

/** The provider's list first, then Marinara's built-in models it did not report, each ID once. */
export function mergeConnectionModelOptions(
  remoteModels: readonly RemoteConnectionModel[],
  knownModels: readonly KnownModel[],
): ConnectionModelOption[] {
  const seen = new Set<string>();
  const options: ConnectionModelOption[] = [];
  for (const model of remoteModels) {
    if (!model.id || seen.has(model.id)) continue;
    seen.add(model.id);
    options.push({
      id: model.id,
      name: model.name || model.id,
      context: model.context ?? 0,
      maxOutput: model.maxOutput ?? 0,
      capabilities: model.capabilities,
      subscriptionIncluded: model.subscriptionIncluded,
      inputTokenMultiplier: model.inputTokenMultiplier,
      cost: model.cost,
      deprecated: model.deprecated,
      retiresAt: model.retiresAt,
      isRemote: true,
    });
  }
  for (const model of knownModels) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    options.push({ ...model, subscriptionIncluded: undefined, inputTokenMultiplier: undefined, isRemote: false });
  }
  return options;
}

/** Models whose ID or name contains the search text, ignoring case; prefix matches first (decision 27). */
export function filterConnectionModelOptions<T extends { id: string; name: string }>(
  options: readonly T[],
  search: string,
): readonly T[] {
  if (!search.trim()) return options;
  return options
    .map((model) => ({ model, rank: rankModelMatch(search, model) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .map((entry) => entry.model);
}
