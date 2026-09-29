/** Prompt building for the character editor's per-field Generate / Improve buttons. */

export const CHARACTER_GENERATABLE_FIELDS = [
  "description",
  "personality",
  "backstory",
  "appearance",
  "scenario",
  "first_mes",
  "mes_example",
  "alternate_greeting",
] as const;

export type CharacterGeneratableField = (typeof CHARACTER_GENERATABLE_FIELDS)[number];
export type CharacterFieldGenerationMode = "generate" | "improve";

/** Unsaved editor values; anything missing falls back to the stored card. */
export interface CharacterFieldDraft {
  name?: string;
  description?: string;
  personality?: string;
  backstory?: string;
  appearance?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
}

export function isCharacterGeneratableField(value: unknown): value is CharacterGeneratableField {
  return typeof value === "string" && (CHARACTER_GENERATABLE_FIELDS as readonly string[]).includes(value);
}

const FIELD_INSTRUCTIONS: Record<CharacterGeneratableField, { label: string; instruction: string }> = {
  description: {
    label: "Description",
    instruction:
      "Write the character's general description: who they are, their role, notable traits, and their place in the world.",
  },
  personality: {
    label: "Personality",
    instruction:
      "Write a concise personality profile: temperament, behavior, speech habits, preferences, and emotional patterns.",
  },
  backstory: {
    label: "Backstory",
    instruction: "Write the character's history: origin, formative life events, and how they became who they are now.",
  },
  appearance: {
    label: "Appearance",
    instruction:
      "Write a detailed physical description: height, build, hair, eyes, skin, clothing, and distinguishing features.",
  },
  scenario: {
    label: "Scenario",
    instruction:
      "Write the default setting or situation where interactions with {{user}} take place. Refer to the user only as {{user}}.",
  },
  first_mes: {
    label: "First Message",
    instruction:
      "Write the character's opening roleplay message that starts a new chat. Stay in character, set the scene, and give {{user}} something to respond to. Never write {{user}}'s actions or dialogue.",
  },
  mes_example: {
    label: "Example Dialogue",
    instruction:
      "Write two or three short example exchanges that show how the character talks. Begin each exchange with a line containing only <START>, then alternate lines prefixed with {{user}}: and {{char}}:.",
  },
  alternate_greeting: {
    label: "Alternate Greeting",
    instruction:
      "Write an alternate opening roleplay message for a new chat. It must use a different situation or angle than the First Message. Stay in character and never write {{user}}'s actions or dialogue.",
  },
};

const CONTEXT_FIELDS: Array<{ key: keyof CharacterFieldDraft; label: string }> = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "personality", label: "Personality" },
  { key: "backstory", label: "Backstory" },
  { key: "appearance", label: "Appearance" },
  { key: "scenario", label: "Scenario" },
  { key: "first_mes", label: "First Message" },
  { key: "mes_example", label: "Example Dialogue" },
];

export function buildCharacterFieldPrompt(args: {
  field: CharacterGeneratableField;
  mode: CharacterFieldGenerationMode;
  card: CharacterFieldDraft;
  current: string;
}): string {
  const { label, instruction } = FIELD_INSTRUCTIONS[args.field];
  const current = args.current.trim();
  const improving = args.mode === "improve" && current.length > 0;
  const context = CONTEXT_FIELDS.filter(({ key }) => key !== args.field)
    .map(({ key, label: contextLabel }) => {
      const value = args.card[key]?.trim();
      return value ? `${contextLabel}: ${value}` : null;
    })
    .filter((line): line is string => line !== null);

  return [
    `You are helping write the "${label}" field of a roleplay character card.`,
    instruction,
    improving
      ? "Improve the existing text below: keep every fact, name, and detail the author wrote, fix awkward wording, and expand thin parts using the rest of the card. Do not contradict it."
      : "Write it from scratch, consistent with the rest of the card.",
    "Use facts from the card and invent only details that fit them. Refer to the character by name or as {{char}} where natural.",
    "Return only the field text. No labels, headings, commentary, or code fences.",
    "",
    "Character card:",
    ...(context.length > 0 ? context : ["(no other fields filled in yet)"]),
    ...(improving ? ["", `Existing ${label}:`, current] : []),
  ].join("\n");
}

/** Strips the wrappers models add despite instructions. */
export function cleanGeneratedFieldText(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^```[a-z]*\s*\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}
