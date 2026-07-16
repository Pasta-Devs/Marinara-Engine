export const FALLBACK_CONVERSATION_TIME_ZONE = "UTC";

export function isValidConversationTimeZone(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const timeZone = value.trim();
  if (!timeZone || timeZone.length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function detectConversationTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isValidConversationTimeZone(detected) ? detected : FALLBACK_CONVERSATION_TIME_ZONE;
}

export function normalizeConversationTimeZone(value: unknown): string {
  return isValidConversationTimeZone(value) ? value.trim() : detectConversationTimeZone();
}

export function listConversationTimeZones(selectedTimeZone?: string): string[] {
  const supportedValuesOf = (
    Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf;
  const supported = supportedValuesOf ? supportedValuesOf("timeZone") : [];
  return Array.from(
    new Set([
      FALLBACK_CONVERSATION_TIME_ZONE,
      detectConversationTimeZone(),
      ...(isValidConversationTimeZone(selectedTimeZone) ? [selectedTimeZone.trim()] : []),
      ...supported,
    ]),
  ).sort((left, right) => left.localeCompare(right));
}

export function formatConversationTimeZone(timeZone: string, now = new Date()): string {
  const location = timeZone.replaceAll("_", " ").replaceAll("/", " / ");
  try {
    const offset = new Intl.DateTimeFormat(undefined, {
      timeZone,
      timeZoneName: "longOffset",
    })
      .formatToParts(now)
      .find((part) => part.type === "timeZoneName")?.value;
    return offset ? `${location} (${offset})` : location;
  } catch {
    return location;
  }
}
