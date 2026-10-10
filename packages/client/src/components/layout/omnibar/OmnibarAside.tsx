import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Check, Copy, RefreshCw, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { MariStorySprite } from "../../chat/MariStorySprite";
import { useMariAppearancePack } from "../../../hooks/use-mari-appearance-pack";
import type { OmnibarAsideState } from "../../../hooks/use-omnibar-aside";
import { renderCompactInline, renderMarkdownBlocks } from "../../../lib/markdown";
import { stripStrayMarkdown } from "../../../lib/omnibar-aside-text";
import { copyToClipboard } from "../../../lib/utils";
import { formatShortcutKey } from "../../../lib/keyboard-shortcuts";

export interface OmnibarAsideProps {
  state: OmnibarAsideState;
  /** Name of the connection answering, when it is not the local model. */
  connectionName?: string | null;
  /** False until the aside has explained itself once (R19). */
  disclosed: boolean;
  onDisclose: () => void;
  onDisable: () => void;
  onEscalate: () => void;
  /** Opens the omnibar settings, where the answering model is chosen. */
  onChooseModel: () => void;
  /** Mari's own connection, offered for quick answers when no local model is downloaded. */
  connectionOffer?: { id: string; name: string } | null;
  onUseConnectionOffer: (id: string) => void;
  /** Re-fires the call after an error (R24: plain error, never a toast). */
  onRetry: () => void;
  /** Asks the same question again, past the answer cache. */
  onAnswerAgain: () => void;
  /** The follow-up line. Every follow-up goes to Mari's window with this answer attached. */
  onFollowUp: (question: string) => void;
  /** Things the answer names, which a click opens like their own rows. `src` is the row's face, when it has one. */
  links: readonly { id: string; title: string; src?: string | null; icon?: LucideIcon }[];
  /** The aside's idle delay, so the wait line fills over exactly the time the call waits. */
  delayMs: number;
  onOpenLink: (id: string) => void;
  /** The query named a capability a real official Agent covers (K4). */
  showDownloadAgents: boolean;
  onOpenDownloadAgents: () => void;
}

// Small text actions (direction A); a full 44px target on touch.
const textAction = "font-semibold underline-offset-2 hover:underline [@media(pointer:coarse)]:min-h-11";
// The one way forward is the card's only button (rule 4); on a phone it is full width on its own line at the foot.
// UX-08: solid like Keep, so it never reads as disabled (the chrome control's text is 64% alpha).
const continueAction =
  "mari-btn mari-btn--solid ml-auto [@media(pointer:coarse)]:order-last [@media(pointer:coarse)]:ml-0 [@media(pointer:coarse)]:basis-full";
// Copy and Answer again are icons, so they never read as the next step.
const iconAction =
  "inline-flex h-6 w-6 items-center justify-center rounded hover:text-[var(--foreground)] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11";

/** Bold, lists and inline code through the app's message renderer; nothing heavier is asked for. */
function AnswerText({ text, muted }: { text: string; muted?: boolean }) {
  // Blank lines collapse: a three-sentence answer reads tighter without paragraph gaps.
  const rendered = useMemo(
    () => renderMarkdownBlocks(text.trim().replace(/\n{2,}/g, "\n"), renderCompactInline, "omnibar-answer"),
    [text],
  );
  return (
    <div
      // The shared inline-code style is tuned for dark chat surfaces; the omnibar follows the theme.
      className={`mari-message-content text-[0.8125rem] leading-[1.45] [&_.mari-md-inline-code]:border-[var(--border)]! [&_.mari-md-inline-code]:bg-[var(--secondary)]! [&_.mari-md-inline-code]:text-[var(--foreground)]! [&_.mari-md-ol]:my-1 [&_.mari-md-ul]:my-1 ${
        muted ? "text-[var(--muted-foreground)]!" : ""
      }`}
    >
      {rendered}
    </div>
  );
}

/**
 * The cheap answer, grown inside the promoted "Ask Prof. Mari" row (R9).
 *
 * It renders as that row's expansion, so it only ever pushes rows below the
 * selection: nothing above the Ask row moves while it streams. It is not a row
 * of its own - not ranked, not in the arrow-key cycle.
 */
export function OmnibarAside({
  state,
  connectionName,
  disclosed,
  onDisclose,
  onDisable,
  onEscalate,
  onChooseModel,
  connectionOffer,
  onUseConnectionOffer,
  onRetry,
  onAnswerAgain,
  onFollowUp,
  links,
  delayMs,
  onOpenLink,
  showDownloadAgents,
  onOpenDownloadAgents,
}: OmnibarAsideProps) {
  const { t } = useTranslation();
  const appearance = useMariAppearancePack();
  // Keyed to the answer, so a new answer never shows the last one's "Copied".
  const [copiedAnswer, setCopiedAnswer] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState("");
  // UX-09: a Continue tap while the answer streams is kept and runs once the last word is in.
  const [continueQueued, setContinueQueued] = useState(false);
  const failed = state.status === "error";
  const complete = state.status === "complete";
  const errorKind = state.errorKind ?? "provider";
  // Only a missing key or a missing model can be fixed by choosing a model; any other failure is retried.
  const needsChoice = errorKind === "auth" || errorKind === "missing-model";
  const readingNames = (state.sources ?? []).map((source) => source.heading).join(" · ");
  const tierLabel =
    state.tier === "local"
      ? t("omnibar.aside.tierLocal", "Local")
      : (connectionName ?? t("omnibar.aside.tierRemote", "Your connection"));

  const copyLabel = copiedAnswer === state.answer ? t("omnibar.aside.copied", "Copied") : t("markdown.copy", "Copy");
  const announcement = complete ? stripStrayMarkdown(state.answer) : failed ? (state.error ?? "") : "";

  useEffect(() => {
    if (!continueQueued || state.status === "streaming") return;
    setContinueQueued(false);
    // A failed answer still offers Continue, so a tap made while it streamed is not dropped.
    if (state.status === "complete" || state.status === "error") onEscalate();
  }, [continueQueued, onEscalate, state.status]);

  const focusSearch = () =>
    document.querySelector<HTMLInputElement>('[data-component="GlobalOmnibar.Panel"] input')?.focus();

  const onFollowUpKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      // Handled here, so the omnibar's Escape (close) does not run from inside the row.
      event.preventDefault();
      event.currentTarget.blur();
      focusSearch();
      return;
    }
    if (event.key !== "Enter" || !followUp.trim()) return;
    event.preventDefault();
    onFollowUp(followUp.trim());
    setFollowUp("");
  };

  if (state.status === "waiting") {
    return (
      <section data-component="GlobalOmnibar.Aside" aria-label={t("omnibar.aside.label", "Quick answer · Read-only")}>
        <p className="mb-1 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
          {t("omnibar.aside.label", "Quick answer · Read-only")}
        </p>
        <span aria-hidden="true" className="block h-0.5 overflow-hidden rounded-full bg-[var(--border)]">
          <span
            className="omnibar-aside-wait block h-full bg-[var(--muted-foreground)]"
            style={{ animationDuration: `${delayMs}ms` }}
          />
        </span>
        <p className="mt-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {t("omnibar.aside.waiting", "Quick answer when you pause")}
        </p>
      </section>
    );
  }

  if (state.status === "unavailable" && connectionOffer) {
    return (
      <p
        data-component="GlobalOmnibar.Aside"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]"
      >
        <span>
          {t("omnibar.aside.offer", "Use {{name}} for quick answers. Each answer is one short request.", {
            name: connectionOffer.name,
          })}
        </span>
        <button
          type="button"
          onClick={() => {
            onUseConnectionOffer(connectionOffer.id);
            // UX-02: the offer row unmounts with this button; keep the keyboard in the search field.
            focusSearch();
          }}
          className={textAction}
        >
          {t("omnibar.aside.offerUse", "Use this connection")}
        </button>
        <button type="button" onClick={onChooseModel} className={textAction}>
          {t("omnibar.aside.chooseModel", "Choose a model")}
        </button>
      </p>
    );
  }

  if (state.status === "unavailable") {
    return (
      <p
        data-component="GlobalOmnibar.Aside"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]"
      >
        <span>{t("omnibar.aside.needsModel", "Choose a model so Professor Mari can answer searches like this.")}</span>
        <button type="button" onClick={onChooseModel} className={textAction}>
          {t("omnibar.aside.chooseModel", "Choose a model")}
        </button>
        <button type="button" onClick={onDisable} className={textAction}>
          {t("omnibar.aside.turnOff", "Turn this off")}
        </button>
      </p>
    );
  }

  return (
    <section data-component="GlobalOmnibar.Aside" aria-label={t("omnibar.aside.label", "Quick answer · Read-only")}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      {/* Says what this is before its words: a short answer that changes nothing, not her window. */}
      <p className="mb-1 text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
        {t("omnibar.aside.label", "Quick answer · Read-only")}
      </p>
      {state.status === "thinking" ? (
        // Two lines tall from the start, so the answer that follows does not push the list.
        <div className="flex min-h-[2.4rem] items-center gap-2 text-xs text-[var(--muted-foreground)]">
          <span className="flex h-7 w-5 shrink-0 items-center justify-center [&>.mari-story-sprite]:h-7 [&>.mari-story-sprite]:w-[1.1rem]">
            <MariStorySprite state="thinking" pullTarget={false} />
          </span>
          <span className="min-w-0">
            {readingNames
              ? t("omnibar.aside.reading", "Reading {{sources}}…", { sources: readingNames })
              : t("omnibar.aside.thinking", "Professor Mari is thinking…")}
          </span>
        </div>
      ) : failed ? (
        <div className="flex items-start gap-2">
          <span className="mari-workspace-portrait" data-state="shrug" aria-hidden="true">
            <img src={appearance.portraits.shrug} alt="" draggable={false} data-part="idle" />
          </span>
          <div className="min-w-0 text-xs text-[var(--muted-foreground)]">
            <p>
              {errorKind === "auth"
                ? t("omnibar.aside.error.auth", "{{model}} did not accept this connection's key.", {
                    model: tierLabel,
                  })
                : errorKind === "missing-model"
                  ? t("omnibar.aside.needsModel", "Choose a model so Professor Mari can answer searches like this.")
                  : errorKind === "empty"
                    ? t("omnibar.aside.error.empty", "No quick answer this time: {{model}} sent no words.", {
                        model: tierLabel,
                      })
                    : errorKind === "network"
                      ? t("omnibar.aside.error.network", "No quick answer this time: the connection did not answer.")
                      : t("omnibar.aside.error.provider", "No quick answer this time: {{model}} did not reply.", {
                          model: tierLabel,
                        })}
            </p>
            <details className="mt-1 text-[0.6875rem]">
              <summary className="cursor-pointer">{t("omnibar.aside.details", "Details")}</summary>
              <p className="mt-1 break-words">{state.error}</p>
            </details>
          </div>
        </div>
      ) : (
        <AnswerText text={state.answer} />
      )}
      {complete && state.sources?.length ? (
        <p className="mt-1.5 truncate text-[0.6875rem] text-[var(--muted-foreground)]">
          {t("omnibar.aside.sources", "From the docs")} · {readingNames}
        </p>
      ) : null}
      {complete && (links.length > 0 || showDownloadAgents) ? (
        <div className="mt-1.5 flex flex-wrap gap-1.5" aria-label={t("omnibar.aside.links", "Open from this answer")}>
          {links.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onOpenLink(link.id)}
              className="mari-chrome-control mari-chrome-control--compact"
            >
              {link.src ? (
                <img src={link.src} alt="" draggable={false} className="h-4 w-4 rounded-full object-cover" />
              ) : link.icon ? (
                <link.icon size={13} aria-hidden="true" />
              ) : null}
              {link.title}
            </button>
          ))}
          {showDownloadAgents ? (
            <button
              type="button"
              onClick={onOpenDownloadAgents}
              className="mari-chrome-control mari-chrome-control--compact"
            >
              {t("omnibar.aside.downloadAgents", "Download Agents")}
            </button>
          ) : null}
        </div>
      ) : null}
      {state.status === "thinking" ? null : (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          {failed ? (
            <>
              <button type="button" onClick={onRetry} className={textAction}>
                {t("omnibar.aside.retry", "Try again")}
              </button>
              {needsChoice ? (
                <button type="button" onClick={onChooseModel} className={textAction}>
                  {t("omnibar.aside.chooseModel", "Choose a model")}
                </button>
              ) : null}
              <button type="button" onClick={onEscalate} className={continueAction}>
                {t("omnibar.aside.escalate", "Continue with Prof. Mari")}
              </button>
            </>
          ) : (
            <>
              <span>{tierLabel}</span>
              {/* UX-09: the icons hold their place while streaming, so Continue does not move under the thumb. */}
              {complete || state.status === "streaming" ? (
                <>
                  <button
                    type="button"
                    disabled={!complete}
                    onClick={() =>
                      void copyToClipboard(state.answer).then((ok) =>
                        ok ? setCopiedAnswer(state.answer) : toast.error(t("markdown.copyFailed", "Copy failed")),
                      )
                    }
                    className={`${iconAction} ${complete ? "" : "invisible"}`}
                    aria-label={copyLabel}
                    title={copyLabel}
                  >
                    {copiedAnswer === state.answer ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  <button
                    type="button"
                    disabled={!complete}
                    onClick={onAnswerAgain}
                    className={`${iconAction} ${complete ? "" : "invisible"}`}
                    aria-label={t("omnibar.aside.answerAgain", "Answer again")}
                    title={t("omnibar.aside.answerAgain", "Answer again")}
                  >
                    <RefreshCw size={13} />
                  </button>
                </>
              ) : null}
              {/* Handing over mid-stream would send half an answer, so a tap then waits for the last word. */}
              <button
                type="button"
                onClick={state.status === "streaming" ? () => setContinueQueued(true) : onEscalate}
                aria-busy={continueQueued || undefined}
                className={continueAction}
                title={t("commandCenter.keyboard.continueMari", "{{mod}}+Enter Continue with Prof. Mari", {
                  mod: formatShortcutKey("Mod"),
                })}
              >
                {t("omnibar.aside.escalate", "Continue with Prof. Mari")}
              </button>
            </>
          )}
        </div>
      )}
      {!disclosed && complete ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] text-[var(--muted-foreground)]">
          <span>{t("omnibar.aside.disclosure", "Professor Mari answered your question.")}</span>
          <button type="button" onClick={onDisable} className={textAction}>
            {t("omnibar.aside.turnOff", "Turn this off")}
          </button>
          <button type="button" onClick={onDisclose} className={textAction}>
            {t("omnibar.aside.gotIt", "Got it")}
          </button>
        </p>
      ) : null}
      {complete ? (
        <input
          type="text"
          value={followUp}
          onChange={(event) => setFollowUp(event.target.value)}
          onKeyDown={onFollowUpKeyDown}
          maxLength={500}
          aria-label={t("omnibar.aside.followUp.label", "Follow-up question")}
          placeholder={t("omnibar.aside.followUp.placeholder", "Ask Prof. Mari more…")}
          className="mt-2 h-11 w-full min-w-0 border-0 border-t border-[var(--border)] bg-transparent px-0 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--ring)] sm:h-8 sm:text-xs"
        />
      ) : null}
    </section>
  );
}
