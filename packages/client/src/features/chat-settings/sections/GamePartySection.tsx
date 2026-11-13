import { type Chat, type Persona } from "@marinara-engine/shared";
import {
  type CastCardLike,
  type CastCharacter,
  DrawerPersonaAvatar,
  CHAT_RESOURCE_REMOVE_BUTTON_CLASS,
  PICKER_EXCLUDED_IDS,
} from "./cast-shared";
import { useUpdateChat } from "../../../hooks/use-chats";
import { useTranslation as useUiTranslation, useTranslation } from "react-i18next";
import { useRef, Fragment } from "react";
import { Shield, Pencil, X, Plus, Trash2 } from "lucide-react";
import { PersonaHistoryReassignDropdown } from "./PersonaHistoryReassignDropdown";
import { CharacterSelect } from "../../../components/characters/CharacterSelect";
import { useUIStore } from "../../../stores/ui.store";
import { getAvatarCropStyle } from "../../../lib/utils";
import { ChatSettingsSection } from "../ChatSettingsSection";
import type { CharacterDisplayInfo } from "../../../lib/character-display";

interface GamePartySectionProps {
  order: number;
  chat: Chat;
  characters: CastCharacter[];
  personas: Persona[];
  chatCharIds: string[];
  chatCharacterCount: number;
  activeCardsHaveCss: boolean;
  cardThemingControls: React.ReactNode;
  roomRosterPending: boolean;
  updateChat: ReturnType<typeof useUpdateChat>;
  getCharacterInfo: (c: CastCardLike) => CharacterDisplayInfo;
  charName: (c: CastCardLike) => string;
  charTitle: (c: CastCardLike) => string | null;
  rememberSettingsReturn: () => void;
  requestClose: (force?: boolean) => Promise<boolean>;
  showCharPicker: boolean;
  setShowCharPicker: React.Dispatch<React.SetStateAction<boolean>>;
  showPersonaPicker: boolean;
  setShowPersonaPicker: React.Dispatch<React.SetStateAction<boolean>>;
  toggleCharacter: (charId: string) => void;
  toggleChangedCharacter: (ids: string[]) => void;
  toggleInlineResourceEditor: (kind: "character" | "persona", id: string) => void;
  renderInlineCardEditor: (kind: "character" | "persona", id: string, displayName: string) => React.ReactNode;
}

export function GamePartySection({
  order,
  chat,
  characters,
  personas,
  chatCharIds,
  chatCharacterCount,
  activeCardsHaveCss,
  cardThemingControls,
  roomRosterPending,
  updateChat,
  getCharacterInfo,
  charName,
  charTitle,
  rememberSettingsReturn,
  requestClose,
  showCharPicker,
  setShowCharPicker,
  showPersonaPicker,
  setShowPersonaPicker,
  toggleCharacter,
  toggleChangedCharacter,
  toggleInlineResourceEditor,
  renderInlineCardEditor,
}: GamePartySectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const partyBtnRef = useRef<HTMLButtonElement>(null);
  const gamePersonaBtnRef = useRef<HTMLDivElement>(null);
  return (
    <ChatSettingsSection
      id="game-party"
      style={{ order }}
      label={localizeUi("ui.chat.chatsettingsdrawer.party")}
      icon={<Shield size="0.875rem" />}
      count={chatCharacterCount + (chat.personaId ? 1 : 0)}
      help={localizeUi("ui.chat.chatsettingsdrawer.yourInGamePartyPickAPersonaToPlay")}
    >
      <div ref={gamePersonaBtnRef} tabIndex={-1} className="space-y-1.5 outline-none">
        <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.characters.cardlibrarydetailcard.persona")}
        </label>
        {chat.personaId ? (
          <>
            <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2 ring-1 ring-[var(--primary)]/30">
              <button
                type="button"
                onClick={() => setShowPersonaPicker((open) => !open)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
                title={localizeUi("ui.chat.chatsettingsdrawer.changePersona")}
              >
                {(() => {
                  const p = personas.find((persona) => persona.id === chat.personaId);
                  return p ? (
                    <>
                      <DrawerPersonaAvatar persona={p} size="md" />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{p.name}</span>
                        {p.comment && (
                          <span className="block truncate text-[0.625rem] italic text-[var(--muted-foreground)]">
                            {p.comment}
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="flex-1 truncate text-xs text-[var(--muted-foreground)]">
                      {localizeUi("ui.chat.chatsettingsdrawer.unknownPersona")}
                    </span>
                  );
                })()}
              </button>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleInlineResourceEditor("persona", chat.personaId!)}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title={t("chat.settings.actions.editPersonaCard")}
                  aria-label={t("chat.settings.actions.editPersonaCard")}
                >
                  <Pencil size="0.6875rem" />
                </button>
                <button
                  type="button"
                  onClick={() => updateChat.mutate({ id: chat.id, personaId: null })}
                  className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                  data-chat-settings-remove-resource="persona"
                  title={localizeUi("ui.chat.chatsettingsdrawer.removePersona")}
                >
                  <X size="0.75rem" />
                </button>
              </div>
            </div>
            {renderInlineCardEditor(
              "persona",
              chat.personaId,
              personas.find((persona) => persona.id === chat.personaId)?.name ?? "Unknown persona",
            )}
          </>
        ) : (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.noPersonaSelected")}
          </p>
        )}
        <PersonaHistoryReassignDropdown
          chatId={chat.id}
          targetName={personas.find((persona) => persona.id === chat.personaId)?.name ?? null}
        />

        {!chat.personaId && (
          <button
            onClick={() => setShowPersonaPicker((open) => !open)}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
          >
            <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.choose")}{" "}
            {localizeUi("ui.characters.cardlibrarydetailcard.persona")}
          </button>
        )}
        <CharacterSelect
          kind="persona"
          variant="controlled"
          allowNone
          withCharacters={false}
          open={showPersonaPicker}
          onOpenChange={setShowPersonaPicker}
          anchorRef={gamePersonaBtnRef}
          value={chat.personaId ? { persona: chat.personaId } : null}
          onChange={(next) =>
            updateChat.mutate({
              id: chat.id,
              personaId: next && "persona" in next ? next.persona : null,
              personaCharacterId: null,
            })
          }
        />
      </div>

      <div className="mt-2 space-y-1.5">
        <label className="text-[0.6875rem] font-medium text-[var(--muted-foreground)]">
          {localizeUi("ui.chat.chatsettingsdrawer.partyCharacters")}
        </label>
        {chatCharacterCount === 0 ? (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.noCharactersInPartyYet")}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {chatCharIds.map((cid) => {
              const c = characters.find((ch) => ch.id === cid);
              if (!c) return null;
              const name = charName(c);
              const title = charTitle(c);
              return (
                <Fragment key={c.id}>
                  <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30">
                    {/* The name opens the full card, as in Roleplay; Add Character below opens the picker (#8933). */}
                    <button
                      type="button"
                      onClick={() => {
                        void requestClose(false).then((closed) => {
                          if (closed) {
                            rememberSettingsReturn();
                            useUIStore.getState().openCharacterDetail(c.id, { initialTab: "card" });
                          }
                        });
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
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
                        <div className="mari-avatar-placeholder mari-avatar-placeholder--character flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.625rem] font-bold">
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
                      title={localizeUi("ui.chat.chatsettingsdrawer.removeFromParty")}
                    >
                      <Trash2 size="0.6875rem" />
                    </button>
                  </div>
                  {renderInlineCardEditor("character", c.id, name)}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      <button
        ref={partyBtnRef}
        onClick={() => setShowCharPicker((open) => !open)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
      >
        <Plus size="0.75rem" /> {localizeUi("ui.chat.chatsettingsdrawer.addCharacterToParty")}
      </button>
      <CharacterSelect
        kind="character"
        multiple
        variant="controlled"
        open={showCharPicker}
        onOpenChange={setShowCharPicker}
        anchorRef={partyBtnRef}
        value={chatCharIds}
        onChange={toggleChangedCharacter}
        exclude={PICKER_EXCLUDED_IDS}
        busy={updateChat.isPending || roomRosterPending}
      />
      {activeCardsHaveCss && cardThemingControls}
    </ChatSettingsSection>
  );
}
