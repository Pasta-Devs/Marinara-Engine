export const MAX_MARI_FETCHED_PRESET_CONTEXT_CHARS = 8000;

type AssistantPresetWrapFormat = "xml" | "markdown" | "none";
type AssistantPresetRole = "system" | "user" | "assistant";
type AssistantPresetInjectionPosition = "ordered" | "depth";

const ASSISTANT_PRESET_WRAP_FORMATS = new Set<AssistantPresetWrapFormat>(["xml", "markdown", "none"]);
const ASSISTANT_PRESET_ROLES = new Set<AssistantPresetRole>(["system", "user", "assistant"]);
const ASSISTANT_PRESET_INJECTION_POSITIONS = new Set<AssistantPresetInjectionPosition>(["ordered", "depth"]);

export function resolveAssistantPresetWrapFormat(value: unknown): AssistantPresetWrapFormat {
  return typeof value === "string" && ASSISTANT_PRESET_WRAP_FORMATS.has(value as AssistantPresetWrapFormat)
    ? (value as AssistantPresetWrapFormat)
    : "xml";
}

export function resolveAssistantPresetRole(value: unknown): AssistantPresetRole {
  return typeof value === "string" && ASSISTANT_PRESET_ROLES.has(value as AssistantPresetRole)
    ? (value as AssistantPresetRole)
    : "system";
}

export function resolveAssistantPresetInjectionPosition(value: unknown): AssistantPresetInjectionPosition {
  return typeof value === "string" &&
    ASSISTANT_PRESET_INJECTION_POSITIONS.has(value as AssistantPresetInjectionPosition)
    ? (value as AssistantPresetInjectionPosition)
    : "ordered";
}

export function normalizeAssistantPresetIdentifier(
  value: string | undefined,
  fallbackIndex: number,
  used: Set<string>,
): string {
  const base =
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || `mari_section_${fallbackIndex + 1}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function normalizeAssistantPresetVariableName(value: unknown, fallbackIndex: number, used: Set<string>): string {
  const source = typeof value === "string" ? value : "";
  const base =
    source
      .trim()
      .replace(/[^\w]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || `choice_${fallbackIndex + 1}`;
  let candidate = /^\w+$/.test(base) ? base : `choice_${fallbackIndex + 1}`;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function normalizeAssistantPresetOptionId(
  value: string | undefined,
  fallbackIndex: number,
  used: Set<string>,
): string {
  const base =
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || `option_${fallbackIndex + 1}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function truncateMariFetchedText(value: unknown, maxLength = 4000): string {
  const text = String(value ?? "");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated ${text.length - maxLength} chars]`;
}

export function parseMariJsonRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function parseMariJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
