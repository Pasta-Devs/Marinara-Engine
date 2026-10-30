import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { readCardOnboarding } from "@marinara-engine/shared";
import { api } from "../../lib/api-client";
import { readCharacterGreetings } from "../../lib/character-greetings";
import { parseChatMetadata } from "../../lib/chat-display";
import { resolveGreetingPreview } from "../../lib/chat-macros";
import { readCardWithQuestions } from "../../lib/onboarding-add-card";
import { cardAnswerValues } from "../../lib/onboarding-preview-highlight";
import { readChatVariables } from "../../lib/state-editor/chat-variables-editor-source";
import { addSilentGreetingSwipes } from "../../lib/message-swipes";
import { useCreateMessage, useUpdateChatMetadata } from "../../hooks/use-chats";
import { useCharacter, useCharacters, usePersonas } from "../../hooks/use-characters";
import { useChatStore } from "../../stores/chat.store";
import { cn } from "../../lib/utils";
import { Modal } from "../ui/Modal";
import { CharacterOnboardingModal } from "../characters/CharacterOnboardingModal";
import { RoleplayMessagePreview } from "./ChatMessage";

type CharacterLorebook = { id: string; name: string };

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Follow-up to a character drop: ask the character's questions (a Roleplay chat only), offer its
 * greeting as a first message and let the user drop the character's linked lorebooks (which
 * activate automatically) back out of the chat.
 */
export function ChatCharacterDropOptions({
  chatId,
  characterId,
  characterName,
  askGreeting,
  askQuestions,
  onClose,
}: {
  chatId: string;
  characterId: string;
  characterName: string;
  askGreeting: boolean;
  /** Whether the card's character questions may be asked: a Roleplay chat that isn't a hosted room. */
  askQuestions: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createMessage = useCreateMessage(chatId);
  const updateMetadata = useUpdateChatMetadata();
  const needsCharacter = askGreeting || askQuestions;
  const { data: character, isLoading: characterLoading } = useCharacter(needsCharacter ? characterId : null);
  const { data: allCharacters } = useCharacters({ includeBuiltIn: true });
  const { data: personas } = usePersonas();
  // Read live, so the previews show the answers just saved once the chat refreshes. After the
  // drop's `updateChat.mutateAsync` resolved, its onSuccess has already put the server's chat (with
  // the answers it seeded for this card) in the store, and this component mounts after that.
  const activeChat = useChatStore((state) => state.activeChat);
  const chat = activeChat?.id === chatId ? activeChat : null;
  const chatVariables = useMemo(() => readChatVariables(chat?.metadata), [chat?.metadata]);
  const { data: lorebooks = [], isLoading: lorebooksLoading } = useQuery({
    queryKey: ["lorebooks", "by-character", characterId],
    queryFn: () => api.get<CharacterLorebook[]>(`/lorebooks?characterId=${encodeURIComponent(characterId)}`),
  });

  const characterData = (character as { data?: unknown } | undefined)?.data;
  const { greetings, dialogueColor } = useMemo(
    () => (askGreeting ? readCharacterGreetings(characterData) : { greetings: [] }),
    [askGreeting, characterData],
  );
  const cardQuestions = useMemo(
    () => (askQuestions && chat ? readCardWithQuestions(characterData) : null),
    [askQuestions, chat, characterData],
  );
  const answerValues = useMemo(
    () => cardAnswerValues(readCardOnboarding(characterData)?.onboarding.cardVariables ?? [], chatVariables),
    [characterData, chatVariables],
  );
  const [addGreeting, setAddGreeting] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [questionsDone, setQuestionsDone] = useState(false);

  const loading = (needsCharacter && characterLoading) || lorebooksLoading;
  const questionsOpen = !loading && cardQuestions !== null && !questionsDone;
  const hasSomethingToAsk = questionsOpen || greetings.length > 0 || lorebooks.length > 0;

  // Nothing to ask about once the character/lorebook data lands: get out of the way.
  useEffect(() => {
    if (!loading && !hasSomethingToAsk) onClose();
  }, [loading, hasSomethingToAsk, onClose]);

  // Save and Back both move on to the greeting and lorebook options below. A failed save keeps the
  // window (and the answers it holds) open, as in Chat Settings.
  const saveAnswers = useCallback(
    async (_personaId: string | null, macroVariables: Record<string, string>) => {
      if (Object.keys(macroVariables).length > 0) {
        try {
          await updateMetadata.mutateAsync({ id: chatId, macroVariables });
        } catch {
          toast.error(t("ui.characters.onboarding.cardVariablesFailed"));
          return;
        }
      }
      setQuestionsDone(true);
    },
    [chatId, t, updateMetadata],
  );

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
    <>
      {questionsOpen && cardQuestions && (
        <CharacterOnboardingModal
          open
          cards={[
            {
              characterId,
              name: cardQuestions.name || characterName,
              onboarding: cardQuestions.onboarding,
              cardFields: cardQuestions.cardFields,
            },
          ]}
          participantNames={[cardQuestions.name || characterName]}
          // The answers this chat already holds (the server seeds a card's defaults when it joins),
          // so the window opens on them.
          initialAnswers={chatVariables}
          withPersona={false}
          chatFloatingPanel
          onBack={() => setQuestionsDone(true)}
          onCreated={saveAnswers}
        />
      )}
      <Modal
        open={!loading && hasSomethingToAsk && !questionsOpen}
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
                    // Resolved before the cut, so the cut can't split a {{tag}}.
                    const preview = resolveGreetingPreview(greeting.text, {
                      character: { id: characterId, data: characterData },
                      chat,
                      characters: allCharacters as Array<{ id: string; data: unknown }> | undefined,
                      personas,
                      chatVariables,
                    });
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
                          content={preview.text}
                          dialogueColor={dialogueColor}
                          className="mt-1 text-[0.6875rem] leading-relaxed"
                          selfCharacterId={characterId}
                          answerValues={answerValues}
                          answerTemplate={greeting.text}
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
    </>
  );
}
