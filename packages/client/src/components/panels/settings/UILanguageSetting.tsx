import { Download, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useDownloadUILanguage, useUILanguages } from "../../../hooks/use-ui-languages";
import { activateLocale } from "../../../localization/i18n";
import { APP_LANGUAGE_OPTIONS } from "../../../localization/locale-loader";
import { useUIStore } from "../../../stores/ui.store";
import { HelpTooltip } from "../../ui/HelpTooltip";

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
      <select
        id={`${anchorId}-select`}
        value={language}
        onChange={(event) => void selectLanguage(event.target.value)}
        disabled={status.isLoading || download.isPending}
        className="rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--primary)] disabled:opacity-50"
      >
        {APP_LANGUAGE_OPTIONS.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <p className="text-[0.625rem] text-[var(--muted-foreground)]">{t("settings.application.language.fallback")}</p>
      {(language !== "en" || download.isPending) && (
        <button
          type="button"
          onClick={() => void selectLanguage(language, true)}
          disabled={download.isPending}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 py-2 text-xs transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
        >
          {download.isPending ? (
            <Loader2 size="0.875rem" className="animate-spin" />
          ) : status.data?.installed.includes(language) ? (
            <RefreshCw size="0.875rem" />
          ) : (
            <Download size="0.875rem" />
          )}
          {t(
            download.isPending ? "settings.application.language.downloading" : "settings.application.language.refresh",
          )}
        </button>
      )}
    </div>
  );
}
