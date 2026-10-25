// Macro linting for Professor Mari's structured writes (#7995).
//
// Models writing card text or lorebook entries can drop a brace, and an unclosed `{{` silently
// reaches the prompt as literal text: the model then "explains" the broken preview instead of
// fixing it. The check is deliberately narrow: it only refuses text whose braces cannot be
// balanced at all, because `{{` always starts a macro in Marinara and a stray `}}` always
// closes nothing. Anything ambiguous (an unknown macro name, a literal brace pair) passes.

export type MacroProblem = { field: string; message: string };

/** `null` when the braces pair up, otherwise a sentence naming the first broken spot. */
export function macroBalanceProblem(text: string): string | null {
  const opens: number[] = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    const first = text[index];
    const second = text[index + 1];
    const pair = first && second ? first + second : "";
    if (pair === "{{") {
      opens.push(index);
      index += 1;
    } else if (pair === "}}") {
      if (opens.length === 0) {
        return `has a stray "}}" at character ${index} that closes nothing`;
      }
      opens.pop();
      index += 1;
    }
  }
  if (opens.length > 0) {
    return `opens "{{" at character ${opens[0]} and never closes it with "}}"`;
  }
  return null;
}

const CARD_MACRO_FIELDS = [
  "description",
  "personality",
  "scenario",
  "summary",
  "first_mes",
  "firstMes",
  "firstMessage",
  "greeting",
  "mes_example",
  "mesExample",
  "backstory",
  "appearance",
  "aboutMe",
  "about_me",
  "about-me",
  "alternate_greetings",
  "alternateGreetings",
  // Sent as prompt text with macros resolved. Creator notes stay out: card CSS there ends in "}}".
  "system_prompt",
  "systemPrompt",
  "post_history_instructions",
  "postHistoryInstructions",
];

const ONBOARDING_MACRO_FIELDS = ["description", "personality", "backstory", "appearance", "scenario"];

function problemsIn(record: Record<string, unknown>, fields: string[]): MacroProblem[] {
  const problems: MacroProblem[] = [];
  for (const field of fields) {
    const value = record[field];
    // Alternate greetings are a list; each one renders on its own swipe.
    const texts = Array.isArray(value) ? value : [value];
    texts.forEach((text, index) => {
      if (typeof text !== "string") return;
      const message = macroBalanceProblem(text);
      if (message) problems.push({ field: Array.isArray(value) ? `${field}[${index}]` : field, message });
    });
  }
  return problems;
}

const BRACE_TAIL =
  'A macro opens with "{{" and closes with "}}"; fix the brace and send the same value again (send it without the braces if you meant literal text).';
const LITERAL_TAIL =
  'Names, tags and keys are matched and shown as written; move the macro into a text field (description, personality, scenario, first mes) or send this one without "{{".';

function refuse(action: string, problems: MacroProblem[], tail: string): never {
  const detail = problems.map((problem) => `${problem.field} ${problem.message}`).join("; ");
  throw new Error(`${action} refused by the macro linter: ${detail}. ${tail}`);
}

/**
 * The record plus any of `keys` nested in it (a model may send fields top level or wrapped). A wrapper
 * inside a wrapper ({patch:{data:{…}}}) is walked too, because the writer flattens it.
 */
function candidateRecords(record: Record<string, unknown>, keys: string[], depth = 3): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [record];
  if (depth === 0) return records;
  for (const key of keys) {
    const nested = record[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested))
      records.push(...candidateRecords(nested as Record<string, unknown>, keys, depth - 1));
  }
  return records;
}

const CARD_WRAPPERS = ["data", "patch", "card", "character"];
const ENTRY_WRAPPERS = ["data", "patch", "entry", "row"];

/**
 * The other half of #7995: fields that never interpolate macros. A `{{...}}` in a name, tag or key
 * would be stored and then shown literally forever, so name the field instead of saving the bug.
 */
function literalProblems(record: Record<string, unknown>, fields: string[]): MacroProblem[] {
  const problems: MacroProblem[] = [];
  for (const field of fields) {
    const value = record[field];
    const text = Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string").join("\n")
      : typeof value === "string"
        ? value
        : null;
    if (!text || !text.includes("{{")) continue;
    problems.push({ field, message: 'contains "{{" but this field never resolves macros' });
  }
  return problems;
}

/** Card text on `character.create` / `character.update` (top level or inside data/patch/card). */
export function assertCardMacros(record: Record<string, unknown>, action: string): void {
  // A card sent back as character.get returned it keeps backstory, appearance and aboutMe under extensions.
  const problems = candidateRecords(record, CARD_WRAPPERS)
    .flatMap((candidate) => candidateRecords(candidate, ["extensions"]))
    .flatMap((candidate) => problemsIn(candidate, CARD_MACRO_FIELDS));
  if (problems.length > 0) refuse(action, problems, BRACE_TAIL);
}

export function assertLiteralCardFields(record: Record<string, unknown>, action: string): void {
  const problems = candidateRecords(record, CARD_WRAPPERS).flatMap((candidate) =>
    literalProblems(candidate, ["name", "tags"]),
  );
  if (problems.length > 0) refuse(action, problems, LITERAL_TAIL);
}

export function assertLiteralEntryFields(record: Record<string, unknown>, action: string): void {
  const problems = candidateRecords(record, ENTRY_WRAPPERS).flatMap((candidate) =>
    literalProblems(candidate, ["name", "keys", "secondaryKeys"]),
  );
  if (problems.length > 0) refuse(action, problems, LITERAL_TAIL);
}

/** Entry text on `lorebook.addEntry|createEntry|updateEntry` (top level or inside data/entry). */
export function assertEntryMacros(record: Record<string, unknown>, action: string): void {
  const problems = candidateRecords(record, ENTRY_WRAPPERS).flatMap((candidate) => problemsIn(candidate, ["content"]));
  if (problems.length > 0) refuse(action, problems, BRACE_TAIL);
}

/** Onboarding text on `character.onboarding.update`. */
export function assertOnboardingMacros(record: Record<string, unknown>): void {
  const problems = problemsIn(record, ONBOARDING_MACRO_FIELDS);
  if (problems.length > 0) refuse("character.onboarding.update", problems, BRACE_TAIL);
}
