import { useTranslation } from "react-i18next";
import { Select } from "../../components/ui/Select";
import { useFloatingWindowStore } from "../../stores/floating-window.store";

/** Automatic desktop layouts keep the chat's saved free positions available as a way back. */
export function ChatButtonLayoutSettings() {
  const { t } = useTranslation();
  const layout = useFloatingWindowStore((state) => state.buttonLayout);
  const setLayout = useFloatingWindowStore((state) => state.setButtonLayout);
  return (
    <div className="hidden border-b border-[var(--border)] px-4 py-3 md:block" data-chat-button-layout>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span>{t("chat.buttonLayout.label")}</span>
        <Select<"free" | "horizontal" | "vertical">
          label={t("chat.buttonLayout.label")}
          value={layout ?? "free"}
          options={[
            { value: "free", label: t("chat.buttonLayout.free") },
            { value: "horizontal", label: t("chat.buttonLayout.horizontal") },
            { value: "vertical", label: t("chat.buttonLayout.vertical") },
          ]}
          onChange={(value) => setLayout(value === "horizontal" || value === "vertical" ? value : undefined)}
          className="min-h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
        />
      </div>
      <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">{t("chat.buttonLayout.help")}</p>
    </div>
  );
}
