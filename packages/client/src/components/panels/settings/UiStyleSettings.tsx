// ──────────────────────────────────────────────
// UiStyleSettings: pick a curated interface region and restyle it.
// Draft/Save/Revert like TrackerCardColorSettings: edits preview live and only
// persist on Save.
// ──────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { MousePointerClick, Pipette, RotateCcw, Save, X } from "lucide-react";
import { useUIStore } from "../../../stores/ui.store";
import {
  UI_STYLE_LIMITS,
  UI_STYLE_TARGETS,
  normalizeUiStyleOverride,
  serializeUiStyleOverride,
  type UiStyleOverride,
  type UiStyleTargetId,
} from "../../../lib/ui-style-overrides";
import { ColorPicker } from "../../ui/ColorPicker";
import {
  SETTINGS_BUTTON_CLASS,
  SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS,
  SETTINGS_ICON_BUTTON_CLASS,
  SettingsSection,
} from "./SettingControls";

type ColorKey = "background" | "color" | "borderColor";
type NumberKey = "borderRadius" | "opacity" | "fontSize";

const COLOR_FIELDS: { key: ColorKey; labelKey: string; gradient?: boolean }[] = [
  { key: "background", labelKey: "settings.appearance.uiStyles.background", gradient: true },
  { key: "color", labelKey: "settings.appearance.uiStyles.textColor" },
  { key: "borderColor", labelKey: "settings.appearance.uiStyles.borderColor" },
];

/** `fallback` is only where the slider rests while the property is unset ("Default"). */
const NUMBER_FIELDS: { key: NumberKey; labelKey: string; unit: string; fallback: number }[] = [
  { key: "borderRadius", labelKey: "settings.appearance.uiStyles.borderRadius", unit: "px", fallback: 8 },
  { key: "opacity", labelKey: "settings.appearance.uiStyles.opacity", unit: "%", fallback: 100 },
  { key: "fontSize", labelKey: "settings.appearance.uiStyles.fontSize", unit: "px", fallback: 14 },
];

const SELECT_CLASS =
  "min-w-0 rounded-md border border-[var(--border)] bg-[var(--secondary)] px-2 py-1.5 text-[0.6875rem] text-[var(--foreground)] outline-none transition-shadow focus:ring-1 focus:ring-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-65";

export function UiStyleSettings({ anchorId }: { anchorId?: string }) {
  const { t } = useTranslation();
  const { saved, selectedTarget } = useUIStore(
    useShallow((s) => ({
      saved: s.uiStyleOverrides,
      selectedTarget: s.uiStyleSelectedTarget,
    })),
  );
  const saveOverride = useUIStore((s) => s.saveUiStyleOverride);
  const resetAll = useUIStore((s) => s.resetUiStyleOverrides);
  const setPickMode = useUIStore((s) => s.setUiStylePickMode);
  const setSelectedTarget = useUIStore((s) => s.setUiStyleSelectedTarget);
  const setPreview = useUIStore((s) => s.setUiStylePreview);

  const savedOverride = selectedTarget ? (saved[selectedTarget] ?? null) : null;
  // The edit belongs to the region it was made on; any other region reads straight from storage.
  const [edit, setEdit] = useState<{ target: UiStyleTargetId; override: UiStyleOverride } | null>(null);
  const draft: UiStyleOverride = edit && edit.target === selectedTarget ? edit.override : (savedOverride ?? {});
  const dirty = !!selectedTarget && serializeUiStyleOverride(draft) !== serializeUiStyleOverride(savedOverride);
  const hasSavedOverrides = Object.keys(saved).length > 0;

  // The live preview mirrors the draft; neither it nor pick mode outlives the editor.
  useEffect(() => {
    setPreview(selectedTarget && dirty ? { target: selectedTarget, override: draft } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `draft` changes only with `edit`, `selectedTarget` or `saved`
  }, [selectedTarget, dirty, edit, saved, setPreview]);
  useEffect(
    () => () => {
      setPreview(null);
      setPickMode(false);
    },
    [setPreview, setPickMode],
  );

  const setDraft = (override: UiStyleOverride) => {
    if (selectedTarget) setEdit({ target: selectedTarget, override });
  };
  const updateField = (key: keyof UiStyleOverride, value: string | number | undefined) => {
    const next = { ...draft };
    if (value === undefined || value === "") delete next[key];
    else (next as Record<string, string | number>)[key] = value;
    setDraft(next);
  };

  const handleSave = () => {
    if (!selectedTarget) return;
    saveOverride(selectedTarget, draft);
    setEdit(null);
    setPreview(null);
  };
  const handleRevert = () => setEdit(null);
  const handleResetRegion = () => {
    if (!selectedTarget) return;
    saveOverride(selectedTarget, null);
    setEdit(null);
    setPreview(null);
  };
  const handleResetAll = () => {
    if (!window.confirm(t("settings.appearance.uiStyles.resetAllConfirm"))) return;
    resetAll();
    setEdit(null);
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
            onClick={() => setPickMode(true)}
            disabled={dirty}
            title={dirty ? t("settings.appearance.uiStyles.saveOrRevertFirst") : undefined}
            className={SETTINGS_BUTTON_CLASS}
          >
            <MousePointerClick size="0.75rem" />
            {t("settings.appearance.uiStyles.pickElement")}
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={!hasSavedOverrides}
            className={SETTINGS_BUTTON_CLASS}
          >
            <RotateCcw size="0.75rem" />
            {t("settings.appearance.uiStyles.resetAll")}
          </button>
        </div>

        <label className="grid min-w-0 gap-1">
          <span className="px-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
            {t("settings.appearance.uiStyles.region")}
          </span>
          <select
            value={selectedTarget ?? ""}
            onChange={(event) => setSelectedTarget((event.target.value || null) as UiStyleTargetId | null)}
            disabled={dirty}
            title={dirty ? t("settings.appearance.uiStyles.saveOrRevertFirst") : undefined}
            className={SELECT_CLASS}
          >
            <option value="">{t("settings.appearance.uiStyles.noneSelected")}</option>
            {UI_STYLE_TARGETS.map((target) => (
              <option key={target.id} value={target.id}>
                {t(target.labelKey)}
              </option>
            ))}
          </select>
        </label>

        {selectedTarget && (
          <>
            {COLOR_FIELDS.map((field) => (
              <ColorPicker
                key={field.key}
                compact
                gradient={field.gradient}
                label={t(field.labelKey)}
                value={draft[field.key] ?? ""}
                onChange={(value) => updateField(field.key, value)}
                helpText={
                  draft[field.key] && !normalizeUiStyleOverride({ [field.key]: draft[field.key] })
                    ? t("settings.appearance.uiStyles.invalidColor")
                    : undefined
                }
                emptyText={t("settings.appearance.uiStyles.themeDefault")}
                clearLabel={t("settings.appearance.uiStyles.useDefault")}
              />
            ))}

            <div className="grid min-w-0 gap-1">
              {NUMBER_FIELDS.map((field) => {
                const value = draft[field.key];
                const [min, max] = UI_STYLE_LIMITS[field.key];
                const label = t(field.labelKey);
                const valueText =
                  value === undefined ? t("settings.appearance.uiStyles.themeDefault") : String(value) + field.unit;
                return (
                  <div
                    key={field.key}
                    className="grid min-w-0 grid-cols-[4.5rem_minmax(0,1fr)_3.5rem_1.5rem] items-center gap-1.5 rounded-md bg-[var(--background)]/24 px-1.5 py-1 ring-1 ring-[var(--border)]/25"
                  >
                    <span className="truncate text-[0.5625rem] font-semibold text-[var(--foreground)]/80">{label}</span>
                    <input
                      type="range"
                      aria-label={label}
                      min={min}
                      max={max}
                      value={value ?? field.fallback}
                      onChange={(event) => updateField(field.key, Number(event.target.value))}
                      className="h-1.5 w-full min-w-0 cursor-pointer accent-[var(--primary)]"
                    />
                    <span className="justify-self-end font-mono text-[0.5625rem] tabular-nums text-[var(--muted-foreground)]">
                      {valueText}
                    </span>
                    <button
                      type="button"
                      aria-label={t("settings.appearance.uiStyles.useDefault")}
                      title={t("settings.appearance.uiStyles.useDefault")}
                      onClick={() => updateField(field.key, undefined)}
                      disabled={value === undefined}
                      className={SETTINGS_ICON_BUTTON_CLASS}
                    >
                      <X size="0.75rem" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 px-0.5">
              {dirty && (
                <span className="mr-auto text-[0.625rem] text-[var(--muted-foreground)]">
                  {t("settings.appearance.uiStyles.unsavedPreview")}
                </span>
              )}
              <button
                type="button"
                onClick={handleResetRegion}
                disabled={!savedOverride && !dirty}
                className={SETTINGS_BUTTON_CLASS}
              >
                {t("settings.appearance.uiStyles.resetRegion")}
              </button>
              <button type="button" onClick={handleRevert} disabled={!dirty} className={SETTINGS_BUTTON_CLASS}>
                {t("settings.appearance.uiStyles.revert")}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty}
                className={SETTINGS_COMPACT_PRIMARY_BUTTON_CLASS}
              >
                <Save size="0.75rem" />
                {t("settings.appearance.uiStyles.save")}
              </button>
            </div>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
