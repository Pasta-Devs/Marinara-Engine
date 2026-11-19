import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/** A language's own name in the Engine's language ("en-gb" → "English (United Kingdom)"). */
export function useLanguageName() {
  const { i18n } = useTranslation();
  return useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([i18n.language, "en"], { type: "language" });
    } catch {
      names = null;
    }
    return (code: string) => {
      try {
        return names?.of(code) ?? code;
      } catch {
        return code;
      }
    };
  }, [i18n.language]);
}
