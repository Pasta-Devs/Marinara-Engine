import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  FEATURE_NUMBER_SETTINGS,
  FEATURE_SWITCH_DEFAULTS,
  resolveFeatureEnabled,
  resolveFeatureNumber,
  type FeatureNumberName,
  type FeatureSettings,
  type FeatureSwitchName,
} from "@marinara-engine/shared";
import { getPrivilegedActionErrorMessage } from "../../../lib/api-client";
import { useUIStore } from "../../../stores/ui.store";
import { useFeatureSettings, useSaveFeatureSettings } from "../../../hooks/use-feature-settings";
import { DraftNumberInput } from "../../ui/DraftNumberInput";
import { ToggleSetting } from "./SettingControls";

export const FEATURE_SWITCHES_CONTROL_ID = "feature-switches";

/** Server switches in display order, each with the number setting it owns (if any). */
const SERVER_SWITCHES: ReadonlyArray<{ name: FeatureSwitchName; number?: FeatureNumberName }> = [
  { name: "cacheFriendlyPromptLayout" },
  { name: "stableLorebookGroupPicks" },
  { name: "providerRetry" },
  { name: "backgroundCallCap", number: "backgroundCallsPerHour" },
  { name: "generationJobTracking" },
  { name: "consoleTray" },
];

const NUMBER_INPUT_CLASS =
  "w-24 shrink-0 rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--ring)]";

/**
 * Settings > Advanced > Features: optional server behaviours. Every switch starts off, which keeps
 * the standard behaviour; a switch pinned by a server environment variable is shown locked.
 */
export function FeatureSwitchesSettings({ anchorId }: { anchorId?: string }) {
  const { t } = useTranslation();
  const query = useFeatureSettings();
  const save = useSaveFeatureSettings();
  const settings = query.data?.settings;
  const envOverrides = query.data?.envOverrides ?? {};
  const envEffective = query.data?.effective ?? {};
  const unavailable = query.data?.unavailable ?? {};
  const disabled = !query.data || save.isPending;

  const update = (patch: FeatureSettings) => {
    const next: FeatureSettings = { ...(settings ?? {}), ...patch };
    // Store only what differs from the default so a later default change still reaches this install.
    for (const key of Object.keys(next) as Array<keyof FeatureSettings>) {
      if (key in FEATURE_NUMBER_SETTINGS) {
        if (next[key] === FEATURE_NUMBER_SETTINGS[key as FeatureNumberName].defaultValue) delete next[key];
      } else if (next[key] === FEATURE_SWITCH_DEFAULTS[key as FeatureSwitchName]) {
        delete next[key];
      }
    }
    save.mutate(next, {
      onError: (error) => toast.error(getPrivilegedActionErrorMessage(error, t("settings.features.saveFailed"))),
    });
  };

  const envNote = (name: FeatureSwitchName | FeatureNumberName) => {
    const envVar = envOverrides[name];
    return envVar ? t("settings.features.envLocked", { name: envVar }) : null;
  };

  return (
    <div id={anchorId} className="flex scroll-mt-3 flex-col gap-1">
      {query.isError ? (
        <p className="px-1.5 text-[0.625rem] leading-relaxed text-[var(--destructive)]">
          {t("settings.features.loadFailed")}
        </p>
      ) : null}
      {SERVER_SWITCHES.map(({ name, number }) => {
        // A switch pinned by an environment variable shows the value in effect, not the saved one.
        const enabled = envEffective[name] ?? resolveFeatureEnabled(settings, name);
        // A switch this server's platform cannot run (the Windows-only console tray elsewhere) is shown, not offered.
        const unavailableReason = unavailable[name];
        const locked = unavailableReason ? t(`settings.features.unavailable.${unavailableReason}`) : envNote(name);
        return (
          <div key={name} className="flex flex-col">
            <ToggleSetting
              label={t(`settings.features.${name}.label`)}
              checked={enabled && !unavailableReason}
              disabled={disabled || !!locked}
              onChange={(value) => update({ [name]: value })}
              help={t(`settings.features.${name}.help`)}
            />
            {locked ? (
              <p className="px-1.5 pb-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">{locked}</p>
            ) : null}
            {name === "generationJobTracking" && enabled ? (
              <button
                type="button"
                onClick={() => useUIStore.getState().openModal("generation-jobs")}
                className="mx-1.5 mb-1.5 min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
              >
                {t("settings.features.generationJobTracking.open")}
              </button>
            ) : null}
            {number && enabled && !envNote(number) ? (
              <label className="flex items-center justify-between gap-3 px-1.5 pb-1.5 text-xs text-[var(--muted-foreground)]">
                <span>{t(`settings.features.${number}.label`)}</span>
                <DraftNumberInput
                  value={resolveFeatureNumber(settings, number)}
                  min={FEATURE_NUMBER_SETTINGS[number].min}
                  max={FEATURE_NUMBER_SETTINGS[number].max}
                  disabled={disabled}
                  ariaLabel={t(`settings.features.${number}.label`)}
                  onCommit={(value) => update({ [number]: value })}
                  className={NUMBER_INPUT_CLASS}
                />
              </label>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
