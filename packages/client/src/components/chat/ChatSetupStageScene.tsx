import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, History, PenLine, Shuffle } from "lucide-react";
import type { Chat } from "@marinara-engine/shared";
import { useChats } from "../../hooks/use-chats";
import { useStageGreeting, type StageGreetingMode } from "../../hooks/use-stage-greeting";
import { ApiError } from "../../lib/api-client";
import { openingTitle } from "../../lib/chat-setup-stage";
import { cn } from "../../lib/utils";
import { useStageUndo } from "./ChatSetupStageEditors";
import type { MessageWithSwipes } from "./chat-area.types";

const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]";
const CARD =
  "flex h-[8.5rem] w-[9.5rem] flex-none snap-start flex-col rounded-[14px] border p-3 text-left transition-[border-color,box-shadow,transform] duration-150 disabled:opacity-50 motion-reduce:transition-none";
const IDLE =
  "cursor-pointer border-[color-mix(in_srgb,var(--foreground)_12%,transparent)] bg-[color-mix(in_srgb,var(--background)_55%,transparent)] hover:border-[color-mix(in_srgb,var(--foreground)_24%,transparent)]";
const CHOSEN =
  "-translate-y-0.5 border-[color-mix(in_srgb,var(--stage-accent,var(--primary))_80%,transparent)] bg-[color-mix(in_srgb,var(--background)_70%,transparent)] shadow-[0_0_0_1px_color-mix(in_srgb,var(--stage-accent,var(--primary))_45%,transparent),0_10px_30px_color-mix(in_srgb,var(--stage-accent,var(--primary))_18%,transparent)] motion-reduce:translate-y-0";
const ACTION =
  "flex min-h-11 flex-1 cursor-pointer flex-col justify-center gap-1.5 rounded-[14px] border border-dashed border-[color-mix(in_srgb,var(--foreground)_16%,transparent)] bg-transparent px-3 text-left text-[13px] text-[color-mix(in_srgb,var(--foreground)_82%,transparent)] transition-colors hover:border-[color-mix(in_srgb,var(--foreground)_30%,transparent)] hover:text-[var(--foreground)] disabled:opacity-50 [&>svg]:text-[var(--stage-accent,var(--primary))]";

/** The server answers with a `code`; the text shown is always ours, never the server's or a provider's. */
const ERROR_KEYS: Record<string, string> = {
  "no-earlier-chat": "chat.setupStage.scene.errorNoEarlier",
  "no-model": "chat.setupStage.scene.errorNoModel",
  started: "chat.setupStage.scene.errorStarted",
};
export function errorCode(error: unknown): string {
  const payload = error instanceof ApiError ? (error.payload as { code?: unknown } | null) : null;
  return typeof payload?.code === "string" ? payload.code : "";
}

/**
 * Setup stage opening cards: one card per greeting of the first message, then the ways to
 * write a new one (pick up an earlier chat, surprise me, write a scene). A new opening
 * becomes another swipe of the first message, so it turns into a card of its own.
 */
export function ChatSetupStageScene({
  chat,
  first,
  previews,
  actions,
  onSetActiveSwipe,
}: {
  chat: Chat;
  first: MessageWithSwipes;
  previews: string[];
  /** Roleplay only: new openings are written by the model. */
  actions: boolean;
  onSetActiveSwipe: (messageId: string, index: number) => void;
}) {
  const { t } = useTranslation();
  const [idea, setIdea] = useState("");
  const [writing, setWriting] = useState(false);
  const [page, setPage] = useState(0);
  const greeting = useStageGreeting(chat.id);
  const undo = useStageUndo("opening");
  const [last, setLast] = useState<{ mode: StageGreetingMode; idea?: string } | null>(null);
  const { data: chats } = useChats();
  const row = useRef<HTMLDivElement>(null);
  // ponytail: a chat whose last message is a few seconds newer than the chat itself has had a turn; hosted rooms
  // never count. The server stays the judge and answers `no-earlier-chat` when this guess goes wrong.
  const hasEarlierChat = useMemo(
    () =>
      (chats ?? []).some(
        (c) =>
          c.id !== chat.id &&
          c.mode === "roleplay" &&
          c.characterIds.some((id) => chat.characterIds.includes(id)) &&
          !!c.lastMessageAt &&
          Date.parse(c.lastMessageAt) - Date.parse(c.createdAt) > 2000,
      ),
    [chats, chat.id, chat.characterIds],
  );
  const active = Math.min(first.activeSwipeIndex ?? 0, Math.max(0, previews.length - 1));
  const tiles = previews.length + (actions ? (hasEarlierChat ? 2 : 1) : 0);

  const run = (input: { mode: StageGreetingMode; idea?: string }) => {
    setLast(input);
    greeting.mutate(input, { onSuccess: () => setIdea("") });
  };
  const pick = (index: number) => {
    if (index === active) return;
    onSetActiveSwipe(first.id, index);
    undo(() => onSetActiveSwipe(first.id, active));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = idea.trim();
    if (text && !greeting.isPending) run({ mode: "line", idea: text });
  };
  // Radio group keys: arrows move the choice and the focus, Home and End jump to the ends.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = previews.length;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? count - 1 : step ? (active + step + count) % count : null;
    if (next === null || greeting.isPending) return;
    event.preventDefault();
    pick(next);
    row.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  const onScroll = () => {
    const el = row.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    setPage(Math.round((el.scrollLeft / (el.scrollWidth - el.clientWidth)) * (tiles - 1)));
  };

  return (
    <div data-component="ChatSetupStageScene" aria-busy={greeting.isPending} className="mt-5 md:mt-6">
      <div
        ref={row}
        onScroll={onScroll}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0",
          tiles > 4 && "md:[mask-image:linear-gradient(90deg,#000_88%,transparent)]",
        )}
      >
        <div
          role="radiogroup"
          aria-label={t("chat.setupStage.row.opening")}
          onKeyDown={onKeyDown}
          className="flex flex-none gap-2.5"
        >
          {previews.map((preview, index) => {
            const chosen = index === active;
            return (
              <button
                key={index}
                type="button"
                role="radio"
                aria-checked={chosen}
                tabIndex={chosen ? 0 : -1}
                disabled={greeting.isPending}
                onClick={() => pick(index)}
                className={cn(CARD, chosen ? CHOSEN : IDLE, FOCUS)}
              >
                <span className="line-clamp-4 font-serif text-[14px] leading-[1.38] whitespace-pre-line text-[color-mix(in_srgb,var(--foreground)_88%,transparent)]">
                  {preview}
                </span>
                <span
                  className={cn(
                    "mt-auto truncate pt-2 text-[11px]",
                    chosen ? "text-[var(--stage-accent,var(--primary))]" : "text-[var(--muted-foreground)]",
                  )}
                >
                  {(chosen && openingTitle(preview)) ||
                    t("chat.setupStage.greetingNumbered", { index: index + 1, count: previews.length })}
                </span>
              </button>
            );
          })}
        </div>
        {actions && hasEarlierChat && (
          <button
            type="button"
            disabled={greeting.isPending}
            onClick={() => run({ mode: "continue" })}
            className={cn(
              CARD,
              IDLE,
              "justify-end gap-2 text-[13px] text-[color-mix(in_srgb,var(--foreground)_82%,transparent)]",
              FOCUS,
            )}
          >
            <History size="1rem" aria-hidden className="text-[var(--stage-accent,var(--primary))]" />
            {t("chat.setupStage.scene.continue")}
          </button>
        )}
        {actions && (
          <div className="flex h-[8.5rem] w-[9.5rem] flex-none snap-start flex-col gap-2.5">
            <button
              type="button"
              disabled={greeting.isPending}
              onClick={() => run({ mode: "surprise" })}
              className={cn(ACTION, FOCUS)}
            >
              <Shuffle size="1rem" aria-hidden />
              {t("chat.setupStage.scene.surprise")}
            </button>
            <button
              type="button"
              aria-expanded={writing}
              onClick={() => setWriting((open) => !open)}
              className={cn(ACTION, writing && "border-solid text-[var(--foreground)]", FOCUS)}
            >
              <PenLine size="1rem" aria-hidden />
              {t("chat.setupStage.scene.write")}
            </button>
          </div>
        )}
      </div>
      {tiles > 2 && (
        <div aria-hidden="true" className="mt-2.5 flex justify-center gap-1.5 md:hidden">
          {Array.from({ length: tiles }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-150",
                index === page
                  ? "w-4 bg-[var(--stage-accent,var(--primary))]"
                  : "w-1.5 bg-[color-mix(in_srgb,var(--foreground)_25%,transparent)]",
              )}
            />
          ))}
        </div>
      )}
      {writing && (
        <form
          onSubmit={submit}
          className={cn(
            "mt-3 flex h-11 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--foreground)_14%,transparent)] pl-4 pr-1 md:h-10",
            greeting.isPending && "animate-pulse",
          )}
        >
          <input
            autoFocus
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
              "grid h-9 w-9 flex-none place-items-center rounded-full text-[var(--primary)] transition-opacity disabled:opacity-40 md:h-8 md:w-8",
              FOCUS,
            )}
          >
            <ArrowRight size="1.1rem" aria-hidden />
          </button>
        </form>
      )}
      <p role="status" className="m-0 mt-2.5 text-[12.5px] text-[var(--muted-foreground)] empty:mt-0">
        {greeting.isPending && t("chat.setupStage.scene.busy")}
      </p>
      {greeting.isError && (
        <p role="alert" className="m-0 text-[12.5px] text-[var(--muted-foreground)]">
          {t(ERROR_KEYS[errorCode(greeting.error)] ?? "chat.setupStage.scene.error")}{" "}
          {last && (
            <button type="button" onClick={() => run(last)} className={cn("underline underline-offset-2", FOCUS)}>
              {t("chat.setupStage.scene.retry")}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
