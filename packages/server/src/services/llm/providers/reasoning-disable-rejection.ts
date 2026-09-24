// ──────────────────────────────────────────────
// Reasoning-disable rejection memory (OpenAI-compatible Chat Completions)
// ──────────────────────────────────────────────
// Some models always reason (GLM 5.3 is the known case) and their gateways answer
// HTTP 400 when a request tries to turn reasoning off. The per-model rules in
// glm-request-compat.ts already avoid that for models we know about; this module
// is the general safety net for models we do not. The first rejection strips the
// disabling fields and the caller retries once; the model is then remembered per
// base URL so later requests never send the disable at all.

const MAX_REMEMBERED_MODELS = 256;

/**
 * Conservative match for a provider saying reasoning cannot be switched off.
 * Other 400s (bad parameter values, context length, content policy) never match.
 */
const REASONING_DISABLE_REJECTED =
  /(?:does not support|doesn't support|cannot|can't|can not)\s+(?:disabling|disable|turning off|turn off)\s+(?:the\s+)?(?:reasoning|thinking)|always\s+(?:thinks|reasons)\b/i;

const alwaysReasoningModels = new Set<string>();

function modelKey(baseUrl: string, model: string): string {
  return `${baseUrl.replace(/\/+$/, "").toLowerCase()}\u0000${model.toLowerCase()}`;
}

/** Test hook: forget every remembered always-reasoning model. */
export function resetReasoningDisableRejectionsForTests(): void {
  alwaysReasoningModels.clear();
}

export function isReasoningDisableRejectedModel(baseUrl: string, model: string): boolean {
  return alwaysReasoningModels.has(modelKey(baseUrl, model));
}

export function rememberReasoningDisableRejectedModel(baseUrl: string, model: string): void {
  const key = modelKey(baseUrl, model);
  if (alwaysReasoningModels.has(key)) return;
  if (alwaysReasoningModels.size >= MAX_REMEMBERED_MODELS) {
    const oldest = alwaysReasoningModels.values().next().value;
    if (oldest !== undefined) alwaysReasoningModels.delete(oldest);
  }
  alwaysReasoningModels.add(key);
}

export function isReasoningDisableRejectedError(errorText: string): boolean {
  return REASONING_DISABLE_REJECTED.test(errorText);
}

function reasoningObject(body: Record<string, unknown>): Record<string, unknown> | null {
  const value = body.reasoning;
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function thinkingDisabled(body: Record<string, unknown>): boolean {
  const value = body.thinking;
  return !!value && typeof value === "object" && (value as Record<string, unknown>).type === "disabled";
}

/** True when the request body explicitly turns reasoning off in any supported dialect. */
export function hasReasoningDisableFields(body: Record<string, unknown>): boolean {
  const reasoning = reasoningObject(body);
  return (
    body.enable_thinking === false ||
    thinkingDisabled(body) ||
    body.reasoning_effort === "none" ||
    reasoning?.enabled === false ||
    reasoning?.effort === "none"
  );
}

/**
 * Removes every reasoning-disable field so the provider applies its own default.
 * Returns true when anything was removed.
 */
export function stripReasoningDisableFields(body: Record<string, unknown>): boolean {
  let changed = false;
  if (body.enable_thinking === false) {
    delete body.enable_thinking;
    changed = true;
  }
  if (thinkingDisabled(body)) {
    delete body.thinking;
    changed = true;
  }
  if (body.reasoning_effort === "none") {
    delete body.reasoning_effort;
    changed = true;
  }
  const reasoning = reasoningObject(body);
  if (reasoning && (reasoning.enabled === false || reasoning.effort === "none")) {
    const next = { ...reasoning };
    if (next.enabled === false) delete next.enabled;
    if (next.effort === "none") delete next.effort;
    if (Object.keys(next).length > 0) body.reasoning = next;
    else delete body.reasoning;
    changed = true;
  }
  return changed;
}
