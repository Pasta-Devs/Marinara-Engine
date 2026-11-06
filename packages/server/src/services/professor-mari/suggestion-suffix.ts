import { sanitizeMariSuggestionChips } from "@marinara-engine/shared";

const OPENER = "<suggestions>";
const CLOSER = "</suggestions>";
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

// Only a flush-left block on its own line can be UI. Markdown quotes and indented examples stay prose.
export function suggestionSuffixIndex(text: string): number {
  const lastLine = text.lastIndexOf("\n") + 1;
  let index = text.lastIndexOf("\n" + OPENER) + 1;
  if (!text.startsWith(OPENER, index)) index = lastLine;
  const close = text.indexOf(CLOSER, index);
  if (close >= 0 && text.slice(close + CLOSER.length).trim()) index = lastLine;
  const tail = text.slice(index);
  if (!tail || (!tail.startsWith(OPENER) && !OPENER.startsWith(tail))) return -1;
  // A partial opener must stay hidden while it streams. Inside a fenced example it must stay visible.
  let fence = "";
  for (const match of text.slice(0, index).matchAll(/^ {0,3}(`{3,}|~{3,})([^\r\n]*)/gm)) {
    const mark = match[1]!;
    if (!fence) fence = mark;
    else if (mark.startsWith(fence) && !match[2]!.trim()) fence = "";
  }
  return fence ? -1 : index;
}

export function recoverSuggestionSuffix(content: string) {
  if (!content.trimEnd().endsWith(CLOSER)) return null;
  const index = suggestionSuffixIndex(content);
  if (index < 0) return null;
  const block = content.slice(index + OPENER.length, content.lastIndexOf(CLOSER)).trim();
  // Accept the duplicated <chips> opener seen on Gemma. The entire suffix must consist of passive chip rows.
  let rows = block;
  for (let wrappers = 0; wrappers < 2; wrappers++) {
    if (rows.startsWith("<chips>")) rows = rows.slice("<chips>".length).trimStart();
    if (rows.endsWith("</chips>")) rows = rows.slice(0, -"</chips>".length).trimEnd();
  }
  const row = /<chip\s+((?:(?:label|prompt|entity)="[^"<>]*"\s*)+)\/>\s*/gy;
  const chips = [];
  let consumed = 0;
  for (const match of rows.matchAll(row)) {
    const attrs = Object.fromEntries(
      Array.from(match[1]!.matchAll(/(label|prompt|entity)="([^"]*)"/g), ([, key, value]) => [
        key!,
        value!.replace(/&(amp|lt|gt|quot|apos);/g, (_, entity: string) => ENTITIES[entity]!),
      ]),
    );
    if (!attrs.label?.trim() || !attrs.prompt?.trim()) return null;
    chips.push(attrs);
    consumed += match[0].length;
  }
  if (!chips.length || consumed !== rows.length) return null;
  return { text: content.slice(0, index).trimEnd(), chips: sanitizeMariSuggestionChips(chips, { maxChips: 5 }) };
}
