/**
 * #7760: Professor Mari reads and writes a card's interactive onboarding
 * (`data.extensions.onboarding`) through `character.onboarding.get|update`.
 * The server does the parts a model is bad at (ids, option values, list
 * merging) and refuses a block the editor couldn't read or that wouldn't work,
 * with messages she can fix and retry.
 */
import {
  characterOnboardingSchema,
  ONBOARDING_MAX_QUESTIONS,
  resolveOnboardingPersona,
  validateOnboarding,
  withUniqueOnboardingIds,
  type CharacterOnboarding,
  type OnboardingAnswers,
  type OnboardingCardFields,
  type OnboardingIssue,
} from "@marinara-engine/shared";
import { newId } from "../../utils/id-generator.js";

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value : "");

const ONBOARDING_KEYS = Object.keys(characterOnboardingSchema.shape);
const QUESTION_LISTS = ["variables", "cardVariables"] as const;

/** The card text character questions feed, read the way the editor reads it. */
export function onboardingCardFields(data: Row): OnboardingCardFields {
  const extensions = isRecord(data.extensions) ? data.extensions : {};
  return {
    description: text(data.description),
    personality: text(data.personality),
    backstory: text(extensions.backstory),
    appearance: text(extensions.appearance),
    scenario: text(data.scenario),
  };
}

/** The stored block; `unreadable` when one exists that the schema rejects (the editor shows "Start over"). */
function readStoredOnboarding(data: Row): { onboarding: CharacterOnboarding | null; unreadable: boolean } {
  const extensions = isRecord(data.extensions) ? data.extensions : {};
  if (extensions.onboarding === undefined) return { onboarding: null, unreadable: false };
  const parsed = characterOnboardingSchema.safeParse(extensions.onboarding);
  return parsed.success ? { onboarding: parsed.data, unreadable: false } : { onboarding: null, unreadable: true };
}

/** A plain string is a label; a blank option value means "same as the label", like in the editor. */
function normalizeOption(option: unknown): unknown {
  if (typeof option === "string") {
    const label = option.trim();
    return label ? { id: newId(), label, value: label } : null;
  }
  if (!isRecord(option)) return option;
  const label = text(option.label);
  return { ...option, id: text(option.id) || newId(), label, value: text(option.value) || label };
}

function normalizeQuestion(question: unknown): unknown {
  if (!isRecord(question)) return question;
  const options = Array.isArray(question.options)
    ? question.options.map(normalizeOption).filter((option) => option !== null)
    : question.options;
  return {
    ...question,
    id: text(question.id) || newId(),
    variableName: question.variableName ?? question.name,
    options,
  };
}

function describeIssue(issue: OnboardingIssue, onboarding: CharacterOnboarding): string {
  switch (issue.code) {
    case "emptyName":
      return `A question has no variableName (id ${issue.variableId}).`;
    case "invalidName":
      return `"${issue.name}" is not a valid variableName: use letters, digits and _, starting with a letter or _.`;
    case "reservedName":
      return `"${issue.name}" is a built-in macro name, so its answer would never show. Pick another name.`;
    case "duplicateName":
      return `More than one question is named "${issue.name}". Names must be unique across both question lists.`;
    case "unknownOptionName":
      return `An option value uses {{${issue.name}}}, but no question has that name.`;
    case "plainIf":
      return `The ${issue.field} field has {{if ...}}. Conditions need a #: {{#if name == value}}...{{/if}}.`;
    case "unknownName":
      return `The ${issue.field} field uses {{${issue.name}}}, but no question has that name (names are case-sensitive).`;
    case "unused": {
      const isCard = onboarding.cardVariables.some(
        (variable) => variable.id === issue.variableId && variable.variableName === issue.name,
      );
      return isCard
        ? `Character question "${issue.name}" isn't used in the card's description, personality, backstory, appearance or scenario, so it is skipped. Add {{${issue.name}}} there with character.update.`
        : `Question "${issue.name}" isn't used in any of the five template fields, so players won't be asked it.`;
    }
  }
}

function checkOnboarding(onboarding: CharacterOnboarding, card: OnboardingCardFields) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const issue of validateOnboarding(onboarding, card)) {
    (issue.code === "unused" ? warnings : errors).push(describeIssue(issue, onboarding));
  }
  return { errors, warnings };
}

/** Each choice question answered with its first option, free text with `[name]`: shows where answers land. */
function samplePersona(onboarding: CharacterOnboarding) {
  const answers: OnboardingAnswers = {};
  for (const variable of onboarding.variables) {
    if (!variable.variableName) continue;
    const first = variable.options[0];
    answers[variable.variableName] = first ? { optionIds: [first.id] } : { text: `[${variable.variableName}]` };
  }
  return resolveOnboardingPersona(onboarding, answers);
}

/** `character.onboarding.get` output. */
export function describeCharacterOnboarding(data: Row) {
  const { onboarding, unreadable } = readStoredOnboarding(data);
  if (!onboarding) {
    return {
      onboarding: null,
      note: unreadable
        ? "The card has an onboarding block the editor can't read. character.onboarding.update with a full block replaces it."
        : "The card has no onboarding yet.",
    };
  }
  const { errors, warnings } = checkOnboarding(onboarding, onboardingCardFields(data));
  return { onboarding, errors, warnings, samplePersona: samplePersona(onboarding) };
}

/**
 * `character.onboarding.update`: keys in `patch` replace, omitted keys stay, and
 * a question list sent replaces the whole list. Throws with every problem when
 * the result would be unreadable or broken; `unused` questions are warnings.
 */
export function buildOnboardingUpdate(
  data: Row,
  patch: unknown,
): { onboarding: CharacterOnboarding; warnings: string[] } {
  if (!isRecord(patch)) throw new Error("character.onboarding.update needs an onboarding object.");
  const unknownKeys = Object.keys(patch).filter((key) => !ONBOARDING_KEYS.includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(
      `Unknown onboarding key(s): ${unknownKeys.join(", ")}. Use ${ONBOARDING_KEYS.join(", ")} (variables = persona questions, cardVariables = character questions).`,
    );
  }
  const stored = readStoredOnboarding(data).onboarding ?? characterOnboardingSchema.parse({});
  const merged: Row = { ...stored, ...patch };
  for (const list of QUESTION_LISTS) {
    if (Array.isArray(patch[list])) merged[list] = patch[list].map(normalizeQuestion);
  }
  const parsed = characterOnboardingSchema.safeParse(merged);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join(".") || "onboarding"}: ${issue.message}`);
    throw new Error(`Onboarding not saved, the block doesn't match the shape:\n- ${problems.join("\n- ")}`);
  }
  for (const list of QUESTION_LISTS) {
    if (parsed.data[list].length > ONBOARDING_MAX_QUESTIONS) {
      throw new Error(`Onboarding not saved: ${list} has more than ${ONBOARDING_MAX_QUESTIONS} questions.`);
    }
  }
  const onboarding = withUniqueOnboardingIds(parsed.data);
  const { errors, warnings } = checkOnboarding(onboarding, onboardingCardFields(data));
  if (errors.length > 0) throw new Error(`Onboarding not saved. Fix and retry:\n- ${errors.join("\n- ")}`);
  return { onboarding, warnings };
}
