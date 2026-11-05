import { useTranslation } from "react-i18next";
import { useFloatingWindowStore } from "../../stores/floating-window.store";

/** Automatic desktop layouts keep the chat's saved free positions available as a way back. */
export function ChatButtonLayoutSettings() {
  const { t } = useTranslation();
  const layout = useFloatingWindowStore((state) => state.buttonLayout);
  const setLayout = useFloatingWindowStore((state) => state.setButtonLayout);
  return (
    <div className="hidden border-b border-[var(--border)] px-4 py-3 md:block" data-chat-button-layout>
      <label className="flex items-center justify-between gap-3 text-xs">
        <span>{t("chat.buttonLayout.label")}</span>
        <select
          aria-label={t("chat.buttonLayout.label")}
          value={layout ?? "free"}
          onChange={(event) => {
            const value = event.target.value;
            setLayout(value === "horizontal" || value === "vertical" ? value : undefined);
          }}
          className="min-h-9 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
        >
          <option value="free">{t("chat.buttonLayout.free")}</option>
          <option value="horizontal">{t("chat.buttonLayout.horizontal")}</option>
          <option value="vertical">{t("chat.buttonLayout.vertical")}</option>
        </select>
      </label>
      <p className="mt-1 text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">{t("chat.buttonLayout.help")}</p>
    </div>
  );
}
