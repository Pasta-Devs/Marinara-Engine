import { Download, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDownloadUILanguage, useUILanguages } from "../../../hooks/use-ui-languages";
import { activateLocale } from "../../../localization/i18n";
import { APP_LANGUAGE_OPTIONS } from "../../../localization/locale-loader";
import { useUIStore } from "../../../stores/ui.store";
import { HelpTooltip } from "../../ui/HelpTooltip";
import { LanguagePicker } from "../../ui/LanguagePicker";
import { SETTINGS_BUTTON_CLASS } from "./SettingControls";

export function UILanguageSetting({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation();
  const language = useUIStore((state) => state.language);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const status = useUILanguages();
  const download = useDownloadUILanguage();

  const selectLanguage = async (selected: string, refresh = false) => {
    try {
      if (selected !== "en" && (refresh || !status.data?.installed.includes(selected))) {
        await download.mutateAsync(selected);
        setLanguage(await activateLocale(selected, true));
      } else {
        setLanguage(selected);
      }
    } catch {
      toast.error(t("settings.application.language.downloadFailed"));
    }
  };

  return (
    <div id={anchorId} className="flex scroll-mt-3 flex-col gap-1">
      <label htmlFor={`${anchorId}-select`} className="inline-flex items-center gap-1 text-xs font-medium">
        {t("settings.application.language.label")}
        <HelpTooltip text={t("settings.application.language.help")} />
      </label>
      <LanguagePicker
        id={`${anchorId}-select`}
        label={t("settings.application.language.label")}
        value={language}
        onChange={(code) => void selectLanguage(code)}
        disabled={status.isLoading || download.isPending}
        options={APP_LANGUAGE_OPTIONS.map((option) => ({ code: option.id, label: option.label }))}
      />
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">{t("settings.application.language.fallback")}</p>
      {(language !== "en" || download.isPending) && (
        <button
          type="button"
          onClick={() => void selectLanguage(language, true)}
          disabled={download.isPending}
          className={SETTINGS_BUTTON_CLASS}
        >
          {download.isPending ? (
            <Loader2 size="0.75rem" className="animate-spin" />
          ) : status.data?.installed.includes(language) ? (
            <RefreshCw size="0.75rem" />
          ) : (
            <Download size="0.75rem" />
          )}
          {t(
            download.isPending ? "settings.application.language.downloading" : "settings.application.language.refresh",
          )}
        </button>
      )}
    </div>
  );
}
