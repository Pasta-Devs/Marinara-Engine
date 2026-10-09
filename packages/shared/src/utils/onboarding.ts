// ──────────────────────────────────────────────
// Interactive onboarding ("skeleton persona")
//
// A card's `extensions.onboarding` holds the five persona Card fields as prose
// that may use `{{variable}}` and `{{#if}}`, plus the variables the player
// answers. Everything here leans on the macro engine — there is no onboarding
// parser: which questions are relevant is whatever the engine actually reads
// while resolving the fields with the answers given so far.
// ──────────────────────────────────────────────
import { characterOnboardingSchema } from "../schemas/character.schema.js";
import type { CharacterOnboarding, CharacterOnboardingVariable } from "../types/character.js";
import { isReservedMacroName } from "./chat-variables.js";
import { resolveMacros } from "./macro-engine.js";

/**
 * Questions a card may carry. The editor stops adding at this count and imports
 * keep only the first ones: every question is an editor card, so thousands of
 * them freeze the Character Editor (#7308 review).
 */
export const ONBOARDING_MAX_QUESTIONS = 100;

/**
 * Imports drop an onboarding block that can't be read instead of refusing the
 * card (native import) or storing data a later card save would reject (V2/PNG),
 * and keep only the first {@link ONBOARDING_MAX_QUESTIONS} questions.
 */
export function dropUnreadableOnboarding<T extends Record<string, unknown>>(
  extensions: T,
): { extensions: T; dropped: boolean; truncated: boolean } {
  if (!("onboarding" in extensions)) return { extensions, dropped: false, truncated: false };
  const parsed = characterOnboardingSchema.safeParse(extensions.onboarding);
  if (!parsed.success) {
    const { onboarding: _dropped, ...rest } = extensions;
    return { extensions: rest as T, dropped: true, truncated: false };
  }
  const raw = extensions.onboarding as { variables?: unknown[] };
  if (parsed.data.variables.length <= ONBOARDING_MAX_QUESTIONS) return { extensions, dropped: false, truncated: false };
  const onboarding = { ...raw, variables: raw.variables!.slice(0, ONBOARDING_MAX_QUESTIONS) };
  return { extensions: { ...extensions, onboarding }, dropped: false, truncated: true };
}

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

/** Own text must be non-blank; any choice counts, so "none of these" (an empty multi-select) is an answer. */
function isAnswered(answer: OnboardingAnswer | undefined): boolean {
  if (!answer) return false;
  return "text" in answer ? answer.text.trim() !== "" : true;
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
  // `{{user}}`/`{{char}}` resolve to themselves, so the saved persona keeps them
  // live like any hand-written persona instead of baking in today's names.
  const ctx = answerContext(onboarding, answers, { user: "{{user}}", char: "{{char}}" }, read);

  // The name goes through the same map, so a picked option, the player's own
  // text, or macros inside an option value all work alike.
  const out = { name: ctx.variables[ONBOARDING_PLAYER_VARIABLE] ?? "" } as ResolvedOnboardingPersona;
  for (const field of ONBOARDING_PERSONA_FIELDS) {
    out[field] = resolveMacros(onboarding[field] ?? "", ctx, { trimResult: false });
  }
  return out;
}

/** A macro context whose variables are the answers so far. */
function answerContext(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
  names: { user: string; char: string },
  read?: (name: string) => void,
) {
  const values: Record<string, string> = {};
  const ctx = { ...names, characters: [], variables: values, localVariables: {} };

  // Getters on own properties: the engine reads variables via hasOwnProperty +
  // a string check, so an unanswered variable (getter returns undefined) acts
  // exactly like a missing one: verbatim in text, and in a bare `{{#if name}}`
  // the engine reads the leftover name as a truthy literal. That only shows a
  // follow-up early; Create stays disabled until it is answered anyway.
  for (const variable of getOnboardingVariables(onboarding)) {
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
        // A blank value means "same as the label", so authors don't type `Male` twice.
        const joined = chosen
          .map((option) => (option.value.trim() ? option.value : option.label))
          .join(variable.multiSelect ? variable.separator : "");
        return (cached = resolveMacros(joined, ctx, { trimResult: false }));
      },
    });
  }
  return ctx;
}

/** Replace any onboarding variable still left as `{{name}}` with `fill`. */
function blankOnboardingNames(names: Set<string>, text: string, fill = ""): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (names.has(name) ? fill : match));
}

function onboardingNames(onboarding: CharacterOnboarding): Set<string> {
  return new Set(getOnboardingVariables(onboarding).map((variable) => variable.variableName));
}

/**
 * Every question as the player sees it, by variable id: answers so far fill its
 * `{{variables}}`, `{{char}}` is the card's name, `{{user}}` the player's name,
 * and anything not answered yet shows as "…". Questions without text are left
 * out. One shared context for all of them, so a card with thousands of
 * questions stays linear (#7308 review).
 */
export function resolveOnboardingQuestions(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
  characterName: string,
): Map<string, string> {
  const ctx = answerContext(onboarding, answers, { user: "{{user}}", char: characterName });
  ctx.user = ctx.variables[ONBOARDING_PLAYER_VARIABLE] || "…";
  const names = onboardingNames(onboarding);
  const questions = new Map<string, string>();
  for (const { id, question } of getOnboardingVariables(onboarding)) {
    if (!question) continue;
    questions.set(id, blankOnboardingNames(names, resolveMacros(question, ctx, { trimResult: false }), "…").trim());
  }
  return questions;
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
  const names = onboardingNames(onboarding);
  const blank = (text: string) => blankOnboardingNames(names, text);
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
  | { code: "plainIf"; field: OnboardingPersonaField }
  | { code: "unknownName"; field: OnboardingPersonaField; name: string };

/**
 * Names a text reads: bare `{{name}}` tags and the left operand of each
 * `{{#if}}` / `{{else if}}` clause. Words in prose don't count.
 * ponytail: right-hand operands are skipped — the engine resolves both sides,
 * so a name there is indistinguishable from a literal like `custom`.
 */
function readNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const match of text.matchAll(/\{\{([A-Za-z_]\w*)\}\}/g)) names.add(match[1]!);
  // Card text is untrusted (CodeQL js/polynomial-redos): one `\s` so no two parts
  // match the same whitespace, and no `{` or `}` inside, so a scan never runs
  // past the next `{{` — linear even with thousands of `{{#if` starts.
  for (const condition of text.matchAll(/\{\{\s*(?:#if|else\s+if)\s([^{}]*)\}\}/gi)) {
    for (const operand of condition[1]!.matchAll(/(?:^|&&|\|\||\(|!)\s*([A-Za-z_]\w*)(?![.:\w])/g)) {
      names.add(operand[1]!);
    }
  }
  return names;
}

/**
 * Problems an author should fix. `unused` is a warning; the rest stop a
 * question from working. Names follow preset variables (letters, digits, _).
 */
export function validateOnboarding(onboarding: CharacterOnboarding): OnboardingIssue[] {
  const issues: OnboardingIssue[] = [];
  // A question is used when a field or another question's option value reads it
  // (an option value like `{{customClass}}` asks that follow-up too).
  const used = readNames(
    [
      ...ONBOARDING_PERSONA_FIELDS.map((field) => onboarding[field] ?? ""),
      ...(onboarding.variables ?? []).flatMap((variable) => variable.options.map((option) => option.value)),
    ].join("\n"),
  );
  const seen = new Set<string>();
  for (const variable of onboarding.variables ?? []) {
    const { id: variableId, variableName: name } = variable;
    if (!name) issues.push({ code: "emptyName", variableId, name });
    else if (!/^\w+$/.test(name)) issues.push({ code: "invalidName", variableId, name });
    else if (seen.has(name)) issues.push({ code: "duplicateName", variableId, name });
    else if (name !== ONBOARDING_PLAYER_VARIABLE && isReservedMacroName(name))
      issues.push({ code: "reservedName", variableId, name });
    else if (name !== ONBOARDING_PLAYER_VARIABLE && !used.has(name)) issues.push({ code: "unused", variableId, name });
    if (name) seen.add(name);
  }
  const known = new Set([ONBOARDING_PLAYER_VARIABLE, ...seen]);
  for (const field of ONBOARDING_PERSONA_FIELDS) {
    const fieldText = onboarding[field] ?? "";
    // `{{if}}` / `{{If}}` without `#` is not a conditional: it reaches the persona
    // verbatim. (`{{else if}}` is correct as is — the engine's else-if has no `#`.)
    if (/\{\{\s*if\b/i.test(fieldText)) issues.push({ code: "plainIf", field });
    for (const name of readNames(fieldText)) {
      if (!known.has(name) && !isReservedMacroName(name)) issues.push({ code: "unknownName", field, name });
    }
  }
  return issues;
}
