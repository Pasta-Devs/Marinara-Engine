// ──────────────────────────────────────────────
// Quick Persona Switcher — the chat input's avatar button; it opens CharacterSelect
// ──────────────────────────────────────────────
import { useState, useRef, useMemo } from "react";
import { useCharacters, usePersonas } from "../../hooks/use-characters";
import { useUpdateChat, useChat } from "../../hooks/use-chats";
import { useChatStore } from "../../stores/chat.store";
import { cn, getAvatarCropStyle } from "../../lib/utils";
import { parseCharacterDisplayData } from "../../lib/character-display";
import { useTranslation as useUiTranslation } from "react-i18next";
import type { Persona } from "@marinara-engine/shared";
import { CharacterSelect, type PersonaChoice } from "../characters/CharacterSelect";

export function QuickPersonaSwitcher({ className }: { className?: string }) {
  const { t: localizeUi } = useUiTranslation();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const activeChatId = useChatStore((s) => s.activeChatId);
  const { data: rawPersonas } = usePersonas();
  const { data: rawCharacters } = useCharacters();
  const characters = useMemo(
    () =>
      (rawCharacters ?? []) as Array<{
        id: string;
        data: string | Record<string, unknown>;
        avatarPath?: string | null;
      }>,
    [rawCharacters],
  );
  const { data: chat } = useChat(activeChatId);
  const updateChat = useUpdateChat();
  const personas = (rawPersonas ?? []) as Persona[];

  const activePersonaId = chat?.personaId ?? null;
  const activeCharacterId = chat?.personaCharacterId ?? null;
  const activePersona = personas.find((p) => p.id === activePersonaId) ?? null;
  const activeCharacter = characters.find((character) => character.id === activeCharacterId) ?? null;
  const activeCharacterName = activeCharacter ? parseCharacterDisplayData(activeCharacter).name : null;
  const value: PersonaChoice = activePersonaId
    ? { persona: activePersonaId }
    : activeCharacterId
      ? { character: activeCharacterId }
      : null;

  if (!activeChatId) return null;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          activePersona || activeCharacter
            ? localizeUi("ui.chat.quickpersonaswitcher.value1Value2", {
                value1: activePersona?.name ?? activeCharacterName ?? "",
                value2: activePersona?.comment ? " — " + activePersona.comment : "",
              })
            : localizeUi("ui.chat.quickpersonaswitcher.quickPersonaSwitcher")
        }
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-full overflow-hidden transition-all border-2",
          open ? "border-foreground/40" : "border-transparent hover:border-foreground/30 hover:opacity-90",
          className,
        )}
      >
        {activePersona?.avatarPath || activeCharacter?.avatarPath ? (
          <img
            src={activePersona?.avatarPath ?? activeCharacter?.avatarPath ?? ""}
            alt={activePersona?.name ?? activeCharacterName ?? ""}
            className="h-full w-full object-cover rounded-full"
            style={getAvatarCropStyle(
              activePersona?.avatarPath
                ? activePersona.avatarCrop
                : activeCharacter
                  ? parseCharacterDisplayData(activeCharacter).avatarCrop
                  : undefined,
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-foreground/10 text-[0.75rem] font-semibold text-foreground/45">
            {(activePersona?.name ?? activeCharacterName ?? "?")[0]?.toUpperCase()}
          </div>
        )}
      </button>

      <CharacterSelect
        kind="persona"
        variant="controlled"
        allowNone
        open={open}
        onOpenChange={setOpen}
        anchorRef={btnRef}
        // Roleplay's composer pickers sit on the card surface, like the model picker beside this one.
        windowClassName={
          chat?.mode === "roleplay" ? "bg-[var(--card)] [--mari-chat-existing-bg:var(--card)]" : undefined
        }
        value={value}
        onChange={(next) =>
          updateChat.mutate({
            id: activeChatId,
            personaId: next && "persona" in next ? next.persona : null,
            personaCharacterId: next && "character" in next ? next.character : null,
          })
        }
      />
    </>
  );
}
