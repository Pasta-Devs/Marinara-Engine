// ──────────────────────────────────────────────
// New layout on phones and tablets: Chat settings' quick page and list headers
//
// The quick page sits under the real Connection, Preset and Persona rows: a few
// switches and the "All settings" row. The list gets plain group headers.
// ──────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { HelpTooltip } from "../../components/ui/HelpTooltip";
import { cn } from "../../lib/utils";
import { useMobileChatSettingsNav } from "./mobile-nav";
import { requestCloseChatSettingsSubpage, useChatSettingsSubpage } from "./subpage";

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

/**
 * The sheet's header on the All settings list and on a section's page: back, then the page's own name and help.
 * It takes Chat settings' title's place, so the page shows one header, not two.
 */
export function MobileChatSettingsHeaderBack() {
  const { t } = useTranslation();
  const view = useMobileChatSettingsNav((state) => state.view);
  const back = useMobileChatSettingsNav((state) => state.back);
  const pageTitle = useMobileChatSettingsNav((state) => state.pageTitle);
  const subpageId = useChatSettingsSubpage((state) => state.subpage?.id ?? null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  // An editor page (Chat Variables, Memories…) opened: focus starts on its way back, like the page's own back did.
  useEffect(() => {
    if (subpageId) buttonRef.current?.focus({ preventScroll: true });
  }, [subpageId]);
  const toQuick = view === "all" || back === "quick";
  // An editor page goes back to the page it was opened from (Memory Recall, Chat Variables…), and says so.
  const parentName =
    view === "page" && typeof pageTitle === "string" && pageTitle
      ? pageTitle
      : view === "all"
        ? t("chat.settings.allSettings", { defaultValue: "All settings" })
        : t("chat.settings.subpage.back", { defaultValue: "Chat settings" });
  const label = subpageId
    ? t("chat.settings.subpage.backTo", { name: parentName, defaultValue: "Back to {{name}}" })
    : toQuick
      ? t("chat.settings.backToQuickSettings", { defaultValue: "Back to Quick settings" })
      : t("chat.settings.backToAllSettings", { defaultValue: "Back to All settings" });
  return (
    <button
      ref={buttonRef}
      type="button"
      className="ovm-cs-page__back ovm-cs-head__back"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => {
        // The editor page first, asking about unsaved edits; then the page it came from, then the list.
        if (useChatSettingsSubpage.getState().subpage) {
          void requestCloseChatSettingsSubpage();
          return;
        }
        const nav = useMobileChatSettingsNav.getState();
        if (nav.view === "all") nav.showQuick();
        else nav.goBack();
      }}
      aria-label={label}
      title={label}
    >
      <ChevronLeft size={26} aria-hidden="true" />
    </button>
  );
}

/** The sheet header's title while the list or a page is shown. */
export function useMobileChatSettingsHeaderTitle(): ReactNode {
  const { t } = useTranslation();
  const view = useMobileChatSettingsNav((state) => state.view);
  const pageTitle = useMobileChatSettingsNav((state) => state.pageTitle);
  if (view === "all") return t("chat.settings.allSettings", { defaultValue: "All settings" });
  if (view === "page") return pageTitle;
  return null;
}

export function MobileChatSettingsPageHelp() {
  const view = useMobileChatSettingsNav((state) => state.view);
  const help = useMobileChatSettingsNav((state) => state.pageHelp);
  // The help is the section page's; an editor page over it has none of its own.
  const subpageOpen = useChatSettingsSubpage((state) => !!state.subpage);
  if (view !== "page" || !help || subpageOpen) return null;
  return (
    <span
      className="mari-drawer__help ovm-cs-page__help ovm-cs-head__help"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <HelpTooltip text={help} side="bottom" />
    </span>
  );
}

export function MobileChatSettingsGroup({ order, label }: { order: number; label: string }) {
  return (
    <div className="ovm-cs-group" data-ovm-list="true" style={{ order }} role="presentation">
      {label}
    </div>
  );
}
