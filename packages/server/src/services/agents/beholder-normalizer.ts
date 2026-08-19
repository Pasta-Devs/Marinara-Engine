// Beholder prose normalizer — converts inbound roleplay prose into the canonical
// surface form the Beholder extractor was trained and evaluated on.
//
// Canonical form: plain prose, dialogue inline in double quotes with attribution;
// no asterisks, labeled-dialogue blocks, stage-direction brackets, BBCode, HTML,
// or markdown. Roleplay text carries all of those, and the extractor never saw
// them during training, so passing raw prose measurably shifts its input away
// from the distribution its accuracy was measured on.
//
// Ported from the reference implementation in GetBeholder/Beholder-ME
// (AGPL-3.0-only), the same origin as the rest of the Beholder Agent. Keep the
// steps and their order identical: they are a contract with the model, not a
// formatting preference.

const TONE_ADVERB: Record<string, string> = {
  quiet: "quietly",
  dry: "drily",
  tired: "tiredly",
  cold: "coldly",
  soft: "softly",
  sharp: "sharply",
  flat: "flatly",
  grim: "grimly",
  warm: "warmly",
  calm: "calmly",
  firm: "firmly",
  gentle: "gently",
  harsh: "harshly",
  bitter: "bitterly",
  weary: "wearily",
  sad: "sadly",
  angry: "angrily",
  nervous: "nervously",
  cheerful: "cheerfully",
  breathless: "breathlessly",
  hoarse: "hoarsely",
  amused: "with amusement",
};

function toneToAdverb(tone: string): string {
  return TONE_ADVERB[(tone || "").trim().toLowerCase()] ?? "";
}

function titleCase(value: string): string {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/gu, (character) => character.toUpperCase());
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * Decode entities in a single pass. Chained replacements would decode the output
 * of an earlier replacement — `&amp;lt;` becoming `&lt;` and then `<` — so each
 * entity is matched once against the original text instead.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|quot|apos|nbsp|lt|gt|#39);/gu, (entity) => HTML_ENTITIES[entity] ?? entity);
}

/**
 * Build a natural dialogue attribution, fixing terminal punctuation:
 *   "Better."  -> "Better," X said.   (period becomes a comma)
 *   "Where?"   -> "Where?" X said.    (question and exclamation marks stay)
 */
function attributeDialogue(speech: string, name: string, adverb: string): string {
  const trimmed = (speech || "")
    .trim()
    .replace(/^"+|"+$/gu, "")
    .trim();
  const said = `${name} said${adverb ? ` ${adverb}` : ""}`;
  const last = trimmed.slice(-1);
  if (last === ".") return `"${trimmed.slice(0, -1)}," ${said}.`;
  if (last === "?" || last === "!") return `"${trimmed}" ${said}.`;
  return `"${trimmed}," ${said}.`;
}

/** Convert one roleplay message to the canonical plain-prose form the extractor expects. */
export function normalizeBeholderProse(message: string): string {
  let text = message || "";

  // 1. Strip OOC notes: (OOC: ...) / ((OOC: ...)) / [OOC: ...]
  text = text.replace(/[([]+\s*OOC:[^)\]]*[)\]]+/giu, "");

  // 2. Labeled dialogue blocks (quoted): Name (Tone): "speech"
  text = text.replace(/^([A-Z][A-Za-z'\- ]+?)\(([^)]+)\):[ \t]*"([^"]+)"[ \t]*$/gmu, (_match, name, tone, speech) =>
    attributeDialogue(speech, String(name).trim(), toneToAdverb(String(tone))),
  );

  // 3. Script-style ALLCAPS dialogue (unquoted): NAME (Tone): speech
  text = text.replace(/^([A-Z][A-Z'\- ]+?)\(([^)]+)\):[ \t]*(.+?)[ \t]*$/gmu, (_match, name, tone, speech) =>
    attributeDialogue(speech, titleCase(String(name)), toneToAdverb(String(tone))),
  );

  // 4. Whole-line stage directions: [Tim sits.] — before the BBCode strip below.
  text = text.replace(/^\s*\[([^\]]+)\]\s*$/gmu, (_match, inner) => {
    const sentence = String(inner).trim();
    return sentence && !/[.!?]$/u.test(sentence) ? `${sentence}.` : sentence;
  });

  // 5. Strip BBCode tags ([b], [color=red], [/url], ...)
  text = text.replace(/\[\/?[a-z][a-z0-9=#:_,\- ]*\]/giu, "");

  // 6. Strip HTML and decode entities
  text = text.replace(/<br\s*\/?>/giu, "\n").replace(/<\/p>/giu, "\n\n");
  // Strip to a fixed point: one pass over `<scr<script>ipt>` removes the inner tag
  // and leaves a working one behind. Each pass strictly shortens the text, so this
  // terminates.
  for (let previous = ""; previous !== text; ) {
    previous = text;
    text = text.replace(/<[^>]+>/gu, "");
  }
  text = decodeEntities(text);

  // 7. Strip markdown emphasis and leading block markup
  text = text
    .replace(/\*\*([^*]+?)\*\*/gu, "$1")
    .replace(/__([^_]+?)__/gu, "$1")
    .replace(/~~([^~]+?)~~/gu, "$1")
    .replace(/(?<![A-Za-z0-9])_([^_\n]+?)_(?![A-Za-z0-9])/gu, "$1");
  text = text
    .replace(/```[a-zA-Z]*\n?/gu, "")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s{0,3}>\s?/gmu, "")
    .replace(/^\s{0,3}[-*+]\s+/gmu, "");

  // 8. Unwrap asterisk action blocks: *Tim shifts.* -> Tim shifts.
  text = text.replace(/\*([^*]+?)\*/gu, (_match, inner) => {
    const sentence = String(inner).trim();
    return sentence && !/[.!?]$/u.test(sentence) ? `${sentence}.` : sentence;
  });

  // 9. Normalize whitespace: join lines into flowing prose, collapse runs, trim.
  text = text
    .replace(/[ \t]*\n[ \t]*/gu, "\n")
    .replace(/\n{2,}/gu, " ")
    .replace(/\n/gu, " ")
    .replace(/[ \t]{2,}/gu, " ")
    .trim();

  return text;
}
