import { applyRegexScriptReplacement } from "../shared/regex/regex-script-application";
import type { StorageGateway } from "../capabilities/storage";
import { bySortOrder, boolish, readString, stringArray, type JsonRecord } from "./runtime-records";

type RegexPlacement = "user_input" | "ai_output";

function placements(value: unknown): RegexPlacement[] {
  const raw = stringArray(value);
  if (raw.length > 0) {
    return raw.filter((entry): entry is RegexPlacement => entry === "user_input" || entry === "ai_output");
  }
  return value === "user_input" || value === "ai_output" ? [value] : [];
}

function flagsForScript(script: JsonRecord): string {
  const flags = readString(script.flags);
  return Array.from(new Set(flags.split("").filter((flag) => "dgimsuvy".includes(flag)))).join("");
}

export async function applyRuntimeRegexScripts(
  storage: StorageGateway,
  placement: RegexPlacement,
  input: string,
): Promise<string> {
  if (!input) return input;

  const scripts = (await storage.list<JsonRecord>("regex-scripts")).sort(bySortOrder);
  let output = input;

  for (const script of scripts) {
    if (!boolish(script.enabled, true)) continue;
    if (boolish(script.promptOnly, false)) continue;
    if (!placements(script.placement).includes(placement)) continue;

    const findRegex = readString(script.findRegex);
    if (!findRegex.trim()) continue;

    try {
      const re = new RegExp(findRegex, flagsForScript(script));
      const replacement = readString(script.replaceString);
      output = applyRegexScriptReplacement(output, re, replacement, stringArray(script.trimStrings));
    } catch {
      // Invalid user regexes are ignored during generation; the editor remains the validation surface.
    }
  }

  return output;
}
