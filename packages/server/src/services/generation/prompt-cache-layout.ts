// ──────────────────────────────────────────────
// Cache-friendly prompt layout (Settings > Advanced > Features)
// ──────────────────────────────────────────────
// Subscription providers (Claude subscription, ChatGPT) cache a request by its prefix: everything up to
// the first byte that changed since the last request is served from the cache, everything after it is
// sent again. With the "Cache-friendly prompt layout" switch on, generation for those providers:
//   - carries the chat's whole lorebook scope as one stable `<lore>` prefix (full lore) instead of the
//     per-turn keyword scan, with entries whose text holds macros (decision blocks included) moved to a
//     separate `<lore_dynamic>` block in the volatile tail;
//   - marks app-owned blocks that change every turn (memory recall, chat summary, awareness blocks) as
//     runtime context and moves them next to the current turn, so they stop rewriting the prefix.
// With the switch off none of this runs: no markers are set and the order is exactly as assembled.
import { isFeatureEnabled } from "../features/feature-settings.js";

export interface PromptCacheLayoutMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  contextKind?: "prompt" | "history" | "injection";
  providerMetadata?: Record<string, unknown>;
}

export interface FullLorebookContextParts {
  stable: string | undefined;
  dynamic: string | undefined;
}

/** Providers whose request shape has a dedicated stable lore prefix. */
export function supportsFullLorebookContext(provider: string | null | undefined): boolean {
  return provider === "openai_chatgpt" || provider === "claude_subscription";
}

/** The layout applies: the switch is on and the provider caches a stable prefix. */
export function isCacheFriendlyPromptLayoutActive(provider: string | null | undefined): boolean {
  return supportsFullLorebookContext(provider) && isFeatureEnabled("cacheFriendlyPromptLayout");
}

/**
 * Full lore is the default for a supported provider while the layout is active. A chat opts out with
 * chat metadata `fullLorebookContext: false` and then gets the ordinary keyword lore scan.
 */
export function shouldUseFullLorebookContext(
  provider: string | null | undefined,
  explicitlyDisabled: boolean,
): boolean {
  return !explicitlyDisabled && isCacheFriendlyPromptLayoutActive(provider);
}

/**
 * Fields that mark an app-owned block as runtime context (it changes from turn to turn). Empty when the
 * layout is not active, so the block is built exactly as before.
 */
export function runtimeContextMarker(active: boolean): {
  contextKind?: "injection";
  providerMetadata?: Record<string, unknown>;
} {
  return active ? { contextKind: "injection", providerMetadata: { marinaraRuntimeContext: true } } : {};
}

export function splitFullLorebookContext(
  scan:
    | {
        fullContext?: string;
        stableFullContext?: string;
        dynamicFullContext?: string;
      }
    | null
    | undefined,
): FullLorebookContextParts {
  return { stable: scan?.stableFullContext ?? scan?.fullContext, dynamic: scan?.dynamicFullContext };
}

function isMovableRuntimeSystemBlock(message: PromptCacheLayoutMessage): boolean {
  return (
    message.role === "system" &&
    message.contextKind === "injection" &&
    (message.providerMetadata?.marinaraRuntimeContext === true ||
      message.providerMetadata?.marinaraDynamicLoreContext === true)
  );
}

/**
 * The layout a real turn would send, for a prompt preview that has no pending user message yet (Peek Prompt's
 * live preview). Generation reorders around the current user turn, so this adds a placeholder turn, applies
 * the same reordering and removes the placeholder: runtime blocks end up where the next real request carries
 * them. Returns the input order unchanged when the layout is not active for the provider.
 */
export function layoutAsNextTurn<T extends PromptCacheLayoutMessage>(
  messages: readonly T[],
  options: { provider: string | null | undefined },
): T[] {
  if (!isCacheFriendlyPromptLayoutActive(options.provider)) return messages.slice();
  const placeholder = {
    role: "user",
    content: "",
    contextKind: "history",
    providerMetadata: { marinaraNextTurnPlaceholder: true },
  } as unknown as T;
  return normalizePromptCacheLayout([...messages, placeholder]).filter(
    (message) => message.providerMetadata?.marinaraNextTurnPlaceholder !== true,
  );
}

/**
 * Keep the marked lore prefix byte for byte at the front and move the marked runtime blocks that were
 * inserted among the leading system messages to just before the current user turn (or before a trailing
 * assistant prefill when there is no current turn). User-authored prompt sections, history and unmarked
 * injections keep their placement. Returns copies; with the switch off the order is unchanged.
 */
export function normalizePromptCacheLayout<T extends PromptCacheLayoutMessage>(messages: readonly T[]): T[] {
  const next = messages.map((message) => ({ ...message })) as T[];
  if (!isFeatureEnabled("cacheFriendlyPromptLayout")) return next;

  const loreIndex = next.findIndex((message) => message.providerMetadata?.marinaraFullLoreContext === true);
  if (loreIndex > 0) {
    const [lore] = next.splice(loreIndex, 1);
    if (lore) next.unshift(lore);
  }
  const prefixLore = next[0]?.providerMetadata?.marinaraFullLoreContext === true ? 1 : 0;
  const leadingInjections: T[] = [];
  let index = prefixLore;
  while (index < next.length) {
    const message = next[index];
    if (message?.role !== "system") break;
    if (isMovableRuntimeSystemBlock(message)) leadingInjections.push(message);
    index += 1;
  }
  if (leadingInjections.length > 0) {
    const movable = new Set(leadingInjections);
    const retainedPrefix = next.slice(0, index).filter((message) => !movable.has(message));
    next.splice(0, index, ...retainedPrefix);
    const currentTurnIndex = next.reduce(
      (found, message, currentIndex) =>
        message.contextKind === "history" && message.role === "user" ? currentIndex : found,
      -1,
    );
    const prefillIndex = next.length > 0 && next[next.length - 1]?.role === "assistant" ? next.length - 1 : next.length;
    const insertAt = currentTurnIndex >= 0 ? currentTurnIndex : prefillIndex;
    next.splice(insertAt, 0, ...leadingInjections);
  }
  return next;
}
