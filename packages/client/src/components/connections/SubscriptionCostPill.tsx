// ──────────────────────────────────────────────
// NanoGPT subscription cost pill
// ──────────────────────────────────────────────
//
// Rendered beside a model in every list that shows what a model costs against a
// NanoGPT subscription: the connection editor and the shared model picker.
//
// The data comes from the `detailed=true` models call rather than the usage
// endpoint, so showing it costs no extra request. It is still gated behind the
// connection's own **Show subscription usage** toggle: a pay-as-you-go user who
// never enables the meter has no subscription cost to compare against, and the
// pills would be noise.
//
// Drawn as `.mari-editor-chip` so the shape matches the tag chips used elsewhere
// (PresetEditor, CharacterEditor, LorebookEditor) rather than inventing a local
// one. Colour comes only from the user's Accent Color: covered at the normal rate
// is an accent outline, a boosted rate adds an accent tint and a stronger border,
// and a model outside the subscription stays muted. No fixed colours, so the pills
// follow Accent Pulse and RGB Mode like the rest of the chrome.

import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

/** The subscription fields a model record may carry. */
export interface SubscriptionCostFields {
  /** True when the account's subscription covers the model; undefined when unknown. */
  subscriptionIncluded?: boolean;
  /** Input tokens charged per token of subscription quota (2 = 2x). */
  inputTokenMultiplier?: number;
}

/**
 * Cost pill for one model.
 *
 * An included model always shows a multiplier (green at 1x) so "covered at the
 * normal rate" stays visually distinct from "no data at all", which shows
 * nothing. Only `included: true` earns a multiplier pill: excluded models report
 * a multiplier of 1, and drawing that as coverage would be false.
 */
export function SubscriptionCostPill({ model }: { model: SubscriptionCostFields }) {
  const { t: localizeUi } = useUiTranslation();
  const multiplier = model.inputTokenMultiplier ?? 1;

  if (model.subscriptionIncluded === true) {
    const boosted = multiplier > 1;
    return (
      <span
        className={cn(
          "mari-editor-chip px-1.5 py-0.5 text-[0.5625rem]",
          // One accent family, so the pills follow the user's Accent Color (and Accent Pulse or
          // RGB Mode with it). Covered at the normal rate is a plain outline; a boosted rate adds
          // the accent tint and a stronger border to show it draws more from the allowance.
          //
          // Every declaration that the chip also sets is marked important: `.mari-editor-chip`
          // sits later in the same components layer, so at equal specificity it would otherwise
          // win and flatten both pills to the same neutral chip.
          boosted
            ? "!border-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_55%,transparent)] !bg-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_18%,transparent)] !text-[var(--marinara-chat-chrome-accent)]"
            : "!border-[color-mix(in_srgb,var(--marinara-chat-chrome-accent)_38%,var(--border))] !bg-transparent !text-[var(--marinara-chat-chrome-accent)]",
        )}
        title={localizeUi(
          boosted
            ? "ui.connections.connectioneditor.inputTokenMultiplierHint_boosted"
            : "ui.connections.connectioneditor.inputTokenMultiplierHint",
          { multiplier: String(multiplier) },
        )}
      >
        {localizeUi("ui.connections.connectioneditor.multiplierBadge", { multiplier: String(multiplier) })}
      </span>
    );
  }

  if (model.subscriptionIncluded === false) {
    return (
      <span
        className="mari-editor-chip px-1.5 py-0.5 text-[0.5625rem] !text-[var(--muted-foreground)]"
        title={localizeUi("ui.connections.connectioneditor.notInSubscriptionHint")}
      >
        {localizeUi("ui.connections.connectioneditor.paid")}
      </span>
    );
  }

  return null;
}
