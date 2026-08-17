import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api-client";
import { readCharacterGreetings } from "../../lib/character-greetings";
import { parseChatMetadata } from "../../lib/chat-display";
import { addSilentGreetingSwipes } from "../../lib/message-swipes";
import { useCreateMessage, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useCharacter } from "../../hooks/use-characters";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { RoleplayMessagePreview } from "./ChatMessage";

type CharacterLorebook = { id: string; name: string };

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Follow-up to a character drop: offer the character's greeting as a first message and let the
 * user drop the character's linked lorebooks (which activate automatically) back out of the chat.
 */
export function ChatCharacterDropOptions({
  chatId,
  characterId,
  characterName,
  askGreeting,
  onClose,
}: {
  chatId: string;
  characterId: string;
  characterName: string;
  askGreeting: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createMessage = useCreateMessage(chatId);
  const updateMetadata = useUpdateChatMetadata();
  const { data: character, isLoading: characterLoading } = useCharacter(askGreeting ? characterId : null);
  const { data: lorebooks = [], isLoading: lorebooksLoading } = useQuery({
    queryKey: ["lorebooks", "by-character", characterId],
    queryFn: () => api.get<CharacterLorebook[]>(`/lorebooks?characterId=${encodeURIComponent(characterId)}`),
  });

  const { greetings, dialogueColor } = useMemo(
    () =>
      askGreeting ? readCharacterGreetings((character as { data?: unknown } | undefined)?.data) : { greetings: [] },
    [askGreeting, character],
  );
  const [addGreeting, setAddGreeting] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loading = (askGreeting && characterLoading) || lorebooksLoading;
  const hasSomethingToAsk = greetings.length > 0 || lorebooks.length > 0;

  // Nothing to ask about once the character/lorebook data lands: get out of the way.
  useEffect(() => {
    if (!loading && !hasSomethingToAsk) onClose();
  }, [loading, hasSomethingToAsk, onClose]);

  const confirm = async () => {
    if (useChatStore.getState().activeChatId !== chatId) {
      toast.info(t("ui.chat.chatresourcedropoverlay.chatChanged"));
      onClose();
      return;
    }
    setSaving(true);
    try {
      if (excludedIds.length > 0) {
        const metadata = parseChatMetadata(useChatStore.getState().activeChat?.metadata);
        const current = readStringArray(metadata.excludedLorebookIds);
        await updateMetadata.mutateAsync({
          id: chatId,
          excludedLorebookIds: Array.from(new Set([...current, ...excludedIds])),
        });
      }
      const selected = addGreeting ? greetings[selectedIndex] : null;
      if (selected) {
        const message = await createMessage.mutateAsync({
          role: "assistant",
          content: selected.text,
          characterId,
        });
        const rest = greetings.filter((_greeting, index) => index !== selectedIndex).map((greeting) => greeting.text);
        if (message?.id && rest.length > 0) await addSilentGreetingSwipes(chatId, message.id, rest);
      }
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("ui.chat.chatsettingsdrawer.failedToAddSelectedGreeting"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!loading && hasSomethingToAsk}
      onClose={onClose}
      title={t("ui.chat.chatcharacterdropoptions.title", { name: characterName })}
      width="max-w-md"
      chatFloatingPanel
    >
      <div className="flex flex-col gap-4">
        {greetings.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={addGreeting}
                onChange={(event) => setAddGreeting(event.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {t("ui.chat.chatcharacterdropoptions.addFirstMessage")}
            </label>
            {addGreeting && greetings.length > 1 && (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("ui.chat.chatsettingsdrawer.chooseGreetingForValue1", { value1: characterName })}
              </p>
            )}
            {addGreeting && (
              <div className="max-h-[min(40dvh,18rem)] space-y-2 overflow-y-auto pr-1">
                {greetings.map((greeting, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <button
                      key={`${greeting.alternateIndex ?? "first"}:${greeting.text.slice(0, 32)}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      aria-pressed={selected}
                      className={cn(
                        "mari-chat-option-field w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                        selected && "mari-chat-option-field--active",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[0.6875rem] font-semibold">
                          {greeting.alternateIndex === null
                            ? t("ui.characters.dialoguetab.firstMessage")
                            : t("ui.characters.dialoguetab.alternateGreetingValue1", {
                                value1: greeting.alternateIndex,
                              })}
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[var(--border)]",
                            selected ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "text-transparent",
                          )}
                        >
                          {selected && <Check size="0.625rem" />}
                        </span>
                      </span>
                      <RoleplayMessagePreview
                        content={greeting.text.slice(0, 500)}
                        dialogueColor={dialogueColor}
                        className="mt-1 text-[0.6875rem] leading-relaxed"
                        selfCharacterId={characterId}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {lorebooks.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <BookOpen size="0.875rem" />
              {t("ui.chat.chatcharacterdropoptions.lorebooksTitle")}
            </span>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("ui.chat.chatcharacterdropoptions.lorebooksHint", { name: characterName })}
            </p>
            {lorebooks.map((lorebook) => (
              <label key={lorebook.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!excludedIds.includes(lorebook.id)}
                  onChange={(event) =>
                    setExcludedIds((current) =>
                      event.target.checked ? current.filter((id) => id !== lorebook.id) : [...current, lorebook.id],
                    )
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className="min-w-0 truncate">{lorebook.name}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            {t("onboarding.actions.skip")}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={saving}
            className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)]"
          >
            {saving ? t("ui.chat.chatsettingsdrawer.adding") : t("ui.chat.chatcharacterdropoptions.done")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
