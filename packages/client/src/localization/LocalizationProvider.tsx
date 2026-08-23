import { useEffect, type ReactNode } from "react";
import { activateLocale } from "./i18n";
import { useUIStore } from "../stores/ui.store";

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const language = useUIStore((state) => state.language);
  const setLanguage = useUIStore((state) => state.setLanguage);

  useEffect(() => {
    let active = true;
    void activateLocale(language).then((resolvedLanguage) => {
      if (active && resolvedLanguage !== language && useUIStore.getState().language === language) {
        setLanguage(resolvedLanguage);
      }
    });
    return () => {
      active = false;
    };
  }, [language, setLanguage]);

  return children;
}
