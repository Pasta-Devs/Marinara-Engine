import { Download, FileUp, GripVertical, Minus, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { characterLabel } from "../lib/state";
import type { BranchMode, NoteScope, NotepadContext, NotepadTab } from "../types";
import { NotepadBrand } from "./NotepadChrome";

export function NotepadHeader({
  actionsMenuOpen,
  activeTab,
  addMenuOpen,
  characterIds,
  context,
  hasBranchWideTabOption,
  onAddTab,
  onExportBackup,
  onImportBackup,
  onMinimize,
  onRequestDeleteTab,
  onResetLayout,
  onStartDrag,
  onToggleActionsMenu,
  onToggleAddMenu,
}: {
  actionsMenuOpen: boolean;
  activeTab: NotepadTab | null;
  addMenuOpen: boolean;
  characterIds: string[];
  context: NotepadContext;
  hasBranchWideTabOption: boolean;
  onAddTab: (scope: NoteScope, branchMode?: BranchMode, characterId?: string | null) => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onMinimize: () => void;
  onRequestDeleteTab: () => void;
  onResetLayout: () => void;
  onStartDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  onToggleActionsMenu: () => void;
  onToggleAddMenu: () => void;
}) {
  return (
    <header className="me-notes-header" onPointerDown={onStartDrag}>
      <button
        type="button"
        aria-label="Minimize notes"
        title="Minimize notes"
        onClick={onMinimize}
        className="me-notes-header-action"
      >
        <Minus size="0.875rem" />
      </button>
      <GripVertical className="shrink-0 text-[var(--muted-foreground)] max-sm:hidden" size="0.875rem" />
      <div className="min-w-0 flex-1">
        <NotepadBrand heading />
      </div>

      <div className="relative" data-notepad-menu>
        <button
          type="button"
          aria-label="Notepad options"
          title="Notepad options"
          onClick={(event) => {
            event.stopPropagation();
            onToggleActionsMenu();
          }}
          className="me-notes-header-action"
        >
          <MoreHorizontal size="0.95rem" />
        </button>
        {actionsMenuOpen && (
          <div className="me-notes-menu-popover me-notes-menu-popover--actions">
            <button type="button" className="me-notes-menu-item" onClick={onImportBackup}>
              <FileUp size="0.8125rem" />
              Import backup
            </button>
            <button type="button" className="me-notes-menu-item" onClick={onExportBackup}>
              <Download size="0.8125rem" />
              Export backup
            </button>
            <button type="button" className="me-notes-menu-item" onClick={onResetLayout}>
              <RotateCcw size="0.8125rem" />
              Reset layout
            </button>
            <button
              type="button"
              disabled={!activeTab}
              className="me-notes-menu-item me-notes-menu-item--danger"
              onClick={onRequestDeleteTab}
            >
              <Trash2 size="0.8125rem" />
              Delete tab
            </button>
          </div>
        )}
      </div>

      <div className="relative" data-notepad-menu>
        <button
          type="button"
          aria-label="Add notepad tab"
          title="Add notepad tab"
          onClick={(event) => {
            event.stopPropagation();
            onToggleAddMenu();
          }}
          className="me-notes-primary-action"
        >
          <Plus size="1rem" />
        </button>
        {addMenuOpen && (
          <div className="me-notes-menu-popover me-notes-menu-popover--tabs">
            <button type="button" className="me-notes-menu-item" onClick={() => onAddTab("global")}>
              Global
            </button>
            {characterIds.length === 0 ? (
              <button type="button" className="me-notes-menu-item" onClick={() => onAddTab("character")}>
                Character
              </button>
            ) : (
              characterIds.map((characterId) => (
                <button
                  key={characterId}
                  type="button"
                  className="me-notes-menu-item truncate"
                  onClick={() => onAddTab("character", "branch", characterId)}
                >
                  {characterLabel(context, characterId)}
                </button>
              ))
            )}
            <button type="button" className="me-notes-menu-item" onClick={() => onAddTab("chat", "branch")}>
              Chat
            </button>
            {hasBranchWideTabOption && (
              <button type="button" className="me-notes-menu-item" onClick={() => onAddTab("chat", "family")}>
                Branch-wide
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
