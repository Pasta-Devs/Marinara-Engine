// ──────────────────────────────────────────────
// Conversation-mode profile injection — display name, "about me",
// and behavior directive. Composed ONLY from the conversation branch of
// the generate route, so none of these fields can reach RP/VN/Game prompts.
// ──────────────────────────────────────────────
import type { CharacterData, ConvoBehaviorConfig, ConvoBehaviorInsertionStrategy } from "@marinara-engine/shared";

/** A present participant (character or the user's persona) with resolved Convo profile fields. */
export interface ConversationProfileParticipant {
  /** Character id, or persona id for the user's persona. */
  id: string;
  /** Base card/persona name. */
  name: string;
  /** Effective display name (convoDisplayName || name). */
  displayName: string;
  /** Effective about-me (per-chat override ?? card/persona default). May be empty. */
  aboutMe: string;
  /** The user's persona vs an AI character. */
  isPersona: boolean;
  /** Convo behavior directive, if any. */
  behavior?: ConvoBehaviorConfig | null;
  /** The character's post_history_instructions text (for post_history_* strategies). */
  postHistoryInstructions?: string;
}

export interface ConversationProfileBlocks {
  /** Labeled about-me block for the system prompt ("" when disabled or none present). */
  aboutMeBlock: string;
  /** Behavior directives to place before the main instructions. */
  behaviorConstantBefore: string;
  /** Behavior directives to place after the main instructions. */
  behaviorConstantAfter: string;
  /** Behavior directives to inject as an end-of-history block (the convo analog of post-history). */
  behaviorPostHistoryBlock: string;
  /** Values for the Convo-only macros; assigned to MacroContext.convoFields inside the convo branch only. */
  convoFields: {
    charDisplayName?: string;
    charAbout?: string;
    personaAbout?: string;
    convoBehavior?: string;
  };
}

/** Read a character's Convo extension fields defensively (extensions may be absent/partial). */
export function readCharacterConvoFields(data: CharacterData | null | undefined): {
  convoDisplayName: string;
  aboutMe: string;
  convoBehavior: ConvoBehaviorConfig | null;
  postHistoryInstructions: string;
} {
  const ext = (data?.extensions ?? {}) as Record<string, unknown>;
  const behavior =
    ext.convoBehavior && typeof ext.convoBehavior === "object"
      ? (ext.convoBehavior as ConvoBehaviorConfig)
      : null;
  return {
    convoDisplayName: typeof ext.convoDisplayName === "string" ? ext.convoDisplayName : "",
    aboutMe: typeof ext.aboutMe === "string" ? ext.aboutMe : "",
    convoBehavior: behavior && typeof behavior.instruction === "string" ? behavior : null,
    postHistoryInstructions: typeof data?.post_history_instructions === "string" ? data.post_history_instructions : "",
  };
}

/** Parse a persona's convoBehavior JSON string column into a config (or null). */
export function parsePersonaConvoBehavior(raw: unknown): ConvoBehaviorConfig | null {
  if (!raw) return null;
  if (typeof raw === "object") {
    const b = raw as ConvoBehaviorConfig;
    return typeof b.instruction === "string" ? b : null;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as ConvoBehaviorConfig;
      return parsed && typeof parsed.instruction === "string" ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Resolve a behavior directive's placement text for a given strategy. */
function resolveBehaviorText(
  strategy: ConvoBehaviorInsertionStrategy,
  instruction: string,
  postHistory: string,
): string {
  const trimmedInstruction = instruction.trim();
  const trimmedPost = postHistory.trim();
  switch (strategy) {
    case "post_history_replace":
      return trimmedInstruction;
    case "post_history_before":
      return [trimmedInstruction, trimmedPost].filter(Boolean).join("\n\n");
    case "post_history_after":
      return [trimmedPost, trimmedInstruction].filter(Boolean).join("\n\n");
    default:
      return trimmedInstruction;
  }
}

/**
 * Build the Convo profile prompt blocks + macro fields.
 * `resolveMacros` is the convo-branch macro resolver; behavior/about text may contain macros.
 */
export function buildConversationProfileBlocks(args: {
  participants: ConversationProfileParticipant[];
  /** Id of the primary/responding character — drives the single-character {{char_*}} macros. */
  primaryCharacterId: string | null;
  /** chatMeta.conversationAboutMeInject (default true). */
  autoInjectAbout: boolean;
  isGroup: boolean;
  resolveMacros: (value: string) => string;
}): ConversationProfileBlocks {
  const { participants, primaryCharacterId, autoInjectAbout, isGroup, resolveMacros } = args;

  const characters = participants.filter((p) => !p.isPersona);
  const persona = participants.find((p) => p.isPersona) ?? null;
  const primary =
    characters.find((p) => p.id === primaryCharacterId) ?? characters[0] ?? null;

  // ── About-me block (all present participants) ──
  let aboutMeBlock = "";
  if (autoInjectAbout) {
    const lines: string[] = [];
    for (const p of participants) {
      const about = resolveMacros(p.aboutMe ?? "").trim();
      if (!about) continue; // authentic: some participants simply have no bio
      const who = p.isPersona ? `${p.displayName} (the user you're talking to)` : p.displayName;
      lines.push(`- ${who}: ${about}`);
    }
    if (lines.length > 0) {
      aboutMeBlock =
        `Participant profiles — each person's "about me". These are self-authored bios; treat them as how each person chooses to present themselves, and take them at face value.\n` +
        lines.join("\n");
    }
  }

  // ── Behavior directives ──
  const beforeParts: string[] = [];
  const afterParts: string[] = [];
  const postHistoryParts: string[] = [];

  const label = (p: ConversationProfileParticipant, text: string): string => {
    if (!isGroup) return text;
    const who = p.isPersona ? `about the user (${p.displayName})` : `for ${p.displayName}`;
    return `Instructions ${who}:\n${text}`;
  };

  for (const p of participants) {
    const behavior = p.behavior;
    if (!behavior || !behavior.instruction?.trim()) continue;
    if (behavior.insertionStrategy === "macro") continue; // only via {{convo_behavior}}
    const resolved = resolveMacros(
      resolveBehaviorText(behavior.insertionStrategy, behavior.instruction, p.postHistoryInstructions ?? ""),
    ).trim();
    if (!resolved) continue;
    const labeled = label(p, resolved);
    switch (behavior.insertionStrategy) {
      case "constant_before":
        beforeParts.push(labeled);
        break;
      case "constant_after":
        afterParts.push(labeled);
        break;
      default:
        postHistoryParts.push(labeled);
        break;
    }
  }

  const convoFields: ConversationProfileBlocks["convoFields"] = {};
  if (primary) {
    convoFields.charDisplayName = primary.displayName;
    convoFields.charAbout = primary.aboutMe ?? "";
    if (primary.behavior?.instruction?.trim()) convoFields.convoBehavior = primary.behavior.instruction;
  }
  if (persona) convoFields.personaAbout = persona.aboutMe ?? "";

  return {
    aboutMeBlock,
    behaviorConstantBefore: beforeParts.join("\n\n"),
    behaviorConstantAfter: afterParts.join("\n\n"),
    behaviorPostHistoryBlock: postHistoryParts.join("\n\n"),
    convoFields,
  };
}
