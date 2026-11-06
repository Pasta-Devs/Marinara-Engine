// Pure logic for the Professor Mari composer's `@` (reference) and `/` (command) triggers, plus the
// keyboard routing that decides who owns a key: the picker, the inline ghost, or Send.

export type ComposerTrigger = "@" | "/";

export type ActiveComposerToken = {
  trigger: ComposerTrigger;
  /** The text typed after the trigger, up to the caret (the opening quote of the `@"..."` form is stripped). */
  query: string;
  /** Index of the trigger character. */
  start: number;
  /** Index just past the token (the closing quote included for a quoted token). */
  end: number;
  quoted: boolean;
};

const OPENERS = "([{\"'";

function isWhitespace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char);
}

/** `@` opens a token only at the start of the text, after whitespace or after opening punctuation. */
function canOpenAt(text: string, index: number): boolean {
  if (index === 0) return true;
  const prev = text[index - 1]!;
  return isWhitespace(prev) || OPENERS.includes(prev);
}

/** Ends a bare query: a name may hold spaces, but not a newline or a finished clause. */
const REFERENCE_STOP = /[\n.,;:!?]/;
/** A bare query is capped so a long paragraph after an `@` is not read as one name. */
const MAX_BARE_QUERY = 64;

/**
 * The `@` the caret is typing after, when the query runs to the end of the draft: then a name may hold
 * spaces (`@Fel Lock`), so no quotes are needed. Earlier in the text the token stays one word.
 */
function openBareReference(text: string, caret: number): ActiveComposerToken | null {
  if (caret !== text.length) return null;
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const floor = Math.max(lineStart, caret - 1 - MAX_BARE_QUERY);
  for (let i = caret - 1; i >= floor; i--) {
    const char = text[i]!;
    if (char === "@" && canOpenAt(text, i)) {
      if (text[i + 1] === '"') return null; // a quoted token that already closed
      const query = text.slice(i + 1, caret);
      if (REFERENCE_STOP.test(query) || /\s$/u.test(query)) return null;
      return { trigger: "@", query, start: i, end: caret, quoted: false };
    }
    if (REFERENCE_STOP.test(char)) return null;
  }
  return null;
}

/** The trigger token the caret is inside or at the end of, or null. */
export function activeToken(text: string, caret: number): ActiveComposerToken | null {
  if (caret < 0 || caret > text.length) return null;

  // Quoted `@"..."`: the query may hold spaces; a closing quote before the caret ends it.
  for (let i = 0; i < caret; i++) {
    if (text[i] !== "@" || text[i + 1] !== '"' || !canOpenAt(text, i)) continue;
    const close = text.indexOf('"', i + 2);
    if (close !== -1 && close < caret) {
      i = close;
      continue;
    }
    const query = text.slice(i + 2, caret);
    if (query.includes("\n")) continue;
    return { trigger: "@", query, start: i, end: close === -1 ? caret : close + 1, quoted: true };
  }

  // Unquoted `@` at the end of the draft: the name may hold spaces, so it needs no quotes.
  const bare = openBareReference(text, caret);
  if (bare) return bare;

  // Unquoted `@` mid-text: look inside the non-whitespace run the caret sits in.
  let wordStart = caret;
  while (wordStart > 0 && !isWhitespace(text[wordStart - 1])) wordStart--;
  for (let i = wordStart; i < caret; i++) {
    if (text[i] !== "@" || !canOpenAt(text, i)) continue;
    if (text[i + 1] === '"') return null; // a quoted token that already closed
    let end = caret;
    while (end < text.length && !isWhitespace(text[end])) end++;
    return { trigger: "@", query: text.slice(i + 1, caret), start: i, end, quoted: false };
  }

  // `/` only at the start of a line, with no further slash or whitespace in the query.
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const slash = /^([ \t]*)\/([^\s/]*)$/.exec(text.slice(lineStart, caret));
  if (slash) {
    let end = caret;
    while (end < text.length && !isWhitespace(text[end])) end++;
    return { trigger: "/", query: slash[2]!, start: lineStart + slash[1]!.length, end, quoted: false };
  }
  return null;
}

/** `@Alice`, or `@Alice in Wonderland`: a bare token may hold spaces, so no quotes are ever needed. */
export function formatReferenceToken(label: string): string {
  // Quotes and angle brackets would break the token; names are one line.
  const name = label.replace(/["<>]/g, "").replace(/\s+/g, " ").trim();
  return `@${name}`;
}

export type ComposerMark = { start: number; end: number; tone: "reference" | "pending" | "unresolved" };

/**
 * Splits `value` into runs for the draft overlay. Marks are clamped to the value, sorted, and empty or
 * overlapping ones dropped (the earlier start wins; on an equal start the longer). Joining every `text`
 * gives back `value` exactly.
 */
export function draftSegments(
  value: string,
  marks: ComposerMark[],
): Array<{ text: string; tone?: ComposerMark["tone"] }> {
  const clamped = marks
    .map((mark) => ({ ...mark, start: Math.max(0, mark.start), end: Math.min(value.length, mark.end) }))
    .filter((mark) => mark.end > mark.start)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Array<{ text: string; tone?: ComposerMark["tone"] }> = [];
  let cursor = 0;
  for (const mark of clamped) {
    if (mark.start < cursor) continue;
    if (mark.start > cursor) out.push({ text: value.slice(cursor, mark.start) });
    out.push({ text: value.slice(mark.start, mark.end), tone: mark.tone });
    cursor = mark.end;
  }
  if (cursor < value.length) out.push({ text: value.slice(cursor) });
  return out;
}

export type ComposerKeyInput = {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  isComposing: boolean;
  pickerOpen: boolean;
  hasGhost: boolean;
  /** The caret is in a live `@` token at the end of the draft: Tab on its ghost links the match, not just completes it. */
  inReferenceToken?: boolean;
  /** The picker's highlighted row is a lorebook that can show its entries (ArrowRight). */
  canDrillIn?: boolean;
  /** The picker is showing a lorebook's entries (ArrowLeft goes back). */
  canDrillOut?: boolean;
  /** A name was just completed with Tab and the caret is still at its end: Tab again links it. */
  canLinkCompletion?: boolean;
  enterToSend: boolean;
};

export type ComposerKeyAction =
  | "picker-next"
  | "picker-prev"
  | "picker-accept"
  | "picker-close"
  | "picker-drill"
  | "picker-back"
  | "ghost-accept"
  | "ghost-link"
  | "send"
  | "queue"
  | "none";

/** The actions the picker (or the linking ghost) handles; the composer routes them to its owner. */
export type ComposerPickerAction = Exclude<ComposerKeyAction, "ghost-accept" | "send" | "queue" | "none">;

/** Who owns a key in the composer textarea. Priority: picker, then the ghost, then Send. */
export function composerKeyAction(input: ComposerKeyInput): ComposerKeyAction {
  if (input.isComposing) return "none";
  if (input.pickerOpen) {
    if (input.key === "ArrowDown") return "picker-next";
    if (input.key === "ArrowUp") return "picker-prev";
    if (input.key === "Enter" || input.key === "Tab") return "picker-accept";
    if (input.key === "Escape") return "picker-close";
    if (input.key === "ArrowRight" && input.canDrillIn) return "picker-drill";
    if (input.key === "ArrowLeft" && input.canDrillOut) return "picker-back";
  }
  if (input.key === "Tab" && !input.shiftKey && input.hasGhost)
    return input.inReferenceToken ? "ghost-link" : "ghost-accept";
  // Prose: the first Tab completes the name, the second (the ghost is gone now) links it.
  if (input.key === "Tab" && !input.shiftKey && input.canLinkCompletion) return "ghost-link";
  // Enter-to-send on: Enter sends, Ctrl+Enter queues. Off: Enter is a new line, Ctrl+Enter sends, Ctrl+Shift+Enter
  // queues. Shift+Enter is a new line either way.
  if (input.key === "Enter") {
    const modifier = input.metaKey || input.ctrlKey;
    if (input.enterToSend) {
      if (!input.shiftKey) return modifier ? "queue" : "send";
    } else if (modifier) {
      return input.shiftKey ? "queue" : "send";
    }
  }
  return "none";
}

/**
 * The files a paste should attach. A screenshot arrives as a file with no text. A copy from Word or Excel
 * carries its text and a picture of it, and that paste should stay text. A file copied in a file manager
 * can carry its own name or path as the text, and that one is still a file.
 */
export function pastedFiles(data: Pick<DataTransfer, "items" | "getData">): File[] {
  const files = Array.from(data.items).flatMap((item) => {
    const file = item.kind === "file" ? item.getAsFile() : null;
    return file ? [file] : [];
  });
  const text = data.getData("text/plain").trim();
  const namesOnly = text.split(/\r?\n/).every((line) => {
    const name = line.trim().split(/[\\/]/).pop();
    return files.some((file) => file.name === name);
  });
  return !text || namesOnly ? files : [];
}
