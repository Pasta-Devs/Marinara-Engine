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
import { CHAT_VARIABLE_NAME_RE, MAX_CHAT_VARIABLE_VALUE_LENGTH, isReservedMacroName } from "./chat-variables.js";
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
  const overCap = (variables: typeof parsed.data.variables) => variables.length > ONBOARDING_MAX_QUESTIONS;
  const truncated = overCap(parsed.data.variables) || overCap(parsed.data.cardVariables);
  const cap = (variables: typeof parsed.data.variables) => variables.slice(0, ONBOARDING_MAX_QUESTIONS);
  const capped = truncated
    ? { ...parsed.data, variables: cap(parsed.data.variables), cardVariables: cap(parsed.data.cardVariables) }
    : parsed.data;
  const onboarding = withUniqueOnboardingIds(capped);
  if (onboarding === parsed.data) return { extensions, dropped: false, truncated: false };
  return { extensions: { ...extensions, onboarding }, dropped: false, truncated };
}

/**
 * Card data with an onboarding block the schema can't read left out, for
 * read-only checks (chat identity, persona-as-character). Cards stored before
 * onboarding existed may carry a foreign `onboarding` key; that must not make
 * the whole character invalid there. The editor still shows it as unreadable.
 */
export function withoutUnreadableOnboarding(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const record = data as Record<string, unknown>;
  const raw = record.extensions;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return data;
  const { extensions } = dropUnreadableOnboarding(raw as Record<string, unknown>);
  return extensions === raw ? data : { ...record, extensions };
}

/**
 * Gives every question, and every option within a question, its own non-empty
 * id. The editor edits, deletes and reorders by id, so a hand-edited card with
 * repeated ids would change both twins at once, or let a reorder multiply them
 * past the cap (#7308 review). Deterministic, so re-reading a card yields the
 * same ids; returns the same object when nothing needed fixing.
 */
export function withUniqueOnboardingIds<T extends CharacterOnboarding>(onboarding: T): T {
  /**
   * Keeps the first use of each id; a repeat or empty one gets `<id>_2`, `_3`…
   * unused anywhere in the list. Each base remembers where its search stopped
   * (`taken` only grows and `all` is fixed, so a skipped suffix never frees up):
   * restarting at `_2` for every repeat was quadratic, and an imported card with
   * thousands of repeated option ids blocked the server for minutes (#7308 review).
   */
  const uniquer = (ids: string[], fallback: string) => {
    const all = new Set(ids);
    const taken = new Set<string>();
    const nextSuffix = new Map<string, number>();
    return (id: string) => {
      let next = id;
      if (!next || taken.has(next)) {
        const base = id || fallback;
        let n = nextSuffix.get(base) ?? 2;
        do next = `${base}_${n++}`;
        while (taken.has(next) || all.has(next));
        nextSuffix.set(base, n);
      }
      taken.add(next);
      return next;
    };
  };
  const unique = (variables: CharacterOnboardingVariable[], prefix: string) => {
    const questionId = uniquer(
      variables.map((variable) => variable.id),
      `${prefix}question`,
    );
    return variables.map((variable) => {
      const optionId = uniquer(
        variable.options.map((option) => option.id),
        `${prefix}option`,
      );
      const options = variable.options.map((option) => {
        const id = optionId(option.id);
        return id === option.id ? option : { ...option, id };
      });
      const id = questionId(variable.id);
      const same = id === variable.id && options.every((option, index) => option === variable.options[index]);
      return same ? variable : { ...variable, id, options };
    });
  };
  const variables = onboarding.variables ?? [];
  const cardVariables = onboarding.cardVariables ?? [];
  // The two lists are separate: an id may repeat across them, because they are
  // never rendered or answered together. Within a list ids must be unique.
  const fixed = unique(variables, "");
  const fixedCard = unique(cardVariables, "card");
  const changed =
    fixed.some((variable, index) => variable !== variables[index]) ||
    fixedCard.some((variable, index) => variable !== cardVariables[index]);
  return changed ? { ...onboarding, variables: fixed, cardVariables: fixedCard } : onboarding;
}

/** A variable with this name supplies the created persona's name. */
export const ONBOARDING_PLAYER_VARIABLE = "player";

/**
 * "A", "A and B", "A, B and C" — a name list that reads as a sentence, used by
 * the onboarding window's opening line and its clash warning. Note the last pair
 * is joined with "and" and there is no Oxford comma: the copy is written that
 * way, so the join has to match it.
 */
export function listNames(names: readonly string[]): string {
  const present = names.filter((name) => name.trim() !== "");
  if (present.length <= 1) return present[0] ?? "";
  return `${present.slice(0, -1).join(", ")} and ${present[present.length - 1]}`;
}

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

/**
 * The answer stored under `name`, own properties only: a question named
 * `toString` or `constructor` must not find `Object.prototype`'s (#7308 review).
 */
function ownAnswer(answers: OnboardingAnswers, name: string): OnboardingAnswer | undefined {
  return Object.prototype.hasOwnProperty.call(answers, name) ? answers[name] : undefined;
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

/** A macro context whose variables are the answers to `variables` so far. */
function answerContextFor(
  variables: CharacterOnboardingVariable[],
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
        const answer = ownAnswer(answers, name);
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

/** The persona answers, including the synthesized `player` question. */
function answerContext(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
  names: { user: string; char: string },
  read?: (name: string) => void,
) {
  return answerContextFor(getOnboardingVariables(onboarding), answers, names, read);
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
 * The CARD questions as the player sees them, by variable id.
 *
 * Separate from `resolveOnboardingQuestions` on purpose: the two lists resolve
 * against different things. Card answers become chat variables and the card's
 * own fields fill their `{{placeholders}}`, while the persona's answers fill its
 * fields. One shared context would let a persona question read a card answer or
 * vice versa, and `{{user}}`/`{{char}}` inside a card question would be blanked
 * as though they were person variables.
 */
export function resolveCardQuestions(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
  characterName: string,
  playerName?: string,
): Map<string, string> {
  const variables = onboarding.cardVariables ?? [];
  if (variables.length === 0) return new Map();
  // `{{user}}` is the player's name. It comes from an answer here, but when the
  // player picked an EXISTING persona there is no name question to answer at
  // all, so the caller passes the persona's name in instead. Without that the
  // heading printed a bare `{{user}}` while a persona question beside it showed
  // the resolved name — a mismatch the user caught in review.
  const ctx = answerContextFor(variables, answers, { user: "{{user}}", char: characterName });
  const answered = ownAnswer(answers, ONBOARDING_PLAYER_VARIABLE);
  const resolvedPlayer = answered && "text" in answered ? answered.text.trim() : "";
  // Falls back to the live tag, not an ellipsis: a card question may be drawn
  // before any name is known, and `{{user}}` is a base macro the engine expands
  // when the card is actually read. An ellipsis read as a broken question.
  ctx.user = resolvedPlayer || playerName?.trim() || "{{user}}";
  const names = new Set(variables.map((variable) => variable.variableName));
  const questions = new Map<string, string>();
  for (const variable of variables) {
    if (!variable.question) continue;
    // Blank only THIS list's names: a still-unresolved name would otherwise
    // print its raw tag into a heading. `{{user}}`/`{{char}}` are not in the set,
    // so they resolve to the player's and the card's name as intended.
    questions.set(
      variable.id,
      blankOnboardingNames(names, resolveMacros(variable.question, ctx, { trimResult: false }), "…").trim(),
    );
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

/**
 * The next relevant question without an answer, or null when onboarding is
 * complete. A persona needs a name, so `player` also counts as unanswered while
 * it resolves to nothing (e.g. a multi-select with nothing ticked).
 */
export function getNextOnboardingVariable(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
): CharacterOnboardingVariable | null {
  const relevant = getRelevantOnboardingVariables(onboarding, answers);
  const next = relevant.find((variable) => !isAnswered(ownAnswer(answers, variable.variableName)));
  if (next) return next;
  if (resolveOnboardingPersona(onboarding, answers).name) return null;
  return relevant.find((variable) => variable.variableName === ONBOARDING_PLAYER_VARIABLE) ?? null;
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

/**
 * The template's persona question names that `texts` mention, as a bare
 * `{{name}}` or in the left operand of an `{{#if}}` / `{{else if}}` condition.
 * One scan for the Character Editor's greeting warning and for the wizard's
 * decision to fill a greeting in, so the two can't disagree. `{{classy}}` is not
 * `class`: names are matched whole.
 */
export function findPersonaVariableUses(onboarding: CharacterOnboarding, texts: readonly string[]): Set<string> {
  const personaNames = onboardingNames(onboarding);
  const uses = new Set<string>();
  for (const name of readNames(texts.join("\n"))) {
    if (personaNames.has(name)) uses.add(name);
  }
  return uses;
}

/** True when the greeting mentions one of the template's persona question names. */
export function greetingMentionsPersonaName(onboarding: CharacterOnboarding, greeting: string): boolean {
  return findPersonaVariableUses(onboarding, [greeting]).size > 0;
}

/**
 * Whether the wizard fills in this card's greetings from the persona answers:
 * the persona was created from THIS card's template, and the chat still uses
 * that persona (picking another one afterwards leaves the greeting as written).
 */
export function shouldFillGreetingFromPersona(
  created: { cardId: string; personaId: string } | null | undefined,
  characterId: string,
  chatPersonaId: string | null | undefined,
): boolean {
  return !!created && created.cardId === characterId && !!chatPersonaId && created.personaId === chatPersonaId;
}

/**
 * One greeting with the player's persona answers filled in, as plain text. A
 * greeting that mentions no persona question is returned untouched, byte for byte.
 *
 * Read like the persona: same answer context, so `{{#if}}`, macros inside option
 * values and unanswered follow-ups going blank all behave alike, and `{{user}}` /
 * `{{char}}` stay live. Tags the persona answers don't own (`{{time}}`,
 * `{{random}}`) resolve here, once, as they do when a persona is created.
 *
 * `characterAnswers` are the chat's character-question answers. They are only
 * read: a condition on one (`{{#if relationshipToUser == friend}}`) has to take
 * the right branch, because the text this returns can't be re-evaluated. For the
 * same reason a plain `{{relationshipToUser}}` in a greeting like this is filled
 * in as well, and stops following later edits of that answer.
 */
export function resolveOnboardingGreeting(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
  greeting: string,
  characterAnswers: Record<string, string> = {},
): string {
  if (!greetingMentionsPersonaName(onboarding, greeting)) return greeting;
  const ctx = answerContext(onboarding, answers, { user: "{{user}}", char: "{{char}}" });
  // A copy, so a `{{setvar}}` in the greeting can't write into the caller's map.
  ctx.localVariables = { ...characterAnswers };
  return blankOnboardingNames(onboardingNames(onboarding), resolveMacros(greeting, ctx, { trimResult: false }));
}

// ──────────────────────────────────────────────
// Card variables (#7434)
//
// A second list of questions whose answers become CHAT variables instead of
// persona text. A card field can then carry a permanent `{{relationshipToUser}}`
// that each chat fills in during setup, so the card stays modular and is never
// modified. The prompt path needs nothing new: a card field already resolves a
// chat variable (measured 2026-10-11).
// ──────────────────────────────────────────────

/** True when the block has any question or field text to work from. */
function hasQuestion(variables: CharacterOnboardingVariable[] | undefined): boolean {
  return (variables ?? []).some((variable) => variable.variableName.trim() !== "");
}

/**
 * The card text a `{{name}}` can reach, for deciding which card questions are
 * worth asking. The prompt resolves these fields from the card (see the
 * character marker in the server), so text here is what the model would read.
 */
export interface OnboardingCardFields {
  description?: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
}

/**
 * The fields the prompt actually macro-resolves for a character. Kept in step
 * with the Character Info marker's default field list; a name used only outside
 * these (a greeting, say) is not offered as a question, because the prompt would
 * never resolve it.
 */
export const ONBOARDING_CARD_FIELDS = [
  "description",
  "personality",
  "backstory",
  "appearance",
  "scenario",
] as const satisfies readonly (keyof OnboardingCardFields)[];

/** What a card's data tells onboarding: who it is, what it asks, and what its fields read. */
export interface CardOnboarding {
  name: string;
  onboarding: CharacterOnboarding;
  cardFields: OnboardingCardFields;
}

/**
 * The onboarding block a card's data declares, plus the card name and the five
 * fields the questions feed. `null` when the data cannot be read or carries no
 * onboarding the schema accepts.
 *
 * `enabled` is deliberately NOT part of the gate: the seeding path writes only
 * for an enabled block, the player-facing paths also require
 * `hasOnboardingContent`, and a removal has to see a remaining card's
 * declarations even when its onboarding is switched off (its fields can still
 * read the name).
 *
 * Reads both shapes the app stores: the row's JSON string and an already-parsed
 * object. Ids are made unique here because the editor, the questions window and
 * the seeding all key by id, and cards saved before that rule (or written via
 * the API) may still repeat one.
 */
export function readCardOnboarding(data: unknown): CardOnboarding | null {
  let card: unknown = data;
  if (typeof card === "string") {
    try {
      card = JSON.parse(card);
    } catch {
      return null;
    }
  }
  if (!card || typeof card !== "object" || Array.isArray(card)) return null;
  const record = card as Record<string, unknown>;
  const rawExtensions = record.extensions;
  if (!rawExtensions || typeof rawExtensions !== "object" || Array.isArray(rawExtensions)) return null;
  const extensions = rawExtensions as Record<string, unknown>;
  const parsed = characterOnboardingSchema.safeParse(extensions.onboarding);
  if (!parsed.success) return null;
  const topLevel = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : undefined);
  const extensionText = (key: string) =>
    typeof extensions[key] === "string" ? (extensions[key] as string) : undefined;
  return {
    name: typeof record.name === "string" ? record.name : "",
    onboarding: withUniqueOnboardingIds(parsed.data as CharacterOnboarding),
    cardFields: {
      description: topLevel("description"),
      personality: topLevel("personality"),
      // `backstory` and `appearance` live on `extensions`, NOT at the top level:
      // reading them from the card root silently yields undefined, and a question
      // whose only reference sits there is then never asked.
      backstory: extensionText("backstory"),
      appearance: extensionText("appearance"),
      scenario: topLevel("scenario"),
    },
  };
}

function onboardingCardFieldTexts(card: OnboardingCardFields | null | undefined): string[] {
  if (!card) return [];
  return ONBOARDING_CARD_FIELDS.map((field) => card[field] ?? "");
}

/**
 * Whether this card's onboarding offers the player anything, used to suppress
 * the wizard's marker and trigger for an enabled-but-empty block. A card with no
 * questions is still meaningful when its fields carry text: it ships a
 * ready-made persona, exactly like the answer path produces ("empty" must not
 * mean "no questions" alone).
 */
export function hasOnboardingContent(onboarding: CharacterOnboarding): boolean {
  if (ONBOARDING_PERSONA_FIELDS.some((field) => (onboarding[field] ?? "").trim() !== "")) return true;
  return hasQuestion(onboarding.variables) || hasQuestion(onboarding.cardVariables);
}

/**
 * Whether a card's data shows interactive onboarding to the player: enabled and
 * offering something. The one gate the setup wizard's marker uses, so any list
 * that flags "has onboarding" agrees with it. Reads a JSON string or a parsed
 * object.
 */
export function cardHasInteractiveOnboarding(data: unknown): boolean {
  const cardOnboarding = readCardOnboarding(data);
  return !!cardOnboarding?.onboarding.enabled && hasOnboardingContent(cardOnboarding.onboarding);
}

/**
 * Whether this card would actually PRODUCE a persona, which is a narrower
 * question than `hasOnboardingContent`: a card that only declares card questions
 * is still worth offering to the player (its fields read this chat's answers),
 * but it has nothing to write into a persona, so offering it as a "Create your
 * persona" template would build one from a bare name.
 *
 * A card with persona field text but no questions does qualify — it ships a
 * ready-made persona, exactly like the answer path produces.
 */
export function canBuildPersona(onboarding: CharacterOnboarding): boolean {
  if (ONBOARDING_PERSONA_FIELDS.some((field) => (onboarding[field] ?? "").trim() !== "")) return true;
  return hasQuestion(onboarding.variables);
}

/** The card questions the answers make relevant, in card order. */
export function getRelevantCardVariables(
  onboarding: CharacterOnboarding,
  card: OnboardingCardFields,
  answers: OnboardingAnswers,
): CharacterOnboardingVariable[] {
  const variables = onboarding.cardVariables ?? [];
  if (variables.length === 0) return [];
  const used = new Set<string>();
  // Resolve the card's own fields with the answers so far, exactly like the
  // persona path: whatever the engine reads is what gets asked.
  const ctx = answerContextFor(variables, answers, { user: "{{user}}", char: "{{char}}" }, (name) => used.add(name));
  for (const text of onboardingCardFieldTexts(card)) resolveMacros(text, ctx, { trimResult: false });
  return variables.filter((variable) => used.has(variable.variableName));
}

/**
 * The names the Card tab offers as insertable chips, in card order.
 *
 * Lives here, not in the editor, so the rule can be pinned by a regression
 * instead of a test that restates it — a copy of the rule would keep passing
 * after the editor's changed.
 *
 * The gate is the user's: nothing at all unless onboarding is enabled and the
 * card actually declares questions. Every declared name is then offered, whether
 * or not a field reads it yet. A usage filter would invert the workflow, because
 * a name is unused precisely until the author inserts it — the chip would only
 * appear after the tag had been typed by hand. The unused warning reports the
 * "nothing reads this" case instead, and one answer may belong in several fields.
 */
export function getCardVariableChipNames(onboarding: CharacterOnboarding | null | undefined): string[] {
  if (!onboarding?.enabled) return [];
  const names = new Set<string>();
  for (const variable of onboarding.cardVariables ?? []) {
    const name = variable.variableName.trim();
    // A blank name would render an unusable `{{}}`; the validator already
    // reports it separately.
    if (name) names.add(name);
  }
  return [...names];
}

/**
 * The chips a greeting offers. A card field reads character answers and a persona
 * field reads persona answers, but a greeting resolves both, so it lists both,
 * split by who answers them. Persona names need a template to fill them in, and a
 * name both lists declare is one chat variable, so it stays with the character.
 */
export function getGreetingVariableChipNames(onboarding: CharacterOnboarding | null | undefined): {
  character: string[];
  persona: string[];
} {
  const character = getCardVariableChipNames(onboarding);
  if (!onboarding?.enabled || !canBuildPersona(onboarding)) return { character, persona: [] };
  const persona = new Set<string>();
  for (const variable of getOnboardingVariables(onboarding)) {
    const name = variable.variableName.trim();
    if (name && !character.includes(name)) persona.add(name);
  }
  return { character, persona: [...persona] };
}

/** The next card question without an answer, or null when they are all answered. */
export function getNextCardVariable(
  onboarding: CharacterOnboarding,
  card: OnboardingCardFields,
  answers: OnboardingAnswers,
): CharacterOnboardingVariable | null {
  return (
    getRelevantCardVariables(onboarding, card, answers).find(
      (variable) => !isAnswered(ownAnswer(answers, variable.variableName)),
    ) ?? null
  );
}

/**
 * How many card variables one chat may receive from onboarding. Far below the
 * server's own `MAX_CHAT_VARIABLES` (500), because these are written as one
 * patch and a chat also holds whatever the player and `{{setvar}}` put there.
 */
export const MAX_CARD_VARIABLES = 100;

/**
 * A name the chat route will accept for a NEW chat variable. The stored-name
 * pattern is broader on purpose (it also carries `{{setvar}}` names), but a
 * name created here has to be addressable as a bare `{{name}}`.
 */
function isStorableCardVariableName(name: string): boolean {
  return CHAT_VARIABLE_NAME_RE.test(name) && !isReservedMacroName(name);
}

/**
 * The variable names this card's character questions declare, in card order and
 * de-duplicated. Only names a chat could actually store are included: a blank,
 * reserved or malformed name can never be in `macroVariables`, so it can never
 * need removing.
 *
 * NOT gated on `enabled`. A switched-off block declares nothing that was asked,
 * but its card's own fields can still read the name, and the removal rule has to
 * respect that on the side that stays in the chat. The caller that deletes does
 * the `enabled` check.
 */
export function getCardVariableNames(onboarding: CharacterOnboarding | null | undefined): string[] {
  const names = new Set<string>();
  for (const variable of onboarding?.cardVariables ?? []) {
    const name = variable.variableName.trim();
    if (name && isStorableCardVariableName(name)) names.add(name);
  }
  return [...names];
}

/**
 * The chat variables the card questions resolve to: `name` → value, ready to be
 * written into the chat's `macroVariables`.
 *
 * Only answered questions are included, and a value that still holds a bare
 * `{{name}}` is dropped rather than stored, so a half-finished answer can never
 * write a raw tag into the prompt. Names the server would refuse are skipped for
 * the same reason: `PATCH /chats/:id/metadata` rejects the whole `macroVariables`
 * patch on one invalid name, which would lose every answer in it.
 */
export function resolveCardVariables(
  onboarding: CharacterOnboarding,
  answers: OnboardingAnswers,
): Record<string, string> {
  const variables = onboarding.cardVariables ?? [];
  if (variables.length === 0) return {};
  const ctx = answerContextFor(variables, answers, { user: "{{user}}", char: "{{char}}" });
  const names = new Set(variables.map((variable) => variable.variableName));
  const entries: Array<[string, string]> = [];
  const taken = new Set<string>();
  let stored = 0;
  for (const variable of variables) {
    const name = variable.variableName;
    if (!name || taken.has(name) || !isStorableCardVariableName(name)) continue;
    if (stored >= MAX_CARD_VARIABLES) break;
    if (!isAnswered(ownAnswer(answers, name))) continue;
    taken.add(name);
    const value = blankOnboardingNames(names, ctx.variables[name] ?? "").trim();
    // A leftover tag is only usable when something still resolves it. The engine
    // runs its built-in passes before the `{{name}}` catch-all, so `{{user}}` /
    // `{{char}}` stay live and are filled in when the prompt is built — dropping
    // them would lose an answer like `"{{user}}'s old friend"`. Any OTHER
    // leftover names a question, which nothing resolves once this map is
    // written, so the prompt would show it raw and the answer is not stored.
    //
    // Order matters: the blanking above only rewrites names in THIS list, so a
    // reference to a sibling question is already substituted or emptied by the
    // time this runs, and the guard covers what it leaves. A value that blanks
    // down to nothing fails the `!value` test rather than being stored empty.
    //
    // Length is capped to the route's limit too: a longer answer makes
    // PATCH /chats/:id/metadata reject the WHOLE macroVariables patch, so one
    // long answer would lose every other answer with it.
    if (!value || value.length > MAX_CHAT_VARIABLE_VALUE_LENGTH || unresolvedNonMacroName(value) !== null) continue;
    entries.push([name, value]);
    stored += 1;
  }
  // Built by entries, not assignment: a "__proto__" name must stay an own key.
  return Object.fromEntries(entries);
}

/**
 * Rebuild the answers a chat already holds, so a questions window opened after
 * setup shows what the chat saved instead of every question's first option.
 * Without this, saving an answer the player DID edit also rewrites the ones they
 * did not touch (#7797 review).
 *
 * The stored string is what `resolveCardVariables` wrote: a free-text answer as
 * typed, or a chosen option's VALUE (the label when the value is blank), joined by
 * the separator for a multi-select. Matching both forms is what puts a choice back
 * on its own option.
 *
 * A value the current options cannot express — the author edited the choices, or
 * an option value is a macro whose expansion was stored — becomes an EMPTY choice,
 * which renders unselected and writes nothing: the stored value survives an
 * untouched save, and picking an option still replaces it. A single choice that
 * allows an own answer takes that value as typed text instead, because that is
 * where the window keeps player-written answers.
 */
export function answersFromStoredValues(
  variables: readonly CharacterOnboardingVariable[],
  stored: Record<string, string>,
): OnboardingAnswers {
  const answers: OnboardingAnswers = Object.create(null);
  for (const variable of variables) {
    const name = variable.variableName;
    if (!name || !Object.prototype.hasOwnProperty.call(stored, name)) continue;
    const value = stored[name] ?? "";
    if (value.trim() === "") continue;
    if (variable.options.length === 0) {
      answers[name] = { text: value };
      continue;
    }
    const parts = variable.multiSelect
      ? value
          .split(variable.separator)
          .map((part) => part.trim())
          .filter((part) => part !== "")
      : [value.trim()];
    // An empty separator joins multi-select values with nothing between them, so
    // the parts cannot be recovered; treated as unmatchable on purpose.
    const ids =
      variable.multiSelect && variable.separator === "" ? [] : parts.map((part) => storedOptionId(variable, part));
    if (ids.length > 0 && ids.every((id): id is string => id !== null)) {
      answers[name] = { optionIds: [...new Set(ids)] };
    } else if (!variable.multiSelect && variable.allowCustom) {
      answers[name] = { text: value };
    } else {
      answers[name] = { optionIds: [] };
    }
  }
  return answers;
}

/** The id of the option whose stored form is `part`, or null. */
function storedOptionId(variable: CharacterOnboardingVariable, part: string): string | null {
  // A blank option value means "same as the label" (see `answerContextFor`), which
  // is the form this has to compare against.
  const option = variable.options.find((entry) => (entry.value.trim() ? entry.value : entry.label).trim() === part);
  return option ? option.id : null;
}

/**
 * The one map written to a chat when several cards ask their questions at once.
 *
 * Every card's answers share the chat's variables, so a name two cards declare is
 * written once, by the last card that asks it — the same card the clash warning
 * names last.
 *
 * The merge keeps only names the card actually ASKS, and that filter is the point
 * of this helper. `resolveCardVariables` writes a declared name even when nothing
 * asked it, because its answer map carries a default for every declared question.
 * Such a name is not "relevant", so it never reaches the clash warning and is
 * never rendered — merging it anyway let a card overwrite another card's real
 * answer for that name with its own first option, with nothing shown to the
 * player. Restricting the merge to the asked names makes what is written exactly
 * what the window displayed.
 */
export function mergeCardVariables(
  entries: ReadonlyArray<{ onboarding: CharacterOnboarding; answers: OnboardingAnswers }>,
  askedNames: ReadonlyArray<ReadonlySet<string>>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  entries.forEach((entry, index) => {
    const asked = askedNames[index];
    for (const [name, value] of Object.entries(resolveCardVariables(entry.onboarding, entry.answers))) {
      if (asked?.has(name)) merged[name] = value;
    }
  });
  return merged;
}

/**
 * The chat variables a roster change should remove: names the LEAVING cards'
 * enabled character questions own, minus every name a card that stays declares.
 *
 * The leaving side is gated on `enabled` because that is the only state in which
 * onboarding wrote these names (the seeding and the questions window both check
 * it); a switched-off block owns nothing. The staying side is NOT gated: a card
 * whose onboarding was switched off after its values were written can still read
 * the name in its own fields, and deleting a value another card may read is the
 * worse outcome.
 *
 * A staying card that only READS a name without declaring a question for it is
 * not protected: a cross-card reference is not a declaration.
 */
export function cardVariableNamesToDrop(
  removed: ReadonlyArray<CharacterOnboarding | null | undefined>,
  remaining: ReadonlyArray<CharacterOnboarding | null | undefined>,
): string[] {
  const kept = new Set<string>();
  for (const onboarding of remaining) {
    for (const name of getCardVariableNames(onboarding)) kept.add(name);
  }
  const drop: string[] = [];
  const seen = new Set<string>();
  for (const onboarding of removed) {
    if (!onboarding?.enabled) continue;
    for (const name of getCardVariableNames(onboarding)) {
      if (kept.has(name) || seen.has(name)) continue;
      seen.add(name);
      drop.push(name);
    }
  }
  return drop;
}

/**
 * The card variables a chat should START with, so a card field never reaches the
 * model with a raw `{{tag}}` in it.
 *
 * Only the Roleplay wizard asks the character questions, but a chat can also be
 * created without it (Quick Start, the conversation wizard, start-from-card).
 * Those paths have no answers at all, so every declared name is seeded with its
 * own default — the value the question would have shown first. A field is then
 * filled with something sensible instead of the literal tag.
 *
 * This is a starting point, not a decision: the wizard's own answers overwrite
 * whatever it seeded (its `macroVariables` patch runs after creation), and a
 * `{{setvar}}` write during play overwrites both.
 *
 * `{{user}}` and `{{char}}` stay LIVE in a seeded value, exactly as they do in
 * the persona path: this file's own convention resolves both to themselves, so
 * `"{{user}}'s old friend"` seeds that text and the engine fills in the name at
 * generation time. Any OTHER name still holding a tag is dropped instead, since
 * the prompt inserts a value in one non-recursive pass and would show it raw.
 */
export function seedCardVariables(onboarding: CharacterOnboarding | null | undefined): Record<string, string> {
  const variables = onboarding?.cardVariables ?? [];
  if (variables.length === 0) return {};
  const names = new Set(variables.map((variable) => variable.variableName));
  const entries: Array<[string, string]> = [];
  const taken = new Set<string>();
  // Seeded values, plus every declared name resolving to itself, so a default
  // can be re-read with its dependencies substituted.
  const seedValues: Record<string, string> = {};
  const readDefault = (variable: CharacterOnboardingVariable): string | null => {
    const first = variable.options[0];
    // A free-text question has no default. An option with a blank value means
    // "same as the label", exactly as the questions modal reads it.
    if (!first) return null;
    const raw = first.value.trim() ? first.value : first.label;
    return resolveMacros(raw, seedContext(names, seedValues), { trimResult: false }).trim();
  };
  // Two passes: a default may reference another question, and that question may
  // itself be reached first. The engine inserts values in a single pass, so a
  // default is only usable once every name it holds is already seeded — a
  // second pass lets those settle instead of dropping them on ordering.
  const settle = () => {
    for (const variable of variables) {
      const name = variable.variableName;
      if (!name || taken.has(name) || !isStorableCardVariableName(name)) continue;
      if (entries.length >= MAX_CARD_VARIABLES) return;
      const value = readDefault(variable);
      // A leftover tag is only acceptable when something will still resolve it
      // later. The engine runs its built-in passes before the `{{name}}`
      // catch-all, so `{{user}}` / `{{char}}` / `{{time}}` stay live and are
      // filled in at generation time — that is what keeps `"{{user}}'s old
      // friend"` per-user instead of baking in one name. Any OTHER leftover tag
      // names a question, which nothing resolves once this map is written, so
      // the prompt would show it raw and this question stays unseeded.
      //
      // Capped like the answered path: this one writes straight through
      // patchMetadata, so an over-long default would be stored even though the
      // same value would be rejected by the metadata route.
      if (!value || value.length > MAX_CHAT_VARIABLE_VALUE_LENGTH || unresolvedNonMacroName(value) !== null) continue;
      taken.add(name);
      seedValues[name] = value;
      entries.push([name, value]);
    }
  };
  settle();
  settle();
  return Object.fromEntries(entries);
}

/**
 * The first `{{name}}` in `text` that no built-in pass will resolve, or null.
 * A reserved macro name is one the engine expands on its own (before the
 * `{{name}}` catch-all), so it is safe to leave in a value; anything else would
 * reach the model as a literal tag once this map is written.
 */
function unresolvedNonMacroName(text: string): string | null {
  for (const match of text.matchAll(/\{\{([A-Za-z_]\w*)\}\}/g)) {
    if (!isReservedMacroName(match[1]!)) return match[1]!;
  }
  return null;
}

/**
 * A macro context in which every declared name resolves to its own seeded value,
 * or to itself while it has none — so a candidate default can be re-read
 * without any name silently collapsing to nothing.
 */
function seedContext(names: Set<string>, seedValues: Record<string, string>) {
  const values: Record<string, string> = {};
  for (const name of names) {
    if (!name) continue;
    Object.defineProperty(values, name, {
      value: Object.prototype.hasOwnProperty.call(seedValues, name) ? seedValues[name]! : `{{${name}}}`,
      enumerable: true,
    });
  }
  return { user: "{{user}}", char: "{{char}}", characters: [], variables: values, localVariables: {} };
}

export type OnboardingIssue =
  | {
      code: "emptyName" | "invalidName" | "reservedName" | "duplicateName" | "unused" | "unknownOptionName";
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
 * question from working. Names follow chat variables: a letter or `_`, then
 * letters, digits or `_` (the field scan only reads names shaped like that).
 *
 * `card` is the card's own text, so card questions are checked against the
 * fields they actually feed. Without it, card questions are checked only for
 * naming rules (an unused question is not reported).
 */
export function validateOnboarding(onboarding: CharacterOnboarding, card?: OnboardingCardFields): OnboardingIssue[] {
  const issues: OnboardingIssue[] = [];
  // A question is used when a field or another question's option value reads it
  // (an option value like `{{customClass}}` asks that follow-up too).
  const used = readNames(
    [
      ...ONBOARDING_PERSONA_FIELDS.map((field) => onboarding[field] ?? ""),
      ...(onboarding.variables ?? []).flatMap((variable) => variable.options.map((option) => option.value)),
    ].join("\n"),
  );
  // `seen` is shared across both lists: the two are answered in one window, so
  // the same name twice would show `{{name}}` on two questions at once.
  const seen = new Set<string>();
  /**
   * `usedNames` null = the caller gave no card text, so `unused` cannot be judged.
   * `playerExempt` is the persona list's rule: `player` names the persona, so an
   * unused one is not a mistake there. As a card variable it is an ordinary chat
   * name, and an unread one is worth the same warning as any other.
   */
  const checkNames = (variables: CharacterOnboardingVariable[], usedNames: Set<string> | null, playerExempt = true) => {
    for (const variable of variables) {
      const { id: variableId, variableName: name } = variable;
      if (!name) issues.push({ code: "emptyName", variableId, name });
      else if (!/^[A-Za-z_]\w*$/.test(name)) issues.push({ code: "invalidName", variableId, name });
      else if (seen.has(name)) issues.push({ code: "duplicateName", variableId, name });
      else if (name !== ONBOARDING_PLAYER_VARIABLE && isReservedMacroName(name))
        issues.push({ code: "reservedName", variableId, name });
      else if (!(playerExempt && name === ONBOARDING_PLAYER_VARIABLE) && usedNames && !usedNames.has(name))
        issues.push({ code: "unused", variableId, name });
      if (name) seen.add(name);
    }
  };
  checkNames(onboarding.variables ?? [], used);
  // `player` names the persona, so it is only meaningful for the persona list;
  // as a card variable it is an ordinary chat-variable name — exemption off.
  checkNames(
    onboarding.cardVariables ?? [],
    card === undefined
      ? null
      : readNames(
          [
            ...onboardingCardFieldTexts(card),
            // A card question reached only from another card question's option is
            // used, exactly as on the persona side above. Without this it was
            // flagged unused while the question that asks it was not.
            ...(onboarding.cardVariables ?? []).flatMap((variable) => variable.options.map((option) => option.value)),
          ].join("\n"),
        ),
    false,
  );
  const cardNames = new Set((onboarding.cardVariables ?? []).map((variable) => variable.variableName));
  // Every name either list defines is known to the persona's own text: a card
  // answer is saved as a chat variable, and a persona field keeps its `{{name}}`
  // through persona creation, so the prompt resolves it from the chat (measured
  // 2026-10-11). A card field is different — it is read from the chat, where
  // only card names exist.
  const personaKnown = new Set([ONBOARDING_PLAYER_VARIABLE, ...seen]);
  const isUnknown = (known: Set<string>, name: string) => !known.has(name) && !isReservedMacroName(name);
  // An option value like `{{hometown}}` with no such question would reach the text raw.
  const checkOptions = (variables: CharacterOnboardingVariable[], known: Set<string>) => {
    for (const { id: variableId, options } of variables) {
      for (const name of readNames(options.map((option) => option.value).join("\n"))) {
        if (isUnknown(known, name)) issues.push({ code: "unknownOptionName", variableId, name });
      }
    }
  };
  checkOptions(onboarding.variables ?? [], personaKnown);
  checkOptions(onboarding.cardVariables ?? [], cardNames);
  for (const field of ONBOARDING_PERSONA_FIELDS) {
    const fieldText = onboarding[field] ?? "";
    // `{{if}}` / `{{If}}` without `#` is not a conditional: it reaches the persona
    // verbatim. (`{{else if}}` is correct as is — the engine's else-if has no `#`.)
    if (/\{\{\s*if\b/i.test(fieldText)) issues.push({ code: "plainIf", field });
    for (const name of readNames(fieldText)) {
      if (isUnknown(personaKnown, name)) issues.push({ code: "unknownName", field, name });
    }
  }
  return issues;
}
