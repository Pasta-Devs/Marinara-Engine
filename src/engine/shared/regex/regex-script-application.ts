import { applyRegexReplacement } from "./regex-replacement";

type RegexTextResolver = (value: string) => string;

export function applyRegexScriptReplacement(
  text: string,
  regex: RegExp,
  replacement: string,
  trimStrings: readonly string[],
  resolveText?: RegexTextResolver,
): string {
  let result = applyRegexReplacement(text, regex, replacement, resolveText);
  for (const trim of trimStrings) {
    const resolvedTrim = resolveText ? resolveText(trim) : trim;
    if (resolvedTrim) result = result.split(resolvedTrim).join("");
  }
  return result;
}
