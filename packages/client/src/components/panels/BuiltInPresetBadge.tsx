import { useTranslation } from "react-i18next";

export function BuiltInPresetBadge() {
  const { t } = useTranslation();
  return (
    <span className="mari-chrome-muted-badge w-fit shrink-0 rounded px-1 py-0.5 text-[0.5625rem] leading-3 text-[var(--foreground)]!">
      {t("presets.library.builtIn")}
    </span>
  );
}
