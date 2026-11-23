/** Editable prose fields shared by character and persona cards. */
export const CARD_FIELD_KEYS = [
  "summary",
  "description",
  "personality",
  "backstory",
  "appearance",
  "scenario",
  /** The card minus its private parts, for prompts about others. Never sent as part of their own card. */
  "publicFace",
  "mes_example",
] as const;

export type CardFieldKey = (typeof CARD_FIELD_KEYS)[number];
/** Current editor values, including unsaved text used as generation guidance. */
export type CardFieldDraft = { name: string } & Record<CardFieldKey, string>;

/**
 * Wand targets beyond the card fields: the greeting (not offered as a card field alternative) and the Appearance
 * field's Image tags tab (#9640), which an Appearance alternative carries itself.
 */
export const CARD_FIELD_GENERATION_KEYS = [...CARD_FIELD_KEYS, "first_mes", "imageAppearance"] as const;
export type CardFieldGenerationKey = (typeof CARD_FIELD_GENERATION_KEYS)[number];
export type CardFieldGenerationDraft = CardFieldDraft & { first_mes?: string; imageAppearance?: string };
