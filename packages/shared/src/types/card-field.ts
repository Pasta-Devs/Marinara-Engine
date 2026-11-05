/** Editable prose fields shared by character and persona cards. */
export const CARD_FIELD_KEYS = [
  "summary",
  "description",
  "personality",
  "backstory",
  "appearance",
  "scenario",
  "mes_example",
] as const;

export type CardFieldKey = (typeof CARD_FIELD_KEYS)[number];
/** Current editor values, including unsaved text used as generation guidance. */
export type CardFieldDraft = { name: string } & Record<CardFieldKey, string>;

/** Greeting generation does not add greetings to chat-specific card alternatives. */
export const CARD_FIELD_GENERATION_KEYS = [...CARD_FIELD_KEYS, "first_mes"] as const;
export type CardFieldGenerationKey = (typeof CARD_FIELD_GENERATION_KEYS)[number];
export type CardFieldGenerationDraft = CardFieldDraft & { first_mes?: string };
