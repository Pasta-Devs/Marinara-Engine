/** Private continuation context is never part of main-prompt or cross-agent output. */
export function publicAgentOutput(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const { "agent-context": _context, agentContext: _alias, ...output } = data as Record<string, unknown>;
  return output;
}

export function previousAgentOutputText(data: unknown): string {
  if (data == null) return "";
  const record = typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const hasContext = record && (Object.hasOwn(record, "agent-context") || Object.hasOwn(record, "agentContext"));
  const value = hasContext
    ? ((Object.hasOwn(record, "agent-context") ? record["agent-context"] : record.agentContext) ?? "")
    : (record?.text ?? data);
  return typeof value === "string" ? value : JSON.stringify(value);
}
