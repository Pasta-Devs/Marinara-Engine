import { type Chat, type ChatMode, type AutoActiveCharactersMode, type CardOnboarding } from "@marinara-engine/shared";
import {
  type CastCardLike,
  type CastCharacter,
  CHAT_RESOURCE_REMOVE_BUTTON_CLASS,
  PICKER_EXCLUDED_IDS,
} from "./cast-shared";
import { useUpdateChat, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useTranslation as useUiTranslation, useTranslation } from "react-i18next";
import { showAlertDialog } from "../../../lib/app-dialogs";
import { useState, useRef } from "react";
import { useTouchFolderDrag } from "../../../hooks/use-touch-folder-drag";
import { insertLibraryItems } from "../../../lib/library-order";
import { Users, Pin, EyeOff, Eye, UserPlus, Pencil, Trash2, Plus } from "lucide-react";
import { cn, getAvatarCropStyle } from "../../../lib/utils";
import { useUIStore } from "../../../stores/ui.store";
import { CharacterSelect } from "../../../components/characters/CharacterSelect";
import { ChatSettingsSection } from "../ChatSettingsSection";
import type { CharacterDisplayInfo } from "../../../lib/character-display";

interface CharactersSectionProps {
  order: number;
  chat: Chat;
  chatMode: ChatMode;
  isConversation: boolean;
  characters: CastCharacter[];
  chatCharIds: string[];
  chatCharacterCount: number;
  activeCharacterIds: string[];
  inactiveCharacterIds: string[];
  supportsCharacterActivityToggle: boolean;
  autoActiveCharactersMode: AutoActiveCharactersMode;
  autoActiveCharacterPins: string[];
  cardThemingControls: React.ReactNode;
  hostedRoom: boolean;
  changeRoomCharacters: (add: string[], remove: string[]) => Promise<void>;
  roomRosterPending: boolean;
  updateChat: ReturnType<typeof useUpdateChat>;
  getCharacterInfo: (c: CastCardLike) => CharacterDisplayInfo;
  charName: (c: CastCardLike) => string;
  charTitle: (c: CastCardLike) => string | null;
  onboardingByCharacterId: Map<string, CardOnboarding>;
  onboardingCardQuestionsById: Map<string, { character: CastCharacter; cardOnboarding: CardOnboarding }>;
  setOnboardingQuestionsCharacterId: (characterId: string) => void;
  rememberSettingsReturn: () => void;
  requestClose: (force?: boolean) => Promise<boolean>;
  showCharPicker: boolean;
  setShowCharPicker: React.Dispatch<React.SetStateAction<boolean>>;
  toggleCharacter: (charId: string) => void;
  toggleChangedCharacter: (ids: string[]) => void;
  toggleInlineResourceEditor: (kind: "character" | "persona", id: string) => void;
  renderInlineCardEditor: (kind: "character" | "persona", id: string, displayName: string) => React.ReactNode;
}

export function CharactersSection({
  order,
  chat,
  chatMode,
  isConversation,
  characters,
  chatCharIds,
  chatCharacterCount,
  activeCharacterIds,
  inactiveCharacterIds,
  supportsCharacterActivityToggle,
  autoActiveCharactersMode,
  autoActiveCharacterPins,
  cardThemingControls,
  hostedRoom,
  changeRoomCharacters,
  roomRosterPending,
  updateChat,
  getCharacterInfo,
  charName,
  charTitle,
  onboardingByCharacterId,
  onboardingCardQuestionsById,
  setOnboardingQuestionsCharacterId,
  rememberSettingsReturn,
  requestClose,
  showCharPicker,
  setShowCharPicker,
  toggleCharacter,
  toggleChangedCharacter,
  toggleInlineResourceEditor,
  renderInlineCardEditor,
}: CharactersSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const updateMeta = useUpdateChatMetadata();
  // Pins the character's current state, on or off, so automation leaves it alone.
  const togglePin = (charId: string) => {
    updateMeta.mutate({
      id: chat.id,
      autoActiveCharacterPins: autoActiveCharacterPins.includes(charId)
        ? autoActiveCharacterPins.filter((id) => id !== charId)
        : [...autoActiveCharacterPins, charId],
    });
  };
  const toggleCharacterActivity = (charId: string) => {
    if (!supportsCharacterActivityToggle) return;
    const isInactive = inactiveCharacterIds.includes(charId);
    if (!isInactive && activeCharacterIds.length <= 1) {
      void showAlertDialog({
        title: "Keep one character active",
        message: "At least one character needs to stay active so the chat has someone to respond.",
      });
      return;
    }
    updateMeta.mutate({
      id: chat.id,
      inactiveCharacterIds: isInactive
        ? inactiveCharacterIds.filter((id) => id !== charId)
        : [...inactiveCharacterIds, charId],
      // A hand toggle while automation runs pins the character, so the next turn keeps it.
      ...(autoActiveCharactersMode !== "off" && !autoActiveCharacterPins.includes(charId)
        ? { autoActiveCharacterPins: [...autoActiveCharacterPins, charId] }
        : {}),
    });
  };

  const [draggedCharId, setDraggedCharId] = useState<string | null>(null);
  const { startTouchDrag: startCharacterReorderDrag } = useTouchFolderDrag({
    autoScrollEdgePx: 0,
    onActivate: setDraggedCharId,
    onReorder: (ids, target, edge) => {
      setDraggedCharId(null);
      const next = insertLibraryItems(chatCharIds, ids, target, edge);
      if (next.some((id, i) => id !== chatCharIds[i])) updateChat.mutate({ id: chat.id, characterIds: next });
    },
    onDrop: () => setDraggedCharId(null),
    onCancel: () => setDraggedCharId(null),
  });

  const addCharBtnRef = useRef<HTMLButtonElement>(null);
  return (
    <ChatSettingsSection
      id={`${chatMode}-characters`}
      style={{ order }}
      label={localizeUi("navigation.topbar.characters")}
      icon={<Users size="0.875rem" />}
      count={chatCharacterCount}
      help={localizeUi("ui.chat.chatsettingsdrawer.charactersInThisChatEachCharacterHasTheirOwn")}
    >
      {/* Active characters */}
      {chatCharacterCount === 0 ? (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.noCharactersAddedToThisChat")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {chatCharIds.map((cid) => {
            const c = characters.find((ch) => ch.id === cid);
            if (!c) return null;
            const name = charName(c);
            const title = charTitle(c);
            return (
              <div key={c.id}>
                <div
                  data-drag-kind="chat-settings-character"
                  data-drag-id={c.id}
                  onMouseDown={(event) => startCharacterReorderDrag(event, c.id)}
                  onTouchStart={(event) => {
                    event.stopPropagation();
                    startCharacterReorderDrag(event, c.id);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg bg-[var(--primary)]/10 px-2 py-2 ring-1 ring-[var(--primary)]/30 transition-opacity",
                    draggedCharId === c.id && "opacity-40",
                    inactiveCharacterIds.includes(c.id) && "bg-[var(--secondary)] opacity-70 ring-[var(--border)]",
                  )}
                >
                  {/* The name opens the full card editor (Depth Prompt, embedded lorebooks and more); the
                              pencil edits a few fields inline. Add Character below opens the multi-picker (#8933). */}
                  <button
                    type="button"
                    data-drag-surface
                    onClick={() => {
                      void requestClose(false).then((closed) => {
                        if (closed) {
                          rememberSettingsReturn();
                          useUIStore.getState().openCharacterDetail(c.id, { initialTab: "card" });
                        }
                      });
                    }}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left transition-colors hover:opacity-80"
                    title={localizeUi("ui.chat.chatsettingsdrawer.openCharacterCard")}
                  >
                    {c.avatarPath ? (
                      <span className="relative block h-7 w-7 shrink-0 overflow-hidden rounded-full">
                        <img
                          src={c.avatarPath}
                          alt={name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(getCharacterInfo(c).avatarCrop)}
                        />
                      </span>
                    ) : (
                      <div className="mari-avatar-placeholder mari-avatar-placeholder--character flex h-7 w-7 items-center justify-center rounded-full text-[0.625rem] font-bold">
                        {name[0]}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs">{name}</span>
                      {title && (
                        <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                          {title}
                        </span>
                      )}
                    </div>
                  </button>
                  {/* On every row while automation runs, so pinning never shifts the row's buttons.
                              Styled like the eye: muted when unpinned, primary when pinned. */}
                  {autoActiveCharactersMode !== "off" && (
                    <button
                      type="button"
                      onClick={() => togglePin(c.id)}
                      aria-pressed={autoActiveCharacterPins.includes(c.id)}
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                        autoActiveCharacterPins.includes(c.id) && "text-[var(--primary)]",
                      )}
                      title={
                        autoActiveCharacterPins.includes(c.id)
                          ? localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.unpin")
                          : localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.pin")
                      }
                      aria-label={
                        autoActiveCharacterPins.includes(c.id)
                          ? localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.unpin")
                          : localizeUi("ui.chat.chatsettingsdrawer.autoActiveCharacters.pin")
                      }
                    >
                      <Pin size="0.6875rem" />
                    </button>
                  )}
                  {supportsCharacterActivityToggle && (
                    <button
                      onClick={() => toggleCharacterActivity(c.id)}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                        !inactiveCharacterIds.includes(c.id) && "text-[var(--primary)]",
                      )}
                      title={
                        inactiveCharacterIds.includes(c.id)
                          ? localizeUi("ui.chat.chatsettingsdrawer.enableInChat")
                          : localizeUi("ui.chat.chatsettingsdrawer.disableInChat")
                      }
                    >
                      {inactiveCharacterIds.includes(c.id) ? <EyeOff size="0.6875rem" /> : <Eye size="0.6875rem" />}
                    </button>
                  )}
                  {/* The interactive-onboarding marker, now an action:
                              answers this card's character questions alone. */}
                  {onboardingCardQuestionsById.has(c.id) && (
                    <button
                      type="button"
                      onClick={() => setOnboardingQuestionsCharacterId(c.id)}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--primary)] transition-colors hover:bg-[var(--accent)]"
                      title={localizeUi("ui.characters.onboarding.answerCharacterQuestions")}
                      aria-label={localizeUi("ui.characters.onboarding.answerCharacterQuestions")}
                    >
                      <UserPlus size="0.6875rem" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleInlineResourceEditor("character", c.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title={t("chat.settings.actions.editCharacterCard")}
                    aria-label={t("chat.settings.actions.editCharacterCard")}
                  >
                    <Pencil size="0.6875rem" />
                  </button>
                  <button
                    onClick={() => toggleCharacter(c.id)}
                    className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                    data-chat-settings-remove-resource="character"
                    title={localizeUi("ui.chat.chatsettingsdrawer.removeFromChat")}
                  >
                    <Trash2 size="0.6875rem" />
                  </button>
                </div>
                {renderInlineCardEditor("character", c.id, name)}
              </div>
            );
          })}
        </div>
      )}

      {/* Add character picker */}
      <button
        ref={addCharBtnRef}
        onClick={() => setShowCharPicker((open) => !open)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
      >
        <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.addCharacter")}
      </button>
      <CharacterSelect
        kind="character"
        multiple
        variant="controlled"
        open={showCharPicker}
        onOpenChange={setShowCharPicker}
        anchorRef={addCharBtnRef}
        value={chatCharIds}
        onChange={toggleChangedCharacter}
        exclude={PICKER_EXCLUDED_IDS}
        busy={updateChat.isPending || roomRosterPending}
        badge={(id) =>
          !isConversation && onboardingByCharacterId.has(id) ? (
            <span
              role="img"
              aria-label={localizeUi("ui.characters.onboarding.hasOnboarding")}
              title={localizeUi("ui.characters.onboarding.hasOnboarding")}
              className="shrink-0 text-[var(--primary)]"
            >
              <UserPlus size="0.75rem" />
            </span>
          ) : null
        }
        onPickGroup={(ids) => {
          if (hostedRoom) void changeRoomCharacters(ids, []);
          else updateChat.mutate({ id: chat.id, characterIds: [...chatCharIds, ...ids] });
        }}
      />
      {cardThemingControls}
    </ChatSettingsSection>
  );
}
