// ──────────────────────────────────────────────
// Settings profile editor in the center surface, opened from the Presets
// panel's Profiles tab. It hosts ChatProfileBuilder as a page; Chat Settings
// keeps the builder as a dialog so editing there doesn't leave the chat.
// New layout: Library > Settings profiles opens it beside the list, and a
// built-in Default opens as a short read-only page instead of closing.
// ──────────────────────────────────────────────
import { lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Copy, Star } from "lucide-react";
import type { ChatPreset } from "@marinara-engine/shared";
import { ChatProfileBuilder } from "../chat/ChatProfileBuilder";
import {
  useChatPresets,
  useDeleteChatPreset,
  useDuplicateChatPreset,
  useSetActiveChatPreset,
} from "../../hooks/use-chat-presets";
import { IMAGE_SETTINGS_PROFILE_ID, useUIStore } from "../../stores/ui.store";
import { useOverhaulLook } from "../../stores/overhaul.store";
import { useLocalizedUiText } from "../../localization/use-localized-ui-text";
import { OvEditorHead } from "../overhaul/EditorChrome";
import { kitDelete } from "../overhaul/LibraryKit";
import { exportProfiles } from "../overhaul/ProfilesViewer";
import { NEW_PROFILE_PREFIX, readNewProfileMode } from "./profile-detail-id";

const ImageSettingsPage = lazy(() =>
  import("../image-settings/ImageSettingsPage").then((module) => ({ default: module.ImageSettingsPage })),
);

export function ProfileEditor() {
  const profileDetailId = useUIStore((s) => s.profileDetailId);
  // Image settings sits in this list too: one engine-wide page, not a saved profile.
  if (profileDetailId === IMAGE_SETTINGS_PROFILE_ID)
    return (
      <Suspense fallback={null}>
        <ImageSettingsPage />
      </Suspense>
    );
  return <SavedProfileEditor />;
}

function SavedProfileEditor() {
  const profileDetailId = useUIStore((s) => s.profileDetailId);
  const closeProfileDetail = useUIStore((s) => s.closeProfileDetail);
  const openProfileDetail = useUIStore((s) => s.openProfileDetail);
  const overhaul = useOverhaulLook();
  const { t } = useTranslation();
  const localize = useLocalizedUiText();
  const deleteProfile = useDeleteChatPreset();
  const { data: profiles, isFetched } = useChatPresets();

  const newMode = profileDetailId ? readNewProfileMode(profileDetailId) : null;
  const profile =
    profileDetailId && !newMode ? (profiles ?? []).find((candidate) => candidate.id === profileDetailId) : undefined;
  // A deleted profile, a built-in Default (not editable; the new layout shows it read-only) or a bad
  // `new:` value closes the surface.
  const unavailable =
    !!profileDetailId &&
    (profileDetailId.startsWith(NEW_PROFILE_PREFIX)
      ? !newMode
      : isFetched && (!profile || (profile.isDefault && !overhaul)));

  useEffect(() => {
    if (unavailable) closeProfileDetail();
  }, [unavailable, closeProfileDetail]);

  if (!profileDetailId || unavailable) return null;
  // The builder seeds its fields once, so mount it only when the profile is loaded.
  if (!newMode && !profile) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="shimmer h-8 w-48 rounded-xl" />
          <div className="shimmer h-4 w-32 rounded-xl" />
        </div>
      </div>
    );
  }
  if (profile?.isDefault) return <BuiltInProfilePage profile={profile} />;

  return (
    <ChatProfileBuilder
      open
      variant="page"
      leaveKey={`profileDetailId:${profileDetailId}`}
      onClose={closeProfileDetail}
      mode={profile?.mode ?? newMode!}
      profile={profile ?? null}
      // No currentChatId: edited from the library, the profile isn't for the open chat, so step 2
      // starts with nothing ticked instead of nominating that chat for an overwrite.
      onSaved={
        overhaul && newMode
          ? // A new profile saved in the Library becomes that profile's page (and its row lights up).
            (saved: ChatPreset) => window.setTimeout(() => openProfileDetail(saved.id), 0)
          : undefined
      }
      onExport={
        profile
          ? () => void exportProfiles([profile], (count) => t("ui.panels.profilessection.exportFailed", { count }))
          : undefined
      }
      onDelete={
        profile
          ? () =>
              void kitDelete([profile.id], (id) => deleteProfile.mutateAsync(id), {
                noun: localize("profiles"),
                localize,
                names: `"${profile.name}"`,
              }).then((failed) => {
                if (failed && !failed.length) closeProfileDetail();
              })
          : undefined
      }
    />
  );
}

/** A built-in Default: it keeps the app's defaults, so it can be looked at, starred or copied, not changed. */
function BuiltInProfilePage({ profile }: { profile: ChatPreset }) {
  const { t } = useTranslation();
  const closeProfileDetail = useUIStore((s) => s.closeProfileDetail);
  const openProfileDetail = useUIStore((s) => s.openProfileDetail);
  const duplicateProfile = useDuplicateChatPreset();
  const setActiveProfile = useSetActiveChatPreset();
  const duplicate = () =>
    void duplicateProfile
      .mutateAsync({
        id: profile.id,
        name: t("ui.panels.profilessection.copyName", { name: profile.name }).slice(0, 120),
      })
      .then((copy) => {
        toast.success(t("ui.overhaul.text.copiedName", { name: profile.name }));
        if (copy?.id) openProfileDetail(copy.id);
      })
      .catch(() => toast.error(t("chat.settingsProfile.saveFailed")));
  return (
    <div data-settings-profile-editor className="mari-editor-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="ov-ed ov-prof-ed">
        <OvEditorHead
          section="profiles"
          sectionLabel="Settings profiles"
          title={profile.name}
          meta={`${t("presets.library.builtIn")} · ${t(`chat.settingsProfile.builder.mode.${profile.mode}`)}`}
          actions={
            <>
              <button
                type="button"
                className="ov-edbtn"
                aria-pressed={profile.isActive}
                disabled={profile.isActive || setActiveProfile.isPending}
                onClick={() => setActiveProfile.mutate(profile.id)}
              >
                <Star size={13} aria-hidden="true" className={profile.isActive ? "fill-current" : undefined} />
                {t(profile.isActive ? "ui.overhaul.profiles.usedForNewChats" : "ui.overhaul.profiles.useForNewChats")}
              </button>
              <button type="button" className="ov-edbtn" disabled={duplicateProfile.isPending} onClick={duplicate}>
                <Copy size={13} aria-hidden="true" />
                {t("ui.panels.profilessection.duplicate")}
              </button>
            </>
          }
          menu={[{ label: "Back to Settings profiles", onSelect: closeProfileDetail }]}
        />
        <div className="ov-prof-ed__body">
          <p className="ov-prof-ed__note">{t("ui.panels.profilessection.builtInHint")}</p>
          <p className="ov-prof-ed__note">{t("ui.overhaul.profiles.builtInCopy")}</p>
        </div>
      </div>
    </div>
  );
}
