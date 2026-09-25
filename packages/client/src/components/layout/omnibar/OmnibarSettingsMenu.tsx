// The omnibar's own settings, in the omnibar. These preferences already existed in `ui.store` with
// no UI at all: `omnibarSuggestionsEnabled` was read in six places and could never be turned off,
// and `omnibarAsideEnabled` could only ever be turned OFF, from the aside's own dismiss link.
//
// Scope rule: only preferences that change how this panel behaves belong here. Anything that needs
// more than a switch stays in the Settings panel, which the omnibar already reaches by search.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Settings2 } from "lucide-react";

import { useUIStore } from "../../../stores/ui.store";
import { MARI_ANIMATION_PACKS } from "../../../lib/mari-work-animations";
import { cn } from "../../../lib/utils";

function SettingRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="omnibar-settings-menu__row">
      <span className="min-w-0">
        <span className="omnibar-settings-menu__label">{label}</span>
        <span className="omnibar-settings-menu__description">{description}</span>
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

/**
 * The pack browser. Packs come from `MARI_ANIMATION_PACKS`, so shipping a new drop of sprites is a
 * pack id plus its entries in `mari-work-animations.ts` — this list needs no edit to show it.
 */
function AnimationPacks() {
  const { t } = useTranslation();
  const disabled = useUIStore((state) => state.disabledMariAnimationPacks);
  const togglePack = useUIStore((state) => state.toggleMariAnimationPack);
  return (
    <div className="omnibar-settings-menu__packs">
      {MARI_ANIMATION_PACKS.map((pack) => {
        const enabled = pack.locked || !disabled.includes(pack.id);
        // One sprite stands in for the pack, animated with the same 4-frame sheet the work card uses.
        const preview = pack.animations[0];
        return (
          <label key={pack.id} className="omnibar-settings-menu__pack" data-enabled={enabled ? "true" : "false"}>
            {preview ? (
              <span
                className="omnibar-settings-menu__pack-sprite"
                aria-hidden="true"
                style={{ "--mari-work-sprite": `url(${preview.src})` } as CSSProperties}
              />
            ) : null}
            <span className="min-w-0">
              <span className="omnibar-settings-menu__label">
                {t(`mari.animationPacks.${pack.id}.label`, pack.label)}
              </span>
              <span className="omnibar-settings-menu__description">
                {t(`mari.animationPacks.${pack.id}.description`, pack.description)}{" "}
                {t("mari.animationPacks.count", "{{count}} sprites", { count: pack.animations.length })}
              </span>
            </span>
            {pack.locked ? (
              <span className="omnibar-settings-menu__locked">{t("mari.animationPacks.alwaysOn", "Always on")}</span>
            ) : (
              <input
                type="checkbox"
                role="switch"
                checked={enabled}
                onChange={(event) => togglePack(pack.id, event.target.checked)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}

export function OmnibarSettingsMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const mariEnabled = useUIStore((state) => state.commandCenterMariEnabled);
  const setMariEnabled = useUIStore((state) => state.setCommandCenterMariEnabled);
  const suggestionsEnabled = useUIStore((state) => state.omnibarSuggestionsEnabled);
  const setSuggestionsEnabled = useUIStore((state) => state.setOmnibarSuggestionsEnabled);
  const asideEnabled = useUIStore((state) => state.omnibarAsideEnabled);
  const setAsideEnabled = useUIStore((state) => state.setOmnibarAsideEnabled);
  const editViewMode = useUIStore((state) => state.mariEditViewMode);
  const setEditViewMode = useUIStore((state) => state.setMariEditViewMode);

  // The omnibar closes on Escape, so this must swallow its own Escape first (see
  // onKeyDown below). Dismissal listens for `click`, not `pointerdown`, because
  // result rows activate on click: closing on pointerdown left the click itself to
  // land on whatever sat under the popover, so dismissing the menu also opened a
  // character. Swallowing it here costs one click, which is what every menu does.
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener("click", onClickOutside, true);
    return () => document.removeEventListener("click", onClickOutside, true);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="omnibar-settings-menu"
      data-component="GlobalOmnibar.SettingsMenu"
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-expanded={open}
        aria-label={t("omnibar.settings.label", "Omnibar settings")}
        title={t("omnibar.settings.label", "Omnibar settings")}
        className={cn("omnibar-settings-menu__trigger", open && "omnibar-settings-menu__trigger--open")}
      >
        <Settings2 size={14} />
      </button>
      {open ? (
        <div
          className="omnibar-settings-menu__popover"
          role="group"
          aria-label={t("omnibar.settings.label", "Omnibar settings")}
        >
          <SettingRow
            label={t("omnibar.settings.mari.label", "Professor Mari")}
            description={t("omnibar.settings.mari.description", "Ask Mari from the search field.")}
            checked={mariEnabled}
            onChange={setMariEnabled}
          />
          <SettingRow
            label={t("omnibar.settings.suggestions.label", "Proactive suggestions")}
            description={t("omnibar.settings.suggestions.description", "Offer context and edits before you ask.")}
            checked={suggestionsEnabled}
            onChange={setSuggestionsEnabled}
          />
          <SettingRow
            label={t("omnibar.settings.aside.label", "Quick answers")}
            description={t("omnibar.settings.aside.description", "Answer a search that finds nothing.")}
            checked={asideEnabled}
            onChange={setAsideEnabled}
          />
          <div className="omnibar-settings-menu__row">
            <span className="min-w-0">
              <span className="omnibar-settings-menu__label">
                {t("omnibar.settings.editView.label", "Edit review opens in")}
              </span>
              <span className="omnibar-settings-menu__description">
                {t("omnibar.settings.editView.description", "The default view for Mari's change cards.")}
              </span>
            </span>
            <span className="omnibar-settings-menu__segmented">
              {(["easy", "raw"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={editViewMode === mode}
                  onClick={() => setEditViewMode(mode)}
                >
                  {mode === "easy"
                    ? t("ui.chat.databaseworkspaceapprovalcard.easyView")
                    : t("ui.chat.databaseworkspaceapprovalcard.rawView")}
                </button>
              ))}
            </span>
          </div>
          <div role="separator" />
          <p className="omnibar-settings-menu__heading">{t("mari.animationPacks.heading", "Mari animations")}</p>
          <AnimationPacks />
        </div>
      ) : null}
    </div>
  );
}
