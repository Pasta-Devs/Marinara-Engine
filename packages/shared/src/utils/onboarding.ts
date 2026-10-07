// ──────────────────────────────────────────────
// Interactive onboarding ("skeleton persona")
//
// A card's `extensions.onboarding` holds the five persona Card fields as prose
// that may use `{{variable}}` and `{{#if}}`, plus the variables the player
// answers. Everything here leans on the macro engine — there is no onboarding
// parser: which questions are relevant is whatever the engine actually reads
// while resolving the fields with the answers given so far.
// ──────────────────────────────────────────────
import type { CharacterOnboarding, CharacterOnboardingVariable } from "../types/character.js";
import { isReservedMacroName } from "./chat-variables.js";
import { resolveMacros } from "./macro-engine.js";

/** A variable with this name supplies the created persona's name. */
export const ONBOARDING_PLAYER_VARIABLE = "player";

export const ONBOARDING_PERSONA_FIELDS = ["description", "personality", "backstory", "appearance", "scenario"] as const;
export type OnboardingPersonaField = (typeof ONBOARDING_PERSONA_FIELDS)[number];

/** Chosen option ids for a choice, or the player's own text (free text / "write your own"). */
export type OnboardingAnswer = { optionIds: string[] } | { text: string };
export type OnboardingAnswers = Record<string, OnboardingAnswer>;

export type ResolvedOnboardingPersona = { name: string } & Record<OnboardingPersonaField, string>;

/**
 * The card's variables, with a free-text `player` question first when the
 * author did not define one — a persona always needs a name. Its question is
 * empty so the UI shows its own localized "What is your name?".
 */
export function getOnboardingVariables(onboarding: CharacterOnboarding): CharacterOnboardingVariable[] {
  const variables = onboarding.variables ?? [];
  if (variables.some((variable) => variable.variableName === ONBOARDING_PLAYER_VARIABLE)) return variables;
  return [
    {
      id: `__${ONBOARDING_PLAYER_VARIABLE}`,
      variableName: ONBOARDING_PLAYER_VARIABLE,
      question: "",
      options: [],
      allowCustom: false,
      multiSelect: false,
      separator: ", ",
      displayMode: "auto",
      optionSort: "manual",
    },
    ...variables,
  ];
}

function isAnswered(answer: OnboardingAnswer | undefined): boolean {
  if (!answer) return false;
  return "text" in answer ? answer.text.trim() !== "" : answer.optionIds.length > 0;
}

/**
 * Resolve the five fields once. `read` (optional) is told every variable the
 * engine reads, which only happens for text and conditions it actually reaches.
 */
function resolveFields(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
  read?: (name: string) => void,
): ResolvedOnboardingPersona {
  const variables = getOnboardingVariables(onboarding);
  const values: Record<string, string> = {};
  // `{{user}}`/`{{char}}` resolve to themselves, so the saved persona keeps them
  // live like any hand-written persona instead of baking in today's names.
  const ctx = { user: "{{user}}", char: "{{char}}", characters: [], variables: values, localVariables: {} };

  // Getters on own properties: the engine reads variables via hasOwnProperty +
  // a string check, so an unanswered variable (getter returns undefined) stays
  // verbatim / false in conditions, exactly as with a missing variable.
  for (const variable of variables) {
    const name = variable.variableName;
    if (!name || Object.prototype.hasOwnProperty.call(values, name)) continue;
    let cached: string | undefined;
    let computed = false;
    Object.defineProperty(values, name, {
      enumerable: true,
      get() {
        read?.(name);
        if (computed) return cached;
        computed = true;
        const answer = answers[name];
        if (!isAnswered(answer)) return (cached = undefined);
        if ("text" in answer!) return (cached = answer.text.trim());
        // Option values are author content and may hold macros of their own
        // (e.g. `custom` → `{{customClass}}`); the engine inserts variable values
        // without re-resolving them, so resolve the chosen values here.
        const chosen = variable.options.filter((option) => answer!.optionIds.includes(option.id));
        const joined = chosen.map((option) => option.value).join(variable.multiSelect ? variable.separator : "");
        return (cached = resolveMacros(joined, ctx, { trimResult: false }));
      },
    });
  }

  // The name goes through the same map, so a picked option, the player's own
  // text, or macros inside an option value all work alike.
  const out = { name: values[ONBOARDING_PLAYER_VARIABLE] ?? "" } as ResolvedOnboardingPersona;
  for (const field of ONBOARDING_PERSONA_FIELDS) {
    out[field] = resolveMacros(onboarding[field] ?? "", ctx, { trimResult: false });
  }
  return out;
}

/**
 * Variables the current answers make relevant, in card order: `player`, plus
 * every variable the engine reads while resolving the fields — in reachable text
 * or in a `{{#if}}` it evaluates. A question inside a branch that the answers
 * so far rule out is not listed.
 */
export function getRelevantOnboardingVariables(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
): CharacterOnboardingVariable[] {
  const used = new Set<string>([ONBOARDING_PLAYER_VARIABLE]);
  resolveFields(onboarding, answers, (name) => used.add(name));
  return getOnboardingVariables(onboarding).filter((variable) => used.has(variable.variableName));
}

/** The next relevant question without an answer, or null when onboarding is complete. */
export function getNextOnboardingVariable(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
): CharacterOnboardingVariable | null {
  return (
    getRelevantOnboardingVariables(onboarding, answers).find(
      (variable) => !isAnswered(answers[variable.variableName]),
    ) ?? null
  );
}

/**
 * The persona the answers produce, as plain text. Any onboarding variable left
 * unanswered is blanked rather than shown as a raw `{{name}}`.
 */
export function resolveOnboardingPersona(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
): ResolvedOnboardingPersona {
  const fields = resolveFields(onboarding, answers);
  const names = new Set(getOnboardingVariables(onboarding).map((variable) => variable.variableName));
  const blank = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (names.has(name) ? "" : match));
  const result = { name: blank(fields.name).trim() } as ResolvedOnboardingPersona;
  for (const field of ONBOARDING_PERSONA_FIELDS) result[field] = blank(fields[field]).trim();
  return result;
}

export type OnboardingIssue =
  | {
      code: "emptyName" | "invalidName" | "reservedName" | "duplicateName" | "unused";
      variableId: string;
      name: string;
    }
  | { code: "plainIf"; field: OnboardingPersonaField };

/**
 * Problems an author should fix. `unused` is a warning; the rest stop a
 * question from working. Names follow preset variables (letters, digits, _).
 */
export function validateOnboarding(onboarding: CharacterOnboarding): OnboardingIssue[] {
  const issues: OnboardingIssue[] = [];
  const text = ONBOARDING_PERSONA_FIELDS.map((field) => onboarding[field] ?? "").join("\n");
  const seen = new Set<string>();
  for (const variable of onboarding.variables ?? []) {
    const { id: variableId, variableName: name } = variable;
    if (!name) issues.push({ code: "emptyName", variableId, name });
    else if (!/^\w+$/.test(name)) issues.push({ code: "invalidName", variableId, name });
    else if (seen.has(name)) issues.push({ code: "duplicateName", variableId, name });
    else if (name !== ONBOARDING_PLAYER_VARIABLE && isReservedMacroName(name))
      issues.push({ code: "reservedName", variableId, name });
    else if (name !== ONBOARDING_PLAYER_VARIABLE && !new RegExp(`\\b${name}\\b`).test(text))
      issues.push({ code: "unused", variableId, name });
    if (name) seen.add(name);
  }
  // `{{if}}` / `{{If}}` without `#` is not a conditional: it reaches the persona verbatim.
  for (const field of ONBOARDING_PERSONA_FIELDS) {
    if (/\{\{\s*(?:if|else\s+if)\b/i.test(onboarding[field] ?? "")) issues.push({ code: "plainIf", field });
  }
  return issues;
}
