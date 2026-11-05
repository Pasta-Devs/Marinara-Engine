// #5073: the composer attach control for Professor Mari — a paperclip that opens a small menu
// (like Claude's "+") instead of jumping straight to the file picker. Shared by both the floating
// and docked composers so the menu can't drift between them. Mirrors the adjacent connection popover
// (anchored div + outside-click + in-dialog focus scope), matching the surrounding composer code.
// It doubles as the index of what she can do: Attach, the `@` link, and her commands (the `/` menu's list).
import { useEffect, useRef, useState } from "react";
import { AtSign, Layers, Loader2, MessageSquareText, Paperclip } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useInDialogFocusScope } from "../../hooks/use-in-dialog-focus-scope";
import { MARI_COMMANDS, type MariCommandId } from "../../lib/mari-commands";
import { MariRow } from "./mari-primitives";

/** Attach already holds these two, so the Mari section leaves them out. */
const ATTACH_SECTION_COMMANDS: readonly MariCommandId[] = ["attach", "context"];

interface Props {
  onAttachFiles: () => void;
  onAddChatHistory: () => void;
  onViewContext: () => void;
  /** Types `@` at the caret so the picker opens. */
  onLinkWithAt: () => void;
  onCommand: (id: MariCommandId) => void;
  availableCommands: readonly MariCommandId[];
  /** A count shown beside a command (active skills, saved memories, pending approvals). */
  commandCounts?: Partial<Record<MariCommandId, number>>;
  /** Pending file attachments on the composer (drives the active paperclip state). */
  attachedFileCount: number;
  /** Attached reference-context items on this Mari chat (drives the menu badge). */
  attachedContextCount: number;
  disabled: boolean;
  isReading: boolean;
}

export function MariAttachButton({
  onAttachFiles,
  onAddChatHistory,
  onViewContext,
  onLinkWithAt,
  onCommand,
  availableCommands,
  commandCounts = {},
  attachedFileCount,
  attachedContextCount,
  disabled,
  isReading,
}: Props) {
  const { t: localizeUi } = useTranslation();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);
  // Escape closes only this menu; a second Escape reaches the omnibar.
  const onMenuKeyDown = useInDialogFocusScope(menuRef, () => setOpen(false), open);

  const mariCommands = MARI_COMMANDS.filter(
    (command) => availableCommands.includes(command.id) && !ATTACH_SECTION_COMMANDS.includes(command.id),
  );

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        // R11: a quiet 34px circle (44px hit area on touch, globals.css); filled while open or in use.
        className="mari-composer-icon"
        data-active={attachedFileCount > 0 || attachedContextCount > 0 ? "true" : undefined}
        title={localizeUi("ui.chat.homeprofessormarichat.attachMenuLabel")}
        aria-label={localizeUi("ui.chat.homeprofessormarichat.attachMenuLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isReading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Paperclip strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className="mari-composer-menu__popover"
          data-component="MariAttachMenu"
        >
          <p className="mari-composer-menu__head">{localizeUi("mari.composerCommands.section.attach")}</p>
          <MariRow
            role="menuitem"
            slot={<Paperclip aria-hidden="true" />}
            title={localizeUi("ui.chat.homeprofessormarichat.attachMenuFiles")}
            fact={localizeUi("mari.composerCommands.attachMenu.filesFact")}
            onClick={() => run(onAttachFiles)}
          />
          <MariRow
            role="menuitem"
            slot={<MessageSquareText aria-hidden="true" />}
            title={localizeUi("ui.chat.homeprofessormarichat.attachMenuChatHistory")}
            fact={localizeUi("mari.composerCommands.attachMenu.chatHistoryFact")}
            onClick={() => run(onAddChatHistory)}
          />
          <MariRow
            role="menuitem"
            slot={<Layers aria-hidden="true" />}
            title={localizeUi("ui.chat.homeprofessormarichat.attachMenuViewContext")}
            fact={localizeUi("mari.composerCommands.attachMenu.viewContextFact")}
            badge={attachedContextCount > 0 ? attachedContextCount : undefined}
            onClick={() => run(onViewContext)}
          />
          <hr className="mari-composer-menu__divider" />
          <p className="mari-composer-menu__head">{localizeUi("mari.composerCommands.section.reference")}</p>
          <MariRow
            role="menuitem"
            slot={<AtSign aria-hidden="true" />}
            title={localizeUi("mari.composerCommands.linkWithAt.label")}
            fact={localizeUi("mari.composerCommands.linkWithAt.fact")}
            onClick={() => run(onLinkWithAt)}
          />
          {mariCommands.length > 0 && (
            <>
              <hr className="mari-composer-menu__divider" />
              <p className="mari-composer-menu__head">{localizeUi("mari.composerCommands.section.mari")}</p>
              {mariCommands.map((command) => (
                <MariRow
                  key={command.id}
                  role="menuitem"
                  slot={<command.Icon aria-hidden="true" />}
                  title={localizeUi(command.labelKey)}
                  fact={localizeUi(command.factKey)}
                  badge={commandCounts[command.id] || undefined}
                  onClick={() => run(() => onCommand(command.id))}
                />
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
