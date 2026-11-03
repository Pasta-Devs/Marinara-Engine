import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight } from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { useStageRecap } from "../../hooks/use-stage-greeting";
import { focusChatComposer, shouldWelcomeBack, welcomeRecapFromSummary } from "../../lib/chat-setup-stage";
import { cn } from "../../lib/utils";
import { FOCUS, SERIF } from "./ChatSetupStage";
import { errorCode } from "./ChatSetupStageScene";

/** Chats already greeted in this app session: each older chat says welcome back at most once. */
const welcomed = new Set<string>();

/** How close to the bottom (px) the reader must be for the card to keep the latest message in view. */
const NEAR_BOTTOM_PX = 80;

/**
 * Opens the welcome-back card when an older chat is opened. It closes on Continue, on a chat
 * switch, and when a new message makes the chat recent again. `preview` is the character's
 * latest message, shown when the chat has no stored summary.
 */
export function useWelcomeBack(input: {
  chat: Chat | null | undefined;
  chatMeta: Record<string, unknown>;
  messages: ReadonlyArray<{ chatId: string; createdAt: string; role?: string; content?: string }> | undefined;
  blocked: boolean;
}) {
  const { chat, chatMeta, messages, blocked } = input;
  const chatId = chat?.id;
  const mode = chat?.mode;
  const [openFor, setOpenFor] = useState<string | null>(null);
  useEffect(() => {
    const due = !blocked && shouldWelcomeBack({ chatId, mode, meta: chatMeta, messages, now: Date.now() });
    if (!due) {
      setOpenFor(null);
    } else if (chatId && !welcomed.has(chatId)) {
      welcomed.add(chatId);
      setOpenFor(chatId);
    }
  }, [blocked, chatId, mode, chatMeta, messages]);
  const preview =
    [...(messages ?? [])]
      .reverse()
      .find((m) => m.role === "assistant")
      ?.content?.trim() ?? "";
  return { visible: !!chatId && openFor === chatId, close: () => setOpenFor(null), preview };
}

/** A compact recap above the latest message of a chat reopened after a few days. */
export function ChatWelcomeBack({
  variant,
  chat,
  chatMeta,
  characterNames,
  preview,
  onClose,
}: {
  variant: "roleplay" | "conversation";
  chat: Chat;
  chatMeta: Record<string, unknown>;
  characterNames: string[];
  preview: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const stored = welcomeRecapFromSummary(chatMeta.summary);
  // The model is only called on an explicit click, and never when a stored summary exists.
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const asked = askedFor === chat.id;
  const recap = useStageRecap(chat.id, !stored && asked);
  const text = stored ?? recap.data?.recap;
  const sectionRef = useRef<HTMLElement>(null);
  const lastHeight = useRef(0);
  const id = useId();
  // The card lands after the list scrolled to the bottom; keep the latest message in view as it
  // grows, but only for a reader who was still near the bottom before the card changed.
  useLayoutEffect(() => {
    const section = sectionRef.current;
    const scroller = section?.closest<HTMLElement>("[data-chat-scroll]");
    if (!section || !scroller) return;
    const grown = section.offsetHeight - lastHeight.current;
    lastHeight.current = section.offsetHeight;
    const distanceBefore = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight - grown;
    if (distanceBefore < NEAR_BOTTOM_PX) scroller.scrollTo({ top: scroller.scrollHeight });
  }, [text, asked, recap.isError]);
  const close = () => {
    onClose();
    focusChatComposer(sectionRef.current);
  };

  return (
    <section
      ref={sectionRef}
      data-component="ChatWelcomeBack"
      aria-labelledby={`${id}-kicker ${id}-title`}
      className={cn(
        "animate-fade-in-up mx-auto mb-4 max-w-[600px] rounded-[18px] border px-4 py-3.5 md:px-5",
        variant === "conversation"
          ? "w-[calc(100%-2rem)] border-[var(--border)] bg-[var(--card)]"
          : "w-full border-[color-mix(in_srgb,var(--foreground)_11%,transparent)] bg-[color-mix(in_srgb,var(--background)_70%,transparent)] backdrop-blur-[20px]",
      )}
    >
      <p id={`${id}-kicker`} className="m-0 text-xs text-[var(--muted-foreground)]">
        {t("chat.setupStage.welcome.kicker")}
      </p>
      <h2
        id={`${id}-title`}
        style={SERIF}
        className="m-0 truncate text-[22px] leading-tight font-normal text-[var(--foreground)] md:text-[26px]"
      >
        {characterNames.join(", ") || chat.name}
      </h2>
      <div className="mt-2 text-[14px] leading-[1.45] text-[color-mix(in_srgb,var(--foreground)_80%,transparent)]">
        {text ? (
          <p className="m-0 line-clamp-3">{text}</p>
        ) : !stored && !asked ? (
          <>
            {preview && <p className="m-0 line-clamp-2">{preview}</p>}
            <button
              type="button"
              onClick={() => setAskedFor(chat.id)}
              className={cn("mt-1 text-[13px] underline underline-offset-2", FOCUS)}
            >
              {t("chat.setupStage.welcome.catchUp")}
            </button>
          </>
        ) : recap.isError ? (
          <p role="alert" className="m-0">
            {t(
              errorCode(recap.error) === "no-model"
                ? "chat.setupStage.welcome.errorNoModel"
                : "chat.setupStage.welcome.error",
            )}{" "}
            <button
              type="button"
              onClick={() => void recap.refetch()}
              className={cn("underline underline-offset-2", FOCUS)}
            >
              {t("chat.setupStage.welcome.retry")}
            </button>
          </p>
        ) : (
          <p role="status" className="m-0 animate-pulse text-[var(--muted-foreground)]">
            {t("chat.setupStage.welcome.busy")}
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={close}
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] transition-[filter] duration-150 hover:brightness-110",
            FOCUS,
          )}
        >
          {t("chat.setupStage.welcome.continue")}
          <ArrowRight size="0.95rem" aria-hidden />
        </button>
      </div>
    </section>
  );
}
