// ──────────────────────────────────────────────
// loadPrompt — registry-aware prompt resolver
//
// Looks up a user override; on hit, renders it
// against the call-site context using the simple
// ${name} substitution engine. Falls back to the
// canonical default builder on miss, on disabled,
// or on any failure (so prompt rendering can
// never break the surrounding feature).
// ──────────────────────────────────────────────
import { logger } from "../../lib/logger.js";
import type { PromptOverridesStorage } from "../storage/prompt-overrides.storage.js";
import { renderTemplate } from "./template.js";
import type { PromptOverrideKeyDef } from "./registry.js";

export async function loadPrompt<TCtx extends Record<string, string | number | undefined>>(
  storage: PromptOverridesStorage,
  def: PromptOverrideKeyDef<TCtx>,
  ctx: TCtx,
  /** Optional renderer for saved templates, for keys that need compatibility handling. */
  renderSaved?: (template: string) => string,
): Promise<string> {
  try {
    const declared = def.variables.map((v) => v.name);
    const render = (template: string) => renderSaved?.(template) ?? renderTemplate(template, ctx, declared);
    const row = await storage.get(def.key);
    if (row) {
      return row.enabled ? render(row.template) : def.defaultBuilder(ctx);
    }
    for (const legacyKey of def.legacyKeys ?? []) {
      const legacyRow = await storage.get(legacyKey);
      if (legacyRow) {
        return legacyRow.enabled ? render(legacyRow.template) : def.defaultBuilder(ctx);
      }
    }
  } catch (err) {
    logger.warn(err, "[prompt-overrides] Failed to load %s, falling back to default", def.key);
  }
  return def.defaultBuilder(ctx);
}
