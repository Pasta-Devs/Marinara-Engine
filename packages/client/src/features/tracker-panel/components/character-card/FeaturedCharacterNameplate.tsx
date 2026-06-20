import { type ReactNode, type RefObject } from "react";
import { Brain, Minimize2 } from "lucide-react";
import { characterTrackerLockKey, isTrackerFieldLocked, type PresentCharacter } from "@marinara-engine/shared";
import { cn } from "../../../../lib/utils";
import type { TrackerProfileSide } from "../../lib/tracker-profile-layout";
import { InlineEdit } from "../controls/InlineControls";
import {
  TrackerProfileNameplate,
  TRACKER_PROFILE_NAMEPLATE_HEADER_BUTTON_CLASS,
  TRACKER_PROFILE_NAMEPLATE_ICON_BUTTON_ACTIVE_CLASS,
  TRACKER_PROFILE_NAMEPLATE_ICON_BUTTON_CLASS,
} from "../controls/TrackerProfileNameplate";
import { useTrackerLockContext } from "../TrackerLockContext";

export function FeaturedCharacterNameplate({
  character,
  onUpdate,
  hasThoughtsControl,
  thoughtsOpen,
  thoughtButtonRef,
  thoughtControlSide,
  onToggleThoughts,
  onToggleFeatured,
  action,
  characterIndex,
}: {
  character: PresentCharacter;
  onUpdate?: (character: PresentCharacter) => void;
  hasThoughtsControl: boolean;
  thoughtsOpen: boolean;
  thoughtButtonRef: RefObject<HTMLButtonElement | null>;
  thoughtControlSide: TrackerProfileSide;
  onToggleThoughts?: () => void;
  onToggleFeatured?: () => void;
  action?: ReactNode;
  characterIndex: number;
}) {
  const { fieldLocks, lockMode, onToggleFieldLock } = useTrackerLockContext();
  const emojiLockKey = characterTrackerLockKey(character, characterIndex, "emoji");
  const nameLockKey = characterTrackerLockKey(character, characterIndex, "name");
  const thoughtButtonLabel = thoughtsOpen ? "Stop reading thoughts" : "Read thoughts";
  const emojiControl = onUpdate ? (
    <InlineEdit
      value={character.emoji || "?"}
      onSave={(emoji) => onUpdate({ ...character, emoji: emoji || "?" })}
      placeholder="?"
      title={`${character.name || "character"} emoji`}
      className="h-4 w-4 justify-center rounded-sm px-0 py-0 text-center text-[0.625rem] leading-4"
      showEditHint={false}
      fitPreview
      fitAlign="center"
      locked={isTrackerFieldLocked(fieldLocks, emojiLockKey)}
      lockMode={lockMode}
      onToggleLock={onToggleFieldLock ? () => onToggleFieldLock(emojiLockKey) : undefined}
    />
  ) : null;
  const thoughtControl =
    hasThoughtsControl && onToggleThoughts ? (
      <button
        ref={thoughtButtonRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleThoughts();
        }}
        title={thoughtButtonLabel}
        aria-label={thoughtButtonLabel}
        aria-expanded={thoughtsOpen}
        className={cn(
          TRACKER_PROFILE_NAMEPLATE_ICON_BUTTON_CLASS,
          thoughtsOpen && TRACKER_PROFILE_NAMEPLATE_ICON_BUTTON_ACTIVE_CLASS,
        )}
      >
        <Brain size="0.625rem" />
      </button>
    ) : null;
  const headerControls =
    emojiControl || action || onToggleFeatured ? (
      <>
        {emojiControl}
        {onToggleFeatured && (
          <button
            type="button"
            onClick={onToggleFeatured}
            title="Use compact character card"
            aria-label="Use compact character card"
            aria-pressed
            className={TRACKER_PROFILE_NAMEPLATE_HEADER_BUTTON_CLASS}
          >
            <Minimize2 size="0.6875rem" />
          </button>
        )}
        {action}
      </>
    ) : null;

  return (
    <TrackerProfileNameplate
      value={character.name}
      placeholder="Character"
      onSave={onUpdate ? (name) => onUpdate({ ...character, name: name || "Character" }) : undefined}
      primaryControl={thoughtControl}
      primaryControlSide={thoughtControlSide}
      secondaryControls={headerControls}
      lockKey={nameLockKey}
    />
  );
}
