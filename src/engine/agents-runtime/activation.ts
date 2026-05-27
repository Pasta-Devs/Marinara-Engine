import {
  normalizeCustomAgentActivationKeywords,
  normalizeCustomAgentActivationScanDepth,
} from "../contracts/constants/agent-activation.js";
import { testPrimaryKeys } from "../shared/regex/lorebook-keyword-matching.js";

export interface ActivationScanMessage {
  content?: unknown;
}

export interface AgentActivationMatch {
  configured: boolean;
  matched: boolean;
  keywords: string[];
  matchedKeywords: string[];
  scanDepth: number;
}

export function matchCustomAgentActivation(
  settings: Record<string, unknown>,
  messages: ActivationScanMessage[],
): AgentActivationMatch {
  const keywords = normalizeCustomAgentActivationKeywords(settings.activationKeywords);
  const scanDepth = normalizeCustomAgentActivationScanDepth(settings.activationScanDepth);

  if (keywords.length === 0) {
    return { configured: false, matched: true, keywords, matchedKeywords: [], scanDepth };
  }

  const scanText = messages
    .slice(-scanDepth)
    .map((message) => (typeof message.content === "string" ? message.content : ""))
    .filter(Boolean)
    .join("\n");
  const result = testPrimaryKeys(keywords, scanText, {
    useRegex: false,
    matchWholeWords: false,
    caseSensitive: false,
  });

  return {
    configured: true,
    matched: result.matched,
    keywords,
    matchedKeywords: result.matchedKeys,
    scanDepth,
  };
}
