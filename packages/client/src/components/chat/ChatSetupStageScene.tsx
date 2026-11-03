import { useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, History, Shuffle, Sprout } from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { useChats } from "../../hooks/use-chats";
import { useStageGreeting, type StageGreetingMode } from "../../hooks/use-stage-greeting";
import { ApiError, getApiErrorMessage } from "../../lib/api-client";
import { cn } from "../../lib/utils";
import type { MessageWithSwipes } from "./chat-area.types";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const CHOICE =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--foreground)_14%,transparent)] px-3 text-[13.5px] sm:px-3.5 text-[color-mix(in_srgb,var(--foreground)_85%,transparent)] transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)] disabled:opacity-50 md:min-h-9";

/**
 * Setup stage: write a new opening scene for the chat, or go back to the card's own greeting. The new opening
 * becomes a swipe of the first message, so the Opening picker can switch back to any earlier greeting.
 */
export function ChatSetupStageScene({
  chat,
  first,
  onSetActiveSwipe,
}: {
  chat: Chat;
  first: MessageWithSwipes | null;
  onSetActiveSwipe: (messageId: string, index: number) => void;
}) {
  const { t } = useTranslation();
  const [idea, setIdea] = useState("");
  const greeting = useStageGreeting(chat.id);
  const [last, setLast] = useState<{ mode: StageGreetingMode; idea?: string } | null>(null);
  const { data: chats } = useChats();
  // ponytail: any earlier roleplay chat with a shared character counts; the server answers 400 when it has no turns.
  const hasEarlierChat = useMemo(
    () =>
      (chats ?? []).some(
        (c) => c.id !== chat.id && c.mode === "roleplay" && c.characterIds.some((id) => chat.characterIds.includes(id)),
      ),
    [chats, chat.id, chat.characterIds],
  );
  if (!first) return null;

  const run = (input: { mode: StageGreetingMode; idea?: string }) => {
    setLast(input);
    greeting.mutate(input, { onSuccess: () => setIdea("") });
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = idea.trim();
    if (text && !greeting.isPending) run({ mode: "line", idea: text });
  };

  return (
    <div
      data-component="ChatSetupStageScene"
      aria-busy={greeting.isPending}
      className="mt-5 flex flex-col gap-2.5 md:mt-6"
    >
      <form
        onSubmit={submit}
        className={cn(
          "flex h-11 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_14%,transparent)] pl-4 pr-1 md:h-10",
          greeting.isPending && "animate-pulse",
        )}
      >
        <input
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          maxLength={500}
          disabled={greeting.isPending}
          placeholder={t("chat.setupStage.scene.placeholder")}
          aria-label={t("chat.setupStage.scene.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
        />
        <button
          type="submit"
          disabled={!idea.trim() || greeting.isPending}
          aria-label={t("chat.setupStage.scene.send")}
          className={cn(
            "grid h-9 w-11 flex-none place-items-center rounded-full text-[var(--primary)] transition-opacity disabled:opacity-40 md:h-8",
            FOCUS,
          )}
        >
          <ArrowRight size="1.1rem" aria-hidden />
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {hasEarlierChat && (
          <button
            type="button"
            disabled={greeting.isPending}
            onClick={() => run({ mode: "continue" })}
            className={cn(CHOICE, FOCUS)}
          >
            <History size="0.9rem" aria-hidden className="max-sm:hidden" />
            {t("chat.setupStage.scene.continue")}
          </button>
        )}
        <button
          type="button"
          disabled={greeting.isPending}
          onClick={() => onSetActiveSwipe(first.id, 0)}
          className={cn(CHOICE, FOCUS)}
        >
          <Sprout size="0.9rem" aria-hidden className="max-sm:hidden" />
          {t("chat.setupStage.scene.fresh")}
        </button>
        <button
          type="button"
          disabled={greeting.isPending}
          onClick={() => run({ mode: "surprise" })}
          className={cn(CHOICE, FOCUS)}
        >
          <Shuffle size="0.9rem" aria-hidden className="max-sm:hidden" />
          {t("chat.setupStage.scene.surprise")}
        </button>
      </div>
      <p role="status" className="m-0 text-[12.5px] empty:-mt-2.5 text-[var(--muted-foreground)]">
        {greeting.isPending && t("chat.setupStage.scene.busy")}
        {greeting.isError && (
          <>
            {greeting.error instanceof ApiError && greeting.error.status < 500
              ? getApiErrorMessage(greeting.error, t("chat.setupStage.scene.error"))
              : t("chat.setupStage.scene.error")}{" "}
            {last && (
              <button type="button" onClick={() => run(last)} className={cn("underline underline-offset-2", FOCUS)}>
                {t("chat.setupStage.scene.retry")}
              </button>
            )}
          </>
        )}
      </p>
    </div>
  );
}
