import type { CharacterCommand, SelfieCommand } from "../conversation/character-commands.js";

const SELFIE_WORD_RE = /\b(?:selfie|photo|pic|picture|image)\b/i;
const USER_SELFIE_REQUEST_RE =
  /\b(?:send|show|share|take|snap|give|attach|post|can\s+i\s+see|could\s+i\s+see|let\s+me\s+see|want|wanna)\b[\s\S]{0,120}\b(?:selfie|photo|pic|picture)\b|\b(?:selfie|photo|pic|picture)\b[\s\S]{0,80}\b(?:please|pls|send|show|share|take|snap)\b/i;
const ASSISTANT_SELFIE_CLAIM_RE =
  /\b(?:send|sent|sending|share|shares|shared|attach|attaches|attached|post|posts|posted|take|takes|took|snap|snaps|snapped)\b[\s\S]{0,120}\b(?:selfie|photo|pic|picture)\b|\[\s*[^\]]{0,80}\b(?:send|sends|sent|share|shares|take|takes|snap|snaps)\b[^\]]{0,120}\b(?:selfie|photo|pic|picture)\b[^\]]*\]/i;

function inferSelfieContextFromResponse(response: string): string | undefined {
  const compact = response.replace(/\s+/g, " ").trim();
  if (!compact) return undefined;
  const bracketMatch = compact.match(/\[[^\]]*\b(?:selfie|photo|pic|picture)\b[^\]]*\]/i);
  const source = bracketMatch?.[0] ?? compact;
  const context = source
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/^.*?\b(?:selfie|photo|pic|picture)\b[:\s-]*/i, "")
    .trim()
    .slice(0, 240);
  return context || undefined;
}

export function recoverImplicitSelfieCommand(args: {
  response: string;
  latestUserMessage?: string | null;
  imageGenerationEnabled: boolean;
  existingCommands: CharacterCommand[];
}): SelfieCommand | null {
  if (!args.imageGenerationEnabled) return null;
  if (args.existingCommands.some((command) => command.type === "selfie")) return null;
  const response = args.response.trim();
  if (!SELFIE_WORD_RE.test(response)) return null;
  const userAskedForSelfie = USER_SELFIE_REQUEST_RE.test(args.latestUserMessage ?? "");
  const assistantClaimsSelfie = ASSISTANT_SELFIE_CLAIM_RE.test(response);
  if (!userAskedForSelfie && !assistantClaimsSelfie) return null;
  return { type: "selfie", context: inferSelfieContextFromResponse(response) };
}
