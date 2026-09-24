import { createHash } from "node:crypto";

import type { ChatMessage } from "../base-provider.js";
import { isFeatureEnabled } from "../../features/feature-settings.js";

const FULL_LORE_METADATA_KEY = "marinaraFullLoreContext";
const CACHE_SCOPE_NAMESPACE = "marinara-chat-cache-scope:v1:";

/** Shape a 40-hex identity like a UUID for the `session-id` header. */
export function formatOpenAIChatGPTCacheSession(identity: string): string {
  const hash = identity;
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * The opaque routing identity for the ChatGPT subscription cache: requests for the same chat's full-lore
 * prefix share it, so they reach the same cache. It is derived from the chat id the full-lore block carries
 * (stable when the lore is edited), or from the lore text when no chat id is attached.
 *
 * Undefined unless the request carries the full-lore prefix of the cache-friendly prompt layout
 * (Settings > Advanced > Features, off by default): then no `session-id` header and no `prompt_cache_key`
 * are sent, as before.
 */
export function resolveOpenAIChatGPTCacheIdentity(messages: ChatMessage[]): string | undefined {
  if (!isFeatureEnabled("cacheFriendlyPromptLayout")) return undefined;
  const lore = messages.find((message) => message.providerMetadata?.[FULL_LORE_METADATA_KEY] === true);
  if (!lore) return undefined;

  const rawScope = lore.providerMetadata?.marinaraCacheScope;
  const scope = typeof rawScope === "string" ? rawScope.trim() : "";
  const material = scope ? `${CACHE_SCOPE_NAMESPACE}${scope}` : lore.content;
  return createHash("sha256").update(material).digest("hex").slice(0, 40);
}

/** The `session-id` header value for a request, or undefined when none is sent. */
export function resolveOpenAIChatGPTCacheSession(messages: ChatMessage[]): string | undefined {
  const identity = resolveOpenAIChatGPTCacheIdentity(messages);
  return identity ? formatOpenAIChatGPTCacheSession(identity) : undefined;
}
