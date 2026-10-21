import { List } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "../../stores/ui.store";

/** A connection-only mode skips mounting the model picker and its catalog requests. */
export function QuickSwitcherModelsToggle() {
  const { t } = useTranslation();
  const enabled = useUIStore((state) => state.quickSwitcherShowModels);
  const setEnabled = useUIStore((state) => state.setQuickSwitcherShowModels);
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={t("connections.quickSwitcher.showModels")}
      title={t("connections.quickSwitcher.showModelsHelp")}
      onClick={() => setEnabled(!enabled)}
      className="flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-[0.6875rem] text-foreground/65 hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-[var(--primary)] aria-pressed:bg-foreground/10"
    >
      <List size="0.875rem" aria-hidden />
      {t("connections.modelPicker.title")}
    </button>
  );
}
