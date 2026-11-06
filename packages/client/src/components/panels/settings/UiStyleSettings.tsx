// ──────────────────────────────────────────────
// UiStyleSettings: launcher for the floating UI style editor. Pick an element
// (or choose a region), then restyle it in the card; chips reopen saved regions and blocks.
// ──────────────────────────────────────────────
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { MousePointerClick, Pipette, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { isMobileShellViewport, useUIStore } from "../../../stores/ui.store";
import {
  UI_STYLE_PRESET_LIMITS,
  UI_STYLE_TARGETS,
  savedUiStyleTargets,
  uiStyleTargetLabel,
  type UiStylePreset,
  type UiStyleTargetId,
} from "../../../lib/ui-style-overrides";
import {
  SETTINGS_BUTTON_CLASS,
  SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS,
  SETTINGS_ICON_BUTTON_CLASS,
  SettingsSection,
} from "./SettingControls";

const SELECT_CLASS =
  "min-w-[8rem] flex-1 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:ring-1 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65";

const PREVIEW_SWATCHES = 4;

/** A few of the preset's regions as small swatches: their background, with the text color as a dot. */
function PresetPreview({ preset }: { preset: UiStylePreset }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-1">
      {Object.values(preset.overrides)
        .slice(0, PREVIEW_SWATCHES)
        .map((style, index) => (
          <span
            key={index}
            className="grid h-4 w-4 place-items-center rounded-full ring-1 ring-[var(--border)]"
            style={{ background: style?.background ?? "var(--secondary)" }}
          >
            {style?.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: style.color }} />}
          </span>
        ))}
    </span>
  );
}

export function UiStyleSettings({ anchorId }: { anchorId?: string }) {
  const { t } = useTranslation();
  const { saved, presets, selectedTarget, unsaved } = useUIStore(
    useShallow((s) => ({
      saved: s.uiStyleOverrides,
      presets: s.uiStylePresets,
      selectedTarget: s.uiStyleSelectedTarget,
      unsaved: s.uiStylePreview != null,
    })),
  );
  const resetAll = useUIStore((s) => s.resetUiStyleOverrides);
  const setPickMode = useUIStore((s) => s.setUiStylePickMode);
  const setSelectedTarget = useUIStore((s) => s.setUiStyleSelectedTarget);
  const closeRightPanel = useUIStore((s) => s.closeRightPanel);
  const savePreset = useUIStore((s) => s.saveUiStylePreset);
  const applyPreset = useUIStore((s) => s.applyUiStylePreset);
  const deletePreset = useUIStore((s) => s.deleteUiStylePreset);
  const [naming, setNaming] = useState<string | null>(null);

  const savedTargets = savedUiStyleTargets(saved);
  const savedBlocks = savedTargets.filter((target) => target.className);
  const lockedTitle = unsaved ? t("settings.appearance.uiStyles.saveOrRevertFirst") : undefined;

  // On a phone the settings panel covers the whole app, so step aside to let the user see it.
  const stepAside = () => {
    if (isMobileShellViewport()) closeRightPanel();
  };
  const openEditor = (id: UiStyleTargetId | null) => {
    if (id) stepAside();
    setSelectedTarget(id);
  };
  const startPick = () => {
    stepAside();
    setSelectedTarget(null);
    setPickMode(true);
  };
  const handleResetAll = () => {
    if (!window.confirm(t("settings.appearance.uiStyles.resetAllConfirm"))) return;
    resetAll();
    setSelectedTarget(null);
  };

  const handleSavePreset = (event: FormEvent) => {
    event.preventDefault();
    if (naming?.trim()) savePreset(naming);
    setNaming(null);
  };
  const handleApplyPreset = (preset: UiStylePreset) => {
    if (savedTargets.length > 0 && !window.confirm(t("settings.appearance.uiStyles.applyPresetConfirm"))) return;
    applyPreset(preset.id);
    setSelectedTarget(null);
  };
  const handleDeletePreset = (preset: UiStylePreset) => {
    if (window.confirm(t("settings.appearance.uiStyles.deletePresetConfirm", { name: preset.name }))) {
      deletePreset(preset.id);
    }
  };

  return (
    <SettingsSection
      title={t("settings.sections.uiElementStyles.title")}
      description={t("settings.sections.uiElementStyles.description")}
      help={t("settings.appearance.uiStyles.help")}
      icon={<Pipette size="0.875rem" />}
      anchorId={anchorId}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startPick}
            disabled={unsaved}
            title={lockedTitle}
            className={SETTINGS_BUTTON_CLASS}
          >
            <MousePointerClick size="0.75rem" />
            {t("settings.appearance.uiStyles.pickElement")}
          </button>
          <select
            value={selectedTarget ?? ""}
            onChange={(event) => openEditor((event.target.value || null) as UiStyleTargetId | null)}
            disabled={unsaved}
            title={lockedTitle}
            aria-label={t("settings.appearance.uiStyles.region")}
            className={SELECT_CLASS}
          >
            <option value="">{t("settings.appearance.uiStyles.noneSelected")}</option>
            {[...UI_STYLE_TARGETS, ...savedBlocks].map((target) => (
              <option key={target.id} value={target.id}>
                {uiStyleTargetLabel(target, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={savedTargets.length === 0}
            className={SETTINGS_BUTTON_CLASS}
          >
            <RotateCcw size="0.75rem" />
            {t("settings.appearance.uiStyles.resetAll")}
          </button>
        </div>

        {savedTargets.length > 0 && (
          <div
            role="group"
            aria-label={t("settings.appearance.uiStyles.styledRegions")}
            className="flex flex-wrap gap-1.5"
          >
            {savedTargets.map((target) => {
              const style = saved[target.id];
              // Blocks belong to particular screens; say when this one is elsewhere.
              const offScreen = !!target.className && !document.querySelector(target.selector);
              return (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => openEditor(target.id)}
                  disabled={unsaved}
                  title={lockedTitle}
                  aria-pressed={selectedTarget === target.id}
                  className={SETTINGS_BUTTON_CLASS}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-[var(--border)]"
                    style={{
                      background: style?.background ?? "var(--secondary)",
                      ...(style?.borderColor && { boxShadow: `inset 0 0 0 1px ${style.borderColor}` }),
                    }}
                  />
                  {uiStyleTargetLabel(target, t)}
                  {offScreen && (
                    <span className="text-[var(--muted-foreground)]">
                      · {t("settings.appearance.uiStyles.notOnScreen")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="text-[0.6875rem] font-semibold">{t("settings.appearance.uiStyles.presets")}</span>
            {naming === null && (
              <button
                type="button"
                onClick={() => setNaming("")}
                disabled={unsaved || savedTargets.length === 0 || presets.length >= UI_STYLE_PRESET_LIMITS.count}
                title={
                  presets.length >= UI_STYLE_PRESET_LIMITS.count
                    ? t("settings.appearance.uiStyles.presetsFull")
                    : lockedTitle
                }
                className={SETTINGS_BUTTON_CLASS}
              >
                <Plus size="0.75rem" />
                {t("settings.appearance.uiStyles.savePreset")}
              </button>
            )}
          </div>
          {naming !== null && (
            <form onSubmit={handleSavePreset} className="flex items-center gap-1.5">
              <input
                autoFocus
                value={naming}
                maxLength={UI_STYLE_PRESET_LIMITS.nameLength}
                aria-label={t("settings.appearance.uiStyles.presetName")}
                onChange={(event) => setNaming(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  event.stopPropagation();
                  setNaming(null);
                }}
                className={cn(SELECT_CLASS, "min-w-0")}
              />
              <button type="submit" disabled={!naming.trim()} className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}>
                {t("settings.appearance.uiStyles.save")}
              </button>
              <button
                type="button"
                onClick={() => setNaming(null)}
                aria-label={t("settings.appearance.uiStyles.cancelPick")}
                title={t("settings.appearance.uiStyles.cancelPick")}
                className={SETTINGS_ICON_BUTTON_CLASS}
              >
                <X size="0.75rem" />
              </button>
            </form>
          )}
          {presets.length === 0 ? (
            <p className="text-[0.625rem] text-[var(--muted-foreground)]">
              {t("settings.appearance.uiStyles.presetsEmpty")}
            </p>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} className="flex min-w-0 items-center gap-2">
                <PresetPreview preset={preset} />
                <span className="min-w-0 flex-1 truncate text-[0.6875rem]">{preset.name}</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  disabled={unsaved}
                  title={lockedTitle}
                  className={SETTINGS_BUTTON_CLASS}
                >
                  {t("settings.appearance.uiStyles.applyPreset")}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePreset(preset)}
                  aria-label={t("settings.appearance.uiStyles.deletePreset")}
                  title={t("settings.appearance.uiStyles.deletePreset")}
                  className={cn(SETTINGS_ICON_BUTTON_CLASS, "mari-chrome-control--danger shrink-0")}
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </SettingsSection>
  );
}
