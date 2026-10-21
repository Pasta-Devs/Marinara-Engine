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
