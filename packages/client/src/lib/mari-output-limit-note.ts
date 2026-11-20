/**
 * Professor Mari ends a run whose replies kept hitting the output limit with one note (pi-runtime.ts
 * `outputLimitStopNote`). The chat shows it apart from her words, with a button to the field that raises the limit.
 * Replies saved before the note named the field ("Raise Max Output Tokens on the connection") match too.
 */
const OUTPUT_LIMIT_NOTE =
  /Professor Mari's replies kept hitting (?:this model's|this connection's|her) output limit[^\n]*?ask for a smaller piece\./iu;

export interface MariOutputLimitNote {
  /** The note as she wrote it. */
  note: string;
  /** Whether it sends you to the connection's Max output tokens (not OpenRouter's cap or the built-in model). */
  raisable: boolean;
}

export function findMariOutputLimitNote(text: string): MariOutputLimitNote | null {
  const match = OUTPUT_LIMIT_NOTE.exec(text);
  if (!match) return null;
  return { note: match[0], raisable: /\bRaise Max Output Tokens\b/iu.test(match[0]) };
}

/** Her words without the note, which the chat shows on its own line with its button. */
export function withoutMariOutputLimitNote(text: string): string {
  return OUTPUT_LIMIT_NOTE.test(text) ? text.replace(OUTPUT_LIMIT_NOTE, "").trimEnd() : text;
}
