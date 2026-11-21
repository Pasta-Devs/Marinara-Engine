// ──────────────────────────────────────────────
// New-chat setup as the page in the chat's own tab (new layout).
// The classic layout keeps the step-by-step window; this lays the same fields out
// on one page: who is in it, how it's told, "+ More options" for the rest, and a
// Start bar where the message box will be.
// ──────────────────────────────────────────────
import { useState, type ReactNode } from "react";
import { Pencil, Plus, Minus, X } from "lucide-react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../lib/utils";
import { OvEyebrow } from "../overhaul/EditorChrome";

export function SetupPage({
  kind,
  eyebrow,
  title,
  subtitle,
  children,
  bar,
  onClose,
  inert,
}: {
  kind: "roleplay" | "conversation";
  eyebrow: string;
  /** The chat's name, as an editable heading. */
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  /** The Start bar, in place of the message box. */
  bar: ReactNode;
  onClose: () => void;
  inert?: boolean;
}) {
  const { t } = useUiTranslation();
  return (
    <div
      data-component="ChatSetupWizard"
      data-setup-page={kind}
      className={cn("ov-setup", `ov-setup--${kind}`)}
      inert={inert}
    >
      <div className="ov-setup__scroll">
        <div className="ov-setup__inner">
          <div className="ov-setup__head">
            <p className="ov-setup__kicker">{eyebrow}</p>
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
      <OvEyebrow>{title}</OvEyebrow>
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
      <h3>{title}</h3>
      {children}
    </div>
  );
}
