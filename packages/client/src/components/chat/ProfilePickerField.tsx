// ──────────────────────────────────────────────
// The settings-profile field (Quick Setup, Chat Settings): the shared picker window over one
// mode's profiles. Profiles have no picture, so each row gets the Settings gradient tile, and
// the mode's default carries a star like the drawer's default toggle.
// ──────────────────────────────────────────────
import { useMemo } from "react";
import { SlidersHorizontal, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ChatPreset } from "@marinara-engine/shared";
import { PickerField, PickerTileArt } from "../ui/PickerField";

export function ProfilePickerField({
  profiles,
  value,
  missingLabel,
  triggerClassName,
  triggerTitle,
  disabled,
  onChange,
}: {
  /** One mode's profiles, in display order. */
  profiles: readonly ChatPreset[];
  /** Profile id, or "" when none applies. */
  value: string;
  /** Trigger text when `value` is "" or not in the list (custom settings, a deleted profile). */
  missingLabel: string;
  /** The field look of the surface it sits in. */
  triggerClassName: string;
  triggerTitle?: string;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  const { t } = useTranslation();
  const defaultLabel = t("chat.settingsProfile.default.label");
  const items = useMemo(
    () =>
      profiles.map((profile) => ({
        id: profile.id,
        // The built-in profile is "Default" in every language.
        label: profile.isDefault ? t("ui.noodle.noodlehome.default") : profile.name,
        icon: <PickerTileArt type="settings" icon={SlidersHorizontal} />,
        badge: profile.isActive ? (
          <span title={defaultLabel} className="shrink-0 text-yellow-400">
            <Star size="0.75rem" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">{defaultLabel}</span>
          </span>
        ) : undefined,
      })),
    [profiles, defaultLabel, t],
  );

  return (
    <PickerField
      value={value}
      items={items}
      ariaLabel={t("chat.settingsProfile.label")}
      missingLabel={missingLabel}
      triggerClassName={triggerClassName}
      triggerTitle={triggerTitle}
      triggerData={{ "data-profile-picker-trigger": "" }}
      disabled={disabled}
      onChange={onChange}
      searchLabel={t("chat.wizard.select.search")}
      emptyLabel={t("ui.characters.characterlibraryview.loading")}
      noMatchesLabel={t("ui.lorebooks.linkedresourcepicker.noMatches")}
    />
  );
}
