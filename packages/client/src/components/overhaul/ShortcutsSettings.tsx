// ──────────────────────────────────────────────
// Settings › Shortcuts (UI overhaul): every keyboard shortcut and touch gesture
//
// The new layout's home for the list the "?" key used to open in a window. Two
// sections, Keyboard shortcuts and Touch gestures, as dense tables. The gestures'
// on/off switch lives here too. "?" and Search's "Keyboard shortcuts" open this page.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Hand, Keyboard } from "lucide-react";
import { isApplePlatform } from "../../lib/command-center";
import { shortcutGroupsFor, shortcutKeyLabel, shortcutKeysFor } from "../../lib/keyboard-shortcuts";
import { TOUCH_GESTURES } from "../../lib/touch-gestures";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { SettingsSection, ToggleSetting } from "../panels/settings/SettingControls";

export const SHORTCUTS_GUIDE = "home/shortcuts-and-gestures.md";

function GuideButton() {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="ov-shortcuts__guide"
      onClick={() => useUIStore.getState().openModal("docs-viewer", { initialDoc: SHORTCUTS_GUIDE })}
    >
      <BookOpen size={13} aria-hidden="true" />
      <span>{t("shortcuts.page.readGuide")}</span>
    </button>
  );
}

function KeyCombos({ combos, sequence, apple }: { combos: string[][]; sequence?: boolean; apple: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="ov-shortcuts__keys">
      {combos.map((combo, index) => (
        // "or" stays on the line of the keys it comes before, so a wrapped list never ends a line with it.
        <span key={combo.join("+")} className="ov-shortcuts__combo">
          {index > 0 ? (
            <span className="ov-shortcuts__or">{t(sequence ? "shortcuts.then" : "shortcuts.or")}</span>
          ) : null}
          {combo.map((key) => (
            <kbd key={key}>{shortcutKeyLabel(key, t, apple)}</kbd>
          ))}
        </span>
      ))}
    </span>
  );
}

export function KeyboardShortcutsSection({ anchorId }: { anchorId: string }) {
  const { t } = useTranslation();
  const apple = useMemo(() => isApplePlatform(), []);
  const intuitiveSwipeNavigation = useUIStore((s) => s.intuitiveSwipeNavigation);
  const settingOn = { intuitiveSwipeNavigation } as const;
  return (
    <SettingsSection
      title={t("shortcuts.page.keyboardTitle")}
      description={t("shortcuts.page.keyboardDescription")}
      help={t("shortcuts.page.keyboardHelp")}
      icon={<Keyboard size="0.875rem" />}
      headerAction={<GuideButton />}
      anchorId={anchorId}
    >
      <div className="ov-shortcuts" data-component="KeyboardShortcutsList">
        {shortcutGroupsFor(true).map((group) => (
          <table key={group.id} className="ov-shortcuts__table" data-group={group.id}>
            <caption>{t(group.titleKey)}</caption>
            <tbody>
              {group.shortcuts.map((shortcut) => {
                const off = shortcut.requiresSetting ? !settingOn[shortcut.requiresSetting] : false;
                return (
                  <tr key={shortcut.id ?? shortcut.labelKey} className={cn(off && "is-off")}>
                    <td className="ov-shortcuts__what">
                      {t(shortcut.overhaulLabelKey ?? shortcut.labelKey)}
                      {shortcut.notWhileTypingOffApple && !apple ? (
                        <span className="ov-shortcuts__note"> {t("shortcuts.notWhileTyping")}</span>
                      ) : null}
                      {off ? <span className="ov-shortcuts__note"> {t("shortcuts.offInSettings")}</span> : null}
                    </td>
                    <td className="ov-shortcuts__how">
                      <KeyCombos combos={shortcutKeysFor(shortcut, apple)} sequence={shortcut.sequence} apple={apple} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </SettingsSection>
  );
}

export function TouchGesturesSection({ anchorId, toggleAnchorId }: { anchorId: string; toggleAnchorId: string }) {
  const { t } = useTranslation();
  const swipeGestures = useUIStore((s) => s.swipeGestures);
  const setSwipeGestures = useUIStore((s) => s.setSwipeGestures);
  return (
    <SettingsSection
      title={t("gestures.page.title")}
      description={t("gestures.page.description")}
      help={t("gestures.page.help")}
      icon={<Hand size="0.875rem" />}
      headerAction={<GuideButton />}
      anchorId={anchorId}
    >
      <div className="ov-shortcuts" data-component="TouchGesturesList">
        <ToggleSetting
          anchorId={toggleAnchorId}
          label={t("settings.controls.phoneSwipeGestures.label")}
          checked={swipeGestures}
          onChange={setSwipeGestures}
          help={t("settings.controls.phoneSwipeGestures.help")}
        />
        <table className="ov-shortcuts__table">
          <tbody>
            {TOUCH_GESTURES.map((gesture) => {
              const off = gesture.needsSwipeSetting && !swipeGestures;
              return (
                <tr key={gesture.id} className={cn(off && "is-off")} data-gesture={gesture.id}>
                  <td className="ov-shortcuts__what">
                    {t(gesture.labelKey)}
                    {off ? <span className="ov-shortcuts__note"> {t("gestures.page.offNote")}</span> : null}
                  </td>
                  <td className="ov-shortcuts__how ov-shortcuts__gesture">{t(gesture.gestureKey)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  );
}
