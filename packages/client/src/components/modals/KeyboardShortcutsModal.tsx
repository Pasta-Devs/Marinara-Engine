// ──────────────────────────────────────────────
// Keyboard shortcuts list ("?")
// ──────────────────────────────────────────────
import { Fragment, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../ui/Modal";
import { isApplePlatform } from "../../lib/command-center";
import { formatShortcutKey, KEYBOARD_SHORTCUT_GROUPS } from "../../lib/keyboard-shortcuts";
import { executeStateNavigation } from "../../lib/state-navigation";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";

export function KeyboardShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const apple = useMemo(() => isApplePlatform(), []);
  const intuitiveSwipeNavigation = useUIStore((state) => state.intuitiveSwipeNavigation);
  const settingOn = { intuitiveSwipeNavigation };
  const openSwipeSetting = () => {
    onClose();
    executeStateNavigation({
      kind: "settings",
      tab: "general",
      sectionId: "input-editing",
      controlId: "intuitive-swipe-navigation",
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t("shortcuts.title")} width="max-w-2xl" mobileFullscreen>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">{t("shortcuts.intro")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          {KEYBOARD_SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} className="min-w-0">
              <h3 className="mb-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)] [@media(pointer:coarse)]:text-[0.6875rem]">
                {t(group.titleKey)}
              </h3>
              <dl className="divide-y divide-[var(--border)]/50 rounded-lg ring-1 ring-[var(--border)]/70">
                {group.shortcuts.map((shortcut) => {
                  // A row whose setting is off is dimmed and says where to turn it on.
                  const off = shortcut.setting ? !settingOn[shortcut.setting] : false;
                  return (
                    <div
                      key={shortcut.labelKey}
                      className="flex items-center justify-between gap-3 px-2.5 py-1.5"
                      data-shortcut-off={off ? "" : undefined}
                    >
                      <dt className={cn("min-w-0 text-xs text-[var(--foreground)]", off && "opacity-60")}>
                        {t(shortcut.labelKey)}
                        {off ? (
                          <span className="block text-[0.625rem] text-[var(--muted-foreground)] [@media(pointer:coarse)]:text-[0.6875rem]">
                            {t("shortcuts.settingOff")}{" "}
                            <button
                              type="button"
                              className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                              onClick={openSwipeSetting}
                            >
                              {t("shortcuts.settingOffLink")}
                            </button>
                          </span>
                        ) : null}
                      </dt>
                      <dd className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                        {shortcut.keys.map((combo, comboIndex) => (
                          <Fragment key={combo.join("+")}>
                            {comboIndex > 0 && (
                              <span className="text-[0.625rem] text-[var(--muted-foreground)] [@media(pointer:coarse)]:text-[0.6875rem] max-sm:!text-[13px]">
                                {t("shortcuts.or")}
                              </span>
                            )}
                            <span className="flex items-center gap-0.5">
                              {combo.map((key) => (
                                <kbd
                                  key={key}
                                  className="min-w-5 rounded border border-[var(--border)] bg-[var(--secondary)]/60 px-1.5 py-0.5 text-center font-sans text-[0.625rem] text-[var(--foreground)] [@media(pointer:coarse)]:text-[0.6875rem]"
                                >
                                  {formatShortcutKey(key, apple)}
                                </kbd>
                              ))}
                            </span>
                          </Fragment>
                        ))}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
