import { findKnownModel, type APIProvider } from "@marinara-engine/shared";

function resolveKnownMaxOutputTokens(provider: APIProvider | string | null | undefined, model: string): number | null {
  const knownModel = provider ? findKnownModel(provider as APIProvider, model.trim()) : undefined;
  return knownModel?.maxOutput && knownModel.maxOutput > 0 ? Math.floor(knownModel.maxOutput) : null;
}

export function clampGenerationMaxOutputTokens(args: {
  provider: APIProvider | string | null | undefined;
  model: string;
  maxTokens: number;
  maxTokensOverride?: number | null;
}): number {
  let capped = Math.max(1, Math.floor(args.maxTokens));
  const knownMaxOutput = resolveKnownMaxOutputTokens(args.provider, args.model);
  if (knownMaxOutput !== null) capped = Math.min(capped, knownMaxOutput);
  if (
    typeof args.maxTokensOverride === "number" &&
    Number.isFinite(args.maxTokensOverride) &&
    args.maxTokensOverride > 0
  ) {
    capped = Math.min(capped, Math.floor(args.maxTokensOverride));
  }
  return capped;
}
