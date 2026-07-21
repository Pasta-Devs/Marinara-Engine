// ──────────────────────────────────────────────
// Conversation: Transcript Sanitizers
// ──────────────────────────────────────────────
import { CLOCK_TOKEN_SOURCE, DATE_TIME_TOKEN_SOURCE, FULL_DATE_TOKEN_SOURCE } from "@marinara-engine/shared";

const DATE_TAG_RE = /<\/?date(?:="[^"]*")?>/gi;
const TIMESTAMP_TOKEN = String.raw`\[(?:${DATE_TIME_TOKEN_SOURCE}|${CLOCK_TOKEN_SOURCE}|${FULL_DATE_TOKEN_SOURCE})\]`;
const LEADING_TIMESTAMP_RE = new RegExp(`^(\\s*(?:[-*]\\s*)?)(?:${TIMESTAMP_TOKEN}\\s*)+`, "gim");
const SPEAKER_TIMESTAMP_RE = new RegExp(`^(\\s*(?:[-*]\\s*)?[^:\\n]{1,80}:\\s*)(?:${TIMESTAMP_TOKEN}\\s*)+`, "gim");

/** Collapse model-produced `Name: Name:` prefixes without touching later dialogue text. */
export function collapseDuplicateConversationSpeakerPrefixes(
  content: string,
  speakerNames: readonly string[],
): string {
  let cleaned = content;
  const uniqueSpeakerNames = new Set(speakerNames.map((speakerName) => speakerName.trim()).filter(Boolean));
  for (const speakerName of uniqueSpeakerNames) {
    const escapedName = speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(
      new RegExp(`(^|\\n)(\\s*(?:[-*]\\s*)?)(${escapedName}\\s*:\\s*)(?:${escapedName}\\s*:\\s*)+`, "gi"),
      "$1$2$3",
    );
  }
  return cleaned;
}

/**
 * Conversation mode adds prompt-only timestamps like [12:01] for DM time awareness.
 * Strip those when conversation text crosses into roleplay/game context.
 */
export function stripConversationPromptTimestamps(content: string): string {
  return content
    .replace(DATE_TAG_RE, "")
    .replace(LEADING_TIMESTAMP_RE, "$1")
    .replace(SPEAKER_TIMESTAMP_RE, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Remove model-leaked Conversation metadata before persistence. Merged group
 * replies keep their `Name:` boundaries because the client uses them to split
 * speakers; single and individual replies already have a server-owned speaker.
 */
export function stripConversationResponseEnvelope(
  content: string,
  options: {
    speakerName?: string | null;
    speakerNames?: readonly string[];
    preserveSpeakerPrefix?: boolean;
  } = {},
): string {
  let cleaned = stripConversationPromptTimestamps(content);
  const speakerName = options.speakerName?.trim();
  cleaned = collapseDuplicateConversationSpeakerPrefixes(
    cleaned,
    options.speakerNames ?? (speakerName ? [speakerName] : []),
  );
  if (!speakerName || options.preserveSpeakerPrefix) return cleaned;

  const escapedName = speakerName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  cleaned = cleaned
    .replace(new RegExp(`^\\s*${escapedName}\\s*:\\s*`, "i"), "")
    .replace(new RegExp(`^\\s*${escapedName}\\s*\\n+`, "i"), "")
    .trim();
  return cleaned;
}
