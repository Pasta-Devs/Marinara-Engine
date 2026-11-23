// ──────────────────────────────────────────────
// New-chat setup as the page in the chat's own tab (new layout).
// The classic layout keeps the step-by-step window; this lays the same fields out
// on one page: who is in it, how it's told, "+ More options" for the rest, and a
// Start bar where the message box will be.
// ──────────────────────────────────────────────
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Pencil, Plus, Minus, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { OvEyebrow } from "../overhaul/EditorChrome";

const COVERED_CHAT_SELECTOR = '[data-mari-part="composer"], [data-chat-scroll]';

/**
 * The setup page lies over the chat (position: absolute), and the chat's message box and transcript
 * sit before it in the page. Inert them while the page is up, so Tab, typing and VoiceOver cannot reach
 * what you cannot see (QC Nov 22 K2). Only nodes this hook made inert are released again.
 */
function useCoveredChatInert(pageRef: { current: HTMLElement | null }) {
  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page || typeof MutationObserver === "undefined") return;
    // The nearest ancestor holding a message box is this chat's pane (split view has two).
    let host: HTMLElement | null = page.parentElement;
    while (host && host !== document.body) {
      if (Array.from(host.querySelectorAll(COVERED_CHAT_SELECTOR)).some((node) => !page.contains(node))) break;
      host = host.parentElement;
    }
    if (!host || host === document.body) host = page.parentElement;
    if (!host) return;
    const marked = new Set<HTMLElement>();
    const apply = () => {
      host!.querySelectorAll<HTMLElement>(COVERED_CHAT_SELECTOR).forEach((node) => {
        if (page.contains(node) || marked.has(node) || node.inert) return;
        node.inert = true;
        node.setAttribute("data-setup-covered", "");
        marked.add(node);
      });
    };
    apply();
    // The message box can mount after the page (lazy surfaces), so keep marking new ones.
    const observer = new MutationObserver(apply);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      marked.forEach((node) => {
        node.inert = false;
        node.removeAttribute("data-setup-covered");
      });
    };
  }, [pageRef]);
}

export function SetupPage({
  kind,
  eyebrow,
  title,
  subtitle,
  children,
  bar,
  footer,
  onClose,
  inert,
}: {
  kind: "roleplay" | "conversation" | "game";
  eyebrow: string;
  /** The chat's name, as an editable heading. */
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** The Start bar, in place of the message box. */
  bar: ReactNode;
  /** Just above the Start bar, outside the scrolling page (a failed start's reason). */
  footer?: ReactNode;
  onClose: () => void;
  inert?: boolean;
}) {
  const { t } = useUiTranslation();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const kickerId = useId();
  useCoveredChatInert(pageRef);
  // Keyboard and screen-reader users start on the page, not on the main area behind it. The page
  // itself takes focus, not the Name field, so iOS does not pop the keyboard; Tab goes on to Close.
  useEffect(() => {
    const page = pageRef.current;
    if (!page || inert) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && page.contains(active)) return;
    page.focus({ preventScroll: true });
    // Only on arrival: a later re-render must not pull focus back to the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={pageRef}
      data-component={kind === "game" ? "GameSetupWizard" : "ChatSetupWizard"}
      data-setup-page={kind}
      className={cn("ov-setup", `ov-setup--${kind}`)}
      inert={inert}
      tabIndex={-1}
      role="region"
      aria-labelledby={kickerId}
    >
      <div className="ov-setup__scroll">
        <div className="ov-setup__inner">
          <div className="ov-setup__head">
            <h2 id={kickerId} className="ov-setup__kicker">
              {eyebrow}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="ov-setup__close"
              aria-label={t("ui.chat.setupwizardshell.closeSetup")}
              title={t("ui.chat.setupwizardshell.closeSetup")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {title}
          {subtitle ? <p className="ov-setup__sub">{subtitle}</p> : null}
          {children}
        </div>
      </div>
      {footer}
      <div className="ov-setup__bar">
        <div className="ov-setup__barin">{bar}</div>
      </div>
    </div>
  );
}

/** The chat's name as the page heading: type to rename; saved when the field loses focus. */
export function SetupTitleField({
  name,
  placeholder,
  onRename,
}: {
  name: string;
  placeholder: string;
  onRename: (value: string) => void;
}) {
  const { t } = useUiTranslation();
  return (
    <label className="ov-setup__title">
      <input
        type="text"
        // Not a person's name. Safari ignores autocomplete="off" for its contact AutoFill bar; a field
        // whose name says "search" is one it leaves alone.
        name="chat-title-search"
        autoComplete="off"
        data-form-type="other"
        key={name}
        defaultValue={name}
        aria-label={t("ui.characters.metadatatab.name")}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={(event) => {
          const value = event.target.value.trim();
          if (value && value !== name) onRename(value);
          else if (!value) event.target.value = name;
        }}
      />
      <Pencil size={15} aria-hidden="true" />
    </label>
  );
}

export function SetupSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="ov-setup__section">
      <OvEyebrow as="h3">{title}</OvEyebrow>
      {children}
    </section>
  );
}

/** "+ More options": the parts most chats leave as they are, folded; the words beside it say what's inside. */
export function SetupMoreOptions({ summary, children }: { summary: string; children: ReactNode }) {
  const { t } = useUiTranslation();
  const [open, setOpen] = useState(false);
  return (
    <section className="ov-setup__section ov-setup__more">
      <button type="button" className="ov-setup__moretoggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <Minus size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
        <span>{t(open ? "chat.setupPage.fewerOptions" : "chat.setupPage.moreOptions")}</span>
        {!open ? <small>{summary}</small> : null}
      </button>
      {open ? <div className="ov-setup__morebody">{children}</div> : null}
    </section>
  );
}

/** A sub-heading inside "More options", above a block that keeps its own layout (agents, parameters). */
export function SetupBlock({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="ov-setup__block">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
