// ──────────────────────────────────────────────
// New layout on phones and tablets: Chat settings' quick page and list headers
//
// The quick page sits under the real Connection, Preset and Persona rows: a few
// switches and the "All settings" row. The list gets plain group headers.
// ──────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { useMobileChatSettingsNav } from "./mobile-nav";

export interface MobileQuickSwitch {
  id: string;
  label: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function MobileChatSettingsQuick({
  order,
  switches,
  sectionCount,
}: {
  order: number;
  switches: MobileQuickSwitch[];
  sectionCount: number;
}) {
  const { t } = useTranslation();
  const showAll = useMobileChatSettingsNav((state) => state.showAll);
  return (
    <div className="ovm-csq" data-ovm-quick="true" style={{ order }}>
      {switches.length > 0 ? (
        <div className="ovm-csq__switches">
          {switches.map((item) => (
            <button
              key={item.id}
              type="button"
              role="switch"
              aria-checked={item.on}
              disabled={item.disabled}
              className={cn("ovm-csq__switch", item.on && "is-on")}
              onClick={item.onToggle}
            >
              <span className="ovm-csq__track" aria-hidden="true">
                <span className="ovm-csq__thumb" />
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button type="button" className="ovm-csq__all" onClick={showAll}>
        <span>{t("chat.settings.allSettings", { defaultValue: "All settings" })}</span>
        <span className="ovm-csq__all-meta">
          {sectionCount > 0
            ? t("chat.settings.sectionCount", { count: sectionCount, defaultValue: "{{count}} sections" })
            : null}
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      </button>
    </div>
  );
}

/** The list's way back to the quick page, above everything else. */
export function MobileChatSettingsBack({ order }: { order: number }) {
  const { t } = useTranslation();
  const showQuick = useMobileChatSettingsNav((state) => state.showQuick);
  return (
    <div className="ovm-cs-listback" data-ovm-list="true" style={{ order }}>
      <button type="button" className="ovm-cs-page__back" onClick={showQuick}>
        <ChevronLeft size={22} aria-hidden="true" />
        {t("chat.settings.quickSettings", { defaultValue: "Quick settings" })}
      </button>
    </div>
  );
}

export function MobileChatSettingsGroup({ order, label }: { order: number; label: string }) {
  return (
    <div className="ovm-cs-group" data-ovm-list="true" style={{ order }} role="presentation">
      {label}
    </div>
  );
}
