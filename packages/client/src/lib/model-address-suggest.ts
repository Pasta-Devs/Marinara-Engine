// ──────────────────────────────────────────────
// The Own address a Model probably wants. Some proxies serve each vendor on its own path ("/proxy/openai",
// "/proxy/google-ai", "/proxy/zai"), so a Model of another family than the Connection's own path needs one.
// First what the account already does (another Claude Model there uses "/proxy/anthropic"), then the usual
// path names of such proxies, only when the Connection's own path follows that pattern. Only ever a suggestion.
// ──────────────────────────────────────────────
import { resolveModelAddress } from "@marinara-engine/shared";
import { familyOf } from "./model-families";

/** Family -> the path segment per-vendor proxies use for it. */
const VENDOR_SEGMENT: Record<string, string> = {
  gpt: "openai",
  claude: "anthropic",
  gemini: "google-ai",
  deepseek: "deepseek",
  grok: "xai",
  glm: "zai",
  kimi: "moonshot-ai",
  mistral: "mistral-ai",
  qwen: "qwen",
};
const KNOWN_SEGMENTS = new Set(Object.values(VENDOR_SEGMENT));

function pathOf(address: string | null | undefined): string | null {
  try {
    const path = new URL(address ?? "").pathname.replace(/\/+$/u, "");
    return path || null;
  } catch {
    return null;
  }
}

export interface AddressSibling {
  model?: string | null;
  modelBaseUrl?: string | null;
}

/** The path to suggest for `model` on the account at `accountBaseUrl`, or null when none is needed or known. */
export function suggestModelAddressPath(
  model: string | null | undefined,
  accountBaseUrl: string | null | undefined,
  siblings: readonly AddressSibling[] = [],
): string | null {
  if (!model?.trim() || !accountBaseUrl?.trim()) return null;
  const family = familyOf(model).key;
  if (family === "other") return null;
  const accountPath = pathOf(accountBaseUrl);
  // What the account's other Models of this family already use (their own path, or the Connection's own).
  const counts = new Map<string, number>();
  for (const sibling of siblings) {
    if (!sibling.model || familyOf(sibling.model).key !== family) continue;
    const resolved = sibling.modelBaseUrl?.trim() ? resolveModelAddress(sibling.modelBaseUrl, accountBaseUrl) : null;
    const path = resolved ? pathOf(resolved) : accountPath;
    if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  const learned = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  if (learned) return learned === accountPath ? null : learned;
  // The usual per-vendor names, when the Connection's own path is one of them ("/proxy/google-ai").
  const segment = VENDOR_SEGMENT[family];
  if (!accountPath || !segment) return null;
  const parts = accountPath.split("/");
  const at = parts.findIndex((part) => KNOWN_SEGMENTS.has(part.toLowerCase()));
  if (at < 0) return null;
  parts[at] = segment;
  const path = parts.join("/");
  return path === accountPath ? null : path;
}
