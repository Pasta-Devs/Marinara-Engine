/**
 * Indented JSON for a person to read (a prompt, a request body, a parsed reply): each line break inside its strings
 * prints as a real line break instead of "\n", so a multi-line prompt reads as it was written. Not valid JSON.
 */
export function readableJson(value: unknown, replacer?: (this: unknown, key: string, value: unknown) => unknown) {
  // An escaped "\n" (or "\r\n") becomes a line break; one preceded by an escaped backslash ("\\n") is text.
  return (JSON.stringify(value, replacer, 2) ?? String(value)).replace(
    /(?<!\\)((?:\\\\)*)(\\r)?\\n/g,
    (_match, slashes: string, cr?: string) => (cr ? `${slashes}\r\n` : `${slashes}\n`),
  );
}
