import { type RefObject } from "react";
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
import { useTranslation as useUiTranslation } from "react-i18next";

export function FeaturedCharacterNameplate({
  character,
  onUpdate,
  thoughtsOpen,
  thoughtButtonRef,
  thoughtControlSide,
  onToggleThoughts,
  onToggleFeatured,
  characterIndex,
}: {
  character: PresentCharacter;
  onUpdate: (character: PresentCharacter) => void;
  thoughtsOpen: boolean;
  thoughtButtonRef: RefObject<HTMLButtonElement | null>;
  thoughtControlSide: TrackerProfileSide;
  onToggleThoughts?: () => void;
  onToggleFeatured: () => void;
  characterIndex: number;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock } = useTrackerLockContext();
  const emojiLockKey = characterTrackerLockKey(character, characterIndex, "emoji");
  const nameLockKey = characterTrackerLockKey(character, characterIndex, "name");
  const thoughtButtonLabel = thoughtsOpen
    ? localizeUi("ui.trackerPanel.featuredcharacternameplate.stopReadingThoughts")
    : localizeUi("ui.trackerPanel.featuredcharacternameplate.readThoughts");
  const emojiControl = (
    <InlineEdit
      value={character.emoji || "?"}
      onSave={(emoji) => onUpdate({ ...character, emoji: emoji || "?" })}
      placeholder="?"
      title={localizeUi("ui.trackerPanel.charactertrackeravatar.value1Emoji", { value1: character.name ||localizeUi("ui.noodle.noodlehome.character") })}
      className="h-4 w-4 justify-center rounded-sm px-0 py-0 text-center text-[0.625rem] leading-4"
      showEditHint={false}
      fitPreview
      fitAlign="center"
      locked={isTrackerFieldLocked(fieldLocks, emojiLockKey)}
      lockMode={lockMode}
      onToggleLock={onToggleFieldLock ? () => onToggleFieldLock(emojiLockKey) : undefined}
    />
  );
  const thoughtControl =
    onToggleThoughts ? (
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
  const headerControls = (
    <>
      {emojiControl}
      <button
        type="button"
        onClick={onToggleFeatured}
        title={localizeUi("ui.trackerPanel.featuredcharacternameplate.useCompactCharacterCard")}
        aria-label={localizeUi("ui.trackerPanel.featuredcharacternameplate.useCompactCharacterCard")}
        aria-pressed
        className={TRACKER_PROFILE_NAMEPLATE_HEADER_BUTTON_CLASS}
      >
        <Minimize2 size="0.6875rem" />
      </button>
    </>
  );

  return (
    <TrackerProfileNameplate
      value={character.name}
      placeholder={localizeUi("ui.characters.cardlibrarydetailcard.character")}
      onSave={(name) => onUpdate({ ...character, name: name || "Character" })}
      primaryControl={thoughtControl}
      primaryControlSide={thoughtControlSide}
      secondaryControls={headerControls}
      lockKey={nameLockKey}
    />
  );
}
