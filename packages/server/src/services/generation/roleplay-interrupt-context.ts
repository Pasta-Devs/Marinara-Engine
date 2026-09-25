import type { WrapFormat } from "@marinara-engine/shared";
import { sanitizePromptLeaf } from "../prompt/prompt-escaping.js";
import type { GenerationPromptMessage } from "./prompt-message-scope.js";
import { prepareRoleplayInterruption } from "./roleplay-interrupt.js";

/** Update already-prepared history without replaying macros, regex scripts, or lorebook effects. */
export function updateInterruptedPromptHistory(
  messages: GenerationPromptMessage[],
  target: { id: string; originalContent: string; interruptedContent: string; part: string },
  previousBody: string,
  format: WrapFormat,
): string {
  const rawIndex = previousBody.indexOf(target.originalContent);
  let nextBody: string;
  if (rawIndex >= 0 && previousBody.indexOf(target.originalContent, rawIndex + 1) < 0) {
    // Keep speaker prefixes and attached document/caption text outside the actual message body.
    nextBody =
      previousBody.slice(0, rawIndex) +
      target.interruptedContent +
      previousBody.slice(rawIndex + target.originalContent.length);
  } else {
    const cut = prepareRoleplayInterruption(previousBody, target.part);
    if (!cut.ok) throw new Error("Interrupted history changed during prompt formatting; retry generation.");
    nextBody = cut.content;
  }
  const replacements = [
    [sanitizePromptLeaf(previousBody, format), sanitizePromptLeaf(nextBody, format)],
    [previousBody, nextBody],
  ] as const;
  let matched = false;
  for (const message of new Set(messages)) {
    if (message.id !== target.id || message.contextKind !== "history") continue;
    matched = true;
    const replacement = replacements.find(([before]) => {
      const index = message.content.indexOf(before);
      return index >= 0 && message.content.indexOf(before, index + 1) < 0;
    });
    // ponytail: replace the existing leaf only. A future formatter that rewrites it needs its own projection.
    if (!replacement) throw new Error("Interrupted history changed during prompt formatting; retry generation.");
    const [before, after] = replacement;
    const index = message.content.indexOf(before);
    message.content = message.content.slice(0, index) + after + message.content.slice(index + before.length);
  }
  if (!matched) throw new Error("Interrupted history changed during prompt formatting; retry generation.");
  return nextBody;
}
