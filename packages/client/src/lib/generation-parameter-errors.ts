const PARAMETER_LABELS: Record<string, string> = {
  temperature: "Temperature",
  temp: "Temperature",
  max_tokens: "Max Output Tokens",
  max_completion_tokens: "Max Output Tokens",
  max_output_tokens: "Max Output Tokens",
  maxTokens: "Max Output Tokens",
  top_p: "Top P",
  topP: "Top P",
  top_k: "Top K",
  topK: "Top K",
  frequency_penalty: "Frequency",
  frequencyPenalty: "Frequency",
  presence_penalty: "Presence",
  presencePenalty: "Presence",
  reasoning_effort: "Reasoning Effort",
  reasoningEffort: "Reasoning Effort",
  verbosity: "Verbosity",
};

function normalizeParameterName(raw: string) {
  return raw
    .trim()
    .replace(/^[`'"\s[{(]+|[`'"\s\]}).,:;]+$/g, "")
    .replace(/^parameters?\./i, "");
}

function labelParameter(raw: string) {
  const normalized = normalizeParameterName(raw);
  return PARAMETER_LABELS[normalized] ?? PARAMETER_LABELS[normalized.replace(/-/g, "_")] ?? normalized;
}

function extractParameter(message: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (!match?.[1]) continue;
    const firstParam = match[1].split(/[,;]/)[0]?.trim();
    if (firstParam) return labelParameter(firstParam);
  }
  return null;
}

function isPrivilegedAccessError(message: string): boolean {
  return /\b(?:ADMIN_SECRET|X-Admin-Secret|Basic Auth|privileged APIs?|privileged API|authenticated access)\b/i.test(message);
}

export function formatGenerationParameterError(message: string): string {
  if (isPrivilegedAccessError(message)) return message;

  const unsupported = extractParameter(message, [
    /\bunsupported parameters?\b[:\s]+([A-Za-z0-9_.-]+)/i,
    /\bunknown parameters?\b[:\s]+([A-Za-z0-9_.-]+)/i,
    /\bunrecognized (?:request )?(?:argument|parameter)s?(?: supplied)?[:\s]+([A-Za-z0-9_.-]+)/i,
    /\b(?:does not|doesn't) (?:accept|support)\b.{0,40}\b(?:argument|parameter|field)\b[:\s]+([A-Za-z0-9_.-]+)/i,
  ]);
  if (unsupported) {
    return `The model does not accept the ${unsupported} parameter. Go to Chat Settings > Advanced Parameters and turn off Send for ${unsupported}.`;
  }
  if (/\bunsupported parameters?\b|\bunknown parameters?\b|\bunrecognized (?:request )?(?:argument|parameter)/i.test(message)) {
    return "The model does not accept one of the enabled advanced parameters. Go to Chat Settings > Advanced Parameters and turn off Send for unsupported fields, then try again.";
  }

  const missing = extractParameter(message, [
    /\bmissing (?:required )?parameters?\b[:\s]+([A-Za-z0-9_.-]+)/i,
    /\brequired parameters?\b[:\s]+([A-Za-z0-9_.-]+)/i,
    /\b([A-Za-z_][A-Za-z0-9_.-]*)\b.{0,40}\bis required/i,
  ]);
  if (missing) {
    if (missing.toLowerCase() === "model") {
      return "The provider says the model field is missing. Marinara now sends the configured connection model automatically; if this keeps happening, remove any custom request parameter named model or re-save the connection's model.";
    }
    return `The model says the ${missing} parameter is required. Go to Chat Settings > Advanced Parameters and turn on Send for ${missing}.`;
  }
  if (/\bmissing (?:required )?parameters?\b|\brequired parameters?\b/i.test(message)) {
    return "The model says a required advanced parameter is missing. Go to Chat Settings > Advanced Parameters and turn on Send for the required field, then try again.";
  }

  return message;
}
