// ──────────────────────────────────────────────
// Settings profile editor in the center surface, opened from the Presets
// panel's Profiles tab. It hosts ChatProfileBuilder as a page; Chat Settings
// keeps the builder as a dialog so editing there doesn't leave the chat.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import { ChatProfileBuilder } from "../chat/ChatProfileBuilder";
import { useChatPresets } from "../../hooks/use-chat-presets";
import { useUIStore } from "../../stores/ui.store";
import { NEW_PROFILE_PREFIX, readNewProfileMode } from "./profile-detail-id";

export function ProfileEditor() {
  const profileDetailId = useUIStore((s) => s.profileDetailId);
  const closeProfileDetail = useUIStore((s) => s.closeProfileDetail);
  const { data: profiles, isFetched } = useChatPresets();

  const newMode = profileDetailId ? readNewProfileMode(profileDetailId) : null;
  const profile =
    profileDetailId && !newMode ? (profiles ?? []).find((candidate) => candidate.id === profileDetailId) : undefined;
  // A deleted profile, a built-in Default (not editable) or a bad `new:` value closes the surface.
  const unavailable =
    !!profileDetailId &&
    (profileDetailId.startsWith(NEW_PROFILE_PREFIX) ? !newMode : isFetched && (!profile || profile.isDefault));

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
    />
  );
}
