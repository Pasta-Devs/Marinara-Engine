import { type Chat, type ChatMode, type Persona } from "@marinara-engine/shared";
import {
  type CastCardLike,
  type CastCharacter,
  DrawerPersonaAvatar,
  CHAT_RESOURCE_REMOVE_BUTTON_CLASS,
  PICKER_EXCLUDED_IDS,
} from "./cast-shared";
import { useTranslation as useUiTranslation, useTranslation } from "react-i18next";
import { useUpdateChat, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useRef } from "react";
import { VenetianMask, Pencil, X, Plus, UserPlus } from "lucide-react";
import { getAvatarCropStyle, cn } from "../../../lib/utils";
import { CharacterSelect } from "../../../components/characters/CharacterSelect";
import { PersonaHistoryReassignDropdown } from "./PersonaHistoryReassignDropdown";
import { SettingsSwitch } from "../../../components/panels/settings/SettingControls";
import { ChatSettingsSection } from "../ChatSettingsSection";
import type { CharacterDisplayInfo } from "../../../lib/character-display";

interface PersonaSectionProps {
  order: number;
  /** The drawer's own, so the Characters picker still shows busy while a persona save is in flight. */
  updateChat: ReturnType<typeof useUpdateChat>;
  chat: Chat;
  chatMode: ChatMode;
  isRoleplayMode: boolean;
  characters: CastCharacter[];
  personas: Persona[];
  charNameMap: Map<string, string>;
  getCharacterInfo: (c: CastCardLike) => CharacterDisplayInfo;
  charName: (c: CastCardLike) => string;
  charTitle: (c: CastCardLike) => string | null;
  onboardingPersonaTemplates: Array<{ character: CastCharacter }>;
  setOnboardingTemplateId: (characterId: string) => void;
  showPersonaPicker: boolean;
  setShowPersonaPicker: React.Dispatch<React.SetStateAction<boolean>>;
  colorPersonaInlineNames: boolean;
  toggleInlineResourceEditor: (kind: "character" | "persona", id: string) => void;
  renderInlineCardEditor: (kind: "character" | "persona", id: string, displayName: string) => React.ReactNode;
}

export function PersonaSection({
  order,
  updateChat,
  chat,
  chatMode,
  isRoleplayMode,
  characters,
  personas,
  charNameMap,
  getCharacterInfo,
  charName,
  charTitle,
  onboardingPersonaTemplates,
  setOnboardingTemplateId,
  showPersonaPicker,
  setShowPersonaPicker,
  colorPersonaInlineNames,
  toggleInlineResourceEditor,
  renderInlineCardEditor,
}: PersonaSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const updateMeta = useUpdateChatMetadata();
  const personaBtnRef = useRef<HTMLDivElement>(null);
  return (
    <ChatSettingsSection
      id={`${chatMode}-persona`}
      style={{ order }}
      label={localizeUi("ui.characters.cardlibrarydetailcard.persona")}
      icon={<VenetianMask size="0.875rem" />}
      help={localizeUi("ui.chat.chatsettingsdrawer.yourPersonaDefinesWhoYouAreInThisChat")}
    >
      <div ref={personaBtnRef} tabIndex={-1} className="outline-none">
        {/* Currently selected persona */}
        {chat.personaId || chat.personaCharacterId ? (
          <>
            <div className="flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-2.5 py-2">
              <button
                type="button"
                onClick={() => setShowPersonaPicker((open) => !open)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-colors hover:opacity-80"
                title={localizeUi("ui.chat.chatsettingsdrawer.changePersona")}
              >
                {(() => {
                  const character = chat.personaCharacterId
                    ? characters.find((candidate) => candidate.id === chat.personaCharacterId)
                    : null;
                  const p = personas.find((p) => p.id === chat.personaId);
                  if (character) {
                    return (
                      <>
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-xs font-semibold">
                          {character.avatarPath ? (
                            <img
                              src={character.avatarPath}
                              alt=""
                              className="h-full w-full object-cover"
                              style={getAvatarCropStyle(getCharacterInfo(character).avatarCrop)}
                            />
                          ) : (
                            charName(character)[0]
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-xs">{charName(character)}</span>
                          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                            {charTitle(character) || localizeUi("ui.chat.personapicker.characterSource")}
                          </span>
                        </div>
                      </>
                    );
                  }
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
                  onClick={() =>
                    chat.personaCharacterId
                      ? toggleInlineResourceEditor("character", chat.personaCharacterId)
                      : toggleInlineResourceEditor("persona", chat.personaId!)
                  }
                  className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                  title={t("chat.settings.actions.editPersonaCard")}
                  aria-label={t("chat.settings.actions.editPersonaCard")}
                >
                  <Pencil size="0.6875rem" />
                </button>
                <button
                  type="button"
                  onClick={() => updateChat.mutate({ id: chat.id, personaId: null, personaCharacterId: null })}
                  className={CHAT_RESOURCE_REMOVE_BUTTON_CLASS}
                  data-chat-settings-remove-resource="persona"
                  title={localizeUi("ui.chat.chatsettingsdrawer.removePersona")}
                >
                  <X size="0.75rem" />
                </button>
              </div>
            </div>
            {chat.personaCharacterId
              ? renderInlineCardEditor(
                  "character",
                  chat.personaCharacterId,
                  charNameMap.get(chat.personaCharacterId) ?? "Unknown character",
                )
              : renderInlineCardEditor(
                  "persona",
                  chat.personaId!,
                  personas.find((persona) => persona.id === chat.personaId)?.name ?? "Unknown persona",
                )}
          </>
        ) : (
          <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.chatsettingsdrawer.noPersonaSelected")}
          </p>
        )}

        {/* Persona picker */}
        {!(chat.personaId || chat.personaCharacterId) && (
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
          open={showPersonaPicker}
          onOpenChange={setShowPersonaPicker}
          anchorRef={personaBtnRef}
          value={
            chat.personaId
              ? { persona: chat.personaId }
              : chat.personaCharacterId
                ? { character: chat.personaCharacterId }
                : null
          }
          onChange={(next) =>
            updateChat.mutate({
              id: chat.id,
              personaId: next && "persona" in next ? next.persona : null,
              personaCharacterId: next && "character" in next ? next.character : null,
            })
          }
          exclude={PICKER_EXCLUDED_IDS}
          header={
            <>
              {/* Onboarding templates, above None like the setup wizard's
                      Your Persona picker: Create is a positive choice, not an
                      escape hatch. One row per card in this chat that can build
                      a persona. */}
              {onboardingPersonaTemplates.map(({ character }) => {
                const name = charName(character);
                return (
                  <button
                    key={`onboarding-template-${character.id}`}
                    type="button"
                    onClick={() => {
                      setShowPersonaPicker(false);
                      setOnboardingTemplateId(character.id);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
                  >
                    {character.avatarPath ? (
                      <span className="relative block h-6 w-6 shrink-0 overflow-hidden rounded-full">
                        <img
                          src={character.avatarPath}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                          style={getAvatarCropStyle(getCharacterInfo(character).avatarCrop)}
                        />
                      </span>
                    ) : (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.625rem] font-semibold">
                        {name[0]}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-xs font-medium">
                        <UserPlus size="0.625rem" className="shrink-0 text-[var(--primary)]" />
                        {localizeUi("ui.characters.onboarding.modalTitle")}
                      </span>
                      <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                        {localizeUi("ui.characters.onboarding.templateSource", { value1: name })}
                      </span>
                    </div>
                  </button>
                );
              })}
              {onboardingPersonaTemplates.length > 0 && <div className="border-t border-[var(--border)]" />}
            </>
          }
        />
      </div>

      <PersonaHistoryReassignDropdown
        chatId={chat.id}
        targetName={
          chat.personaCharacterId
            ? (charNameMap.get(chat.personaCharacterId) ?? null)
            : (personas.find((persona) => persona.id === chat.personaId)?.name ?? null)
        }
      />
      {isRoleplayMode && (
        <SettingsSwitch
          label={localizeUi("ui.chat.chatsettingsdrawer.colorPersonaNameInText")}
          description={localizeUi("ui.chat.chatsettingsdrawer.colorPersonaNameInTextDescription")}
          checked={colorPersonaInlineNames}
          onChange={(checked) => updateMeta.mutate({ id: chat.id, colorPersonaInlineNames: checked })}
          labelPosition="start"
          className={cn(
            "mt-2 justify-between rounded-md px-3 py-2.5 text-left",
            colorPersonaInlineNames
              ? "bg-[var(--primary)]/10 ring-1 ring-[var(--primary)]/30"
              : "bg-[var(--secondary)] hover:bg-[var(--accent)]",
          )}
          labelClassName="text-[0.6875rem] font-medium"
        />
      )}
    </ChatSettingsSection>
  );
}
