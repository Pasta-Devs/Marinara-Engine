// ──────────────────────────────────────────────
// Settings profile editor in the center surface, opened from the Presets
// panel's Profiles tab. It hosts ChatProfileBuilder as a page; Chat Settings
// keeps the builder as a dialog so editing there doesn't leave the chat.
// ──────────────────────────────────────────────
import { useEffect } from "react";
import type { ChatMode } from "@marinara-engine/shared";
import { ChatProfileBuilder } from "../chat/ChatProfileBuilder";
import { useChatPresets } from "../../hooks/use-chat-presets";
import { useChatStore } from "../../stores/chat.store";
import { useUIStore } from "../../stores/ui.store";

const NEW_PREFIX = "new:";

/** The store value for a profile that isn't saved yet. */
export function newProfileDetailId(mode: ChatMode) {
  return `${NEW_PREFIX}${mode}`;
}

function readNewMode(id: string): ChatMode | null {
  if (!id.startsWith(NEW_PREFIX)) return null;
  const mode = id.slice(NEW_PREFIX.length);
  return mode === "conversation" || mode === "roleplay" ? mode : null;
}

export function ProfileEditor() {
  const profileDetailId = useUIStore((s) => s.profileDetailId);
  const closeProfileDetail = useUIStore((s) => s.closeProfileDetail);
  const activeChatId = useChatStore((s) => s.activeChat?.id);
  const { data: profiles, isFetched } = useChatPresets();

  const newMode = profileDetailId ? readNewMode(profileDetailId) : null;
  const profile =
    profileDetailId && !newMode ? (profiles ?? []).find((candidate) => candidate.id === profileDetailId) : undefined;
  // A deleted profile, a built-in Default (not editable) or a bad `new:` value closes the surface.
  const unavailable =
    !!profileDetailId &&
    (profileDetailId.startsWith(NEW_PREFIX) ? !newMode : isFetched && (!profile || profile.isDefault));

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
      currentChatId={activeChatId}
    />
  );
}
