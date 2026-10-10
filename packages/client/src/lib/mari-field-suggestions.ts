import type { ProfessorMariCapability } from "@marinara-engine/shared";

// Local, LLM-free "what would help here" heuristic. Given the text a user is
// looking at (a character field or a chat draft), pick the single most useful
// Mari suggestion. Pure and synchronous so the caller can run it on a debounce.

export interface MariFieldSuggestion {
  /** Short chip label, e.g. "Suggest a greeting". English fallback for `labelKey`. */
  label: string;
  /** Localization key for `label`. */
  labelKey: string;
  /** Interpolation values for `labelKey`. */
  labelValues?: Record<string, string>;
  /** Capability the handoff should carry. */
  capability: ProfessorMariCapability;
  /** Draft query pre-filled into the Mari assistant. */
  draft: string;
}

export interface MariFieldInput {
  surface: "character-editor" | "chat";
  /** Which field is focused in the character editor (first_mes, personality, …). */
  field?: string;
  /** Current text of that field / the chat draft. */
  value: string;
  /** Name of the character being edited or chatted with, for nicer drafts. */
  subject?: string;
}

const UNBALANCED_HANDLEBARS = /\{\{(?![^{}]*\}\})/;
const REPEATED_SENTENCE = /([.!?]\s+)([A-Z][^.!?]{8,}[.!?])\s+\1?\2/;

function subjectRef(subject?: string) {
  return subject?.trim() ? subject.trim() : "this character";
}

/** Returns the best single suggestion, or null when nothing beats the generic chip. */
export function suggestMariAction(input: MariFieldInput): MariFieldSuggestion | null {
  const value = input.value ?? "";
  const trimmed = value.trim();

  // Highest priority: a broken template token is an objective defect.
  if (UNBALANCED_HANDLEBARS.test(value)) {
    return {
      label: "Fix a broken token",
      labelKey: "mari.fieldSuggestion.fixToken",
      capability: "repair",
      draft: `Find and fix the broken {{ }} template token in this ${input.field ?? "text"}.`,
    };
  }

  if (input.surface === "chat") {
    if (!trimmed) {
      return {
        label: "Continue the scene",
        labelKey: "mari.fieldSuggestion.continueScene",
        capability: "create",
        draft: `Continue the current scene with ${input.subject?.trim() || "the active character"}.`,
      };
    }
    if (trimmed.endsWith("?")) {
      return {
        label: `Ask about ${subjectRef(input.subject)}`,
        labelKey: "mari.fieldSuggestion.askAbout",
        labelValues: { subject: subjectRef(input.subject) },
        capability: "explain",
        draft: trimmed,
      };
    }
    if (/\b(?:remove|cut|shorten|rewrite|change|improve|fix|make)\b/i.test(trimmed)) {
      return {
        label: "Refine this request",
        labelKey: "mari.fieldSuggestion.refineRequest",
        capability: "edit",
        draft: trimmed,
      };
    }
    return {
      label: "Improve this reply",
      labelKey: "mari.fieldSuggestion.improveReply",
      capability: "edit",
      draft: `Improve this reply while keeping its intent: ${trimmed}`,
    };
  }

  // character-editor surface below.
  if (!trimmed) {
    if (input.field === "first_mes") {
      return {
        label: "Suggest a greeting",
        labelKey: "mari.fieldSuggestion.suggestGreeting",
        capability: "create",
        draft: `Write a greeting for ${subjectRef(input.subject)}.`,
      };
    }
    if (input.field === "personality") {
      return {
        label: "Draft a personality",
        labelKey: "mari.fieldSuggestion.draftPersonality",
        capability: "create",
        draft: `Draft a personality for ${subjectRef(input.subject)} from the description.`,
      };
    }
    return {
      label: "Help me fill this",
      labelKey: "mari.fieldSuggestion.helpFill",
      capability: "create",
      draft: `Help me write the ${input.field ?? "field"} for ${subjectRef(input.subject)}.`,
    };
  }

  if (trimmed.length < 40) {
    return {
      label: "Expand this",
      labelKey: "mari.fieldSuggestion.expand",
      capability: "edit",
      draft: `Expand this ${input.field ?? "text"} with more detail.`,
    };
  }

  if (trimmed.length > 600 || REPEATED_SENTENCE.test(trimmed)) {
    return {
      label: "Tighten this",
      labelKey: "mari.fieldSuggestion.tighten",
      capability: "edit",
      draft: `Tighten this ${input.field ?? "text"}; cut repetition and keep it crisp.`,
    };
  }

  return null;
}
