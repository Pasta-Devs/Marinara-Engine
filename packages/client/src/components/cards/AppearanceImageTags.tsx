/**
 * The Appearance field's Prose | Image tags pair (#9605), shared by the card's
 * Appearance field and each Appearance alternative, so a later wardrobe outfit
 * can reuse it too. Image tags are the per-look twin of the card's Image
 * Appearance Override (#7053): sent to image models as written while ticked.
 */
import { useTranslation as useUiTranslation } from "react-i18next";

import { SettingsCheckbox } from "../panels/settings/SettingControls";
import { Tabs } from "../ui/Tabs";

export type AppearanceTab = "prose" | "imageTags";

export type AppearanceImageTagsState = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  value: string;
  onChange: (value: string) => void;
};

export function imageTagsInUse(state: AppearanceImageTagsState) {
  return state.enabled && state.value.trim() !== "";
}

/** Typing into empty tags ticks the checkmark, or filled-in tags would silently do nothing. */
export function shouldAutoTick(state: Pick<AppearanceImageTagsState, "enabled" | "value">, next: string) {
  return !state.enabled && !state.value.trim() && next.trim() !== "";
}

/** For setters that compose (the editors' drafts); a single-write owner checks `shouldAutoTick` itself. */
export function changeImageTags(state: AppearanceImageTagsState, next: string) {
  if (shouldAutoTick(state, next)) state.onToggle(true);
  state.onChange(next);
}

/** The tab row; the checkmark sits at its end while the Image tags tab is open. */
export function AppearanceTabs({
  tab,
  onTabChange,
  state,
}: {
  tab: AppearanceTab;
  onTabChange: (tab: AppearanceTab) => void;
  state: AppearanceImageTagsState;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    // The shared Tabs underline and SettingsCheckbox paint with --primary, which stays on the default accent in the
    // editor while its newer controls follow the chrome accent; rescoped as MacroTextarea does.
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 [--primary:var(--marinara-editor-accent)]">
      <Tabs
        variant="underline"
        label={localizeUi("ui.cards.appearanceImageTags.tabs")}
        value={tab}
        onChange={onTabChange}
        className="min-w-0"
        items={[
          { id: "prose", label: localizeUi("ui.cards.appearanceImageTags.prose") },
          {
            id: "imageTags",
            label: localizeUi("ui.cards.appearanceImageTags.imageTags"),
            badge: imageTagsInUse(state) ? (
              <span
                aria-label={localizeUi("ui.cards.appearanceImageTags.inUse")}
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
              />
            ) : undefined,
          },
        ]}
      />
      {tab === "imageTags" && (
        <SettingsCheckbox
          label={localizeUi("ui.cards.appearanceImageTags.useForImagePrompts")}
          checked={state.enabled}
          onChange={state.onToggle}
          className="py-1"
        />
      )}
    </div>
  );
}

/** One line under the textarea saying who reads what is on screen. */
export function AppearanceTabHint({ tab, state }: { tab: AppearanceTab; state: AppearanceImageTagsState }) {
  const { t: localizeUi } = useUiTranslation();
  const key =
    tab === "prose"
      ? imageTagsInUse(state)
        ? "ui.cards.appearanceImageTags.proseHintTagsInUse"
        : "ui.cards.appearanceImageTags.proseHint"
      : state.enabled
        ? "ui.characters.charactercardtab.imageAppearanceSubtitle"
        : "ui.cards.appearanceImageTags.imageTagsHintOff";
  return <p className="text-xs text-[var(--muted-foreground)]">{localizeUi(key)}</p>;
}
