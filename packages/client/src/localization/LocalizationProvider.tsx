import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { activateLocale } from "./i18n";
import { useUIStore } from "../stores/ui.store";
import { syncRulesetLanguage } from "../hooks/use-capability-packages";

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const language = useUIStore((state) => state.language);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    void activateLocale(language).then((resolvedLanguage) => {
      if (active && resolvedLanguage !== language && useUIStore.getState().language === language) {
        setLanguage(resolvedLanguage);
      }
      // The rulesets' language packs follow the page's language (1.811), on opening and on each change.
      if (active && resolvedLanguage === language) void syncRulesetLanguage(resolvedLanguage, queryClient);
    });
    return () => {
      active = false;
    };
  }, [language, setLanguage, queryClient]);

  return children;
}
