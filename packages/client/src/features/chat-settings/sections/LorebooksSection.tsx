import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpen, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation, useTranslation as useUiTranslation } from "react-i18next";
import { LIMITS, type Lorebook } from "@marinara-engine/shared";
import { isLorebookScopeActiveForChat } from "../../../lib/lorebook-scope";
import type { ActiveLorebookView } from "../../../lib/chat-lorebooks";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { LibraryArt, LorebookPickerWindow } from "../../../components/ui/LibraryPickers";

interface LorebooksSectionProps {
  /** Open on arrival (the reply checkup's "Lorebook token budget" link). */
  forceOpen?: boolean;
  chatId: string;
  activeLorebooks: ActiveLorebookView[];
  lorebooks: Lorebook[];
  lorebookTokenBudget: number;
  onLorebookTokenBudgetChange: (value: number) => void;
  onEditLorebook: (lorebookId: string) => void;
  editingLorebookId: string | null;
  inlineLorebookEditor: ReactNode;
  onToggleLorebook: (lorebookId: string) => void;
  /** "Add all" on a folder of the picker: pins every id in one update. */
  onAddLorebooks: (lorebookIds: string[]) => void;
  onSetLorebookExcluded: (lorebookId: string, excluded: boolean) => void;
}

export function LorebooksSection({
  forceOpen,
  chatId,
  activeLorebooks,
  lorebooks,
  lorebookTokenBudget,
  onLorebookTokenBudgetChange,
  onEditLorebook,
  editingLorebookId,
  inlineLorebookEditor,
  onToggleLorebook,
  onAddLorebooks,
  onSetLorebookExcluded,
}: LorebooksSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const { t } = useTranslation();
  const [tokenBudgetDraft, setTokenBudgetDraft] = useState(String(lorebookTokenBudget));
  // The picker lists every lorebook this chat may use; the ones pinned to the chat are checked,
  // like the characters already in it are in the character picker.
  const [pickerOpen, setPickerOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const pickable = useMemo(
    () => lorebooks.filter((lorebook) => isLorebookScopeActiveForChat(lorebook.scope, chatId)),
    [lorebooks, chatId],
  );
  const pinnedIds = useMemo(
    () => activeLorebooks.filter((lorebook) => lorebook.isPinned).map((lorebook) => lorebook.id),
    [activeLorebooks],
  );
  const commitTokenBudget = () => {
    const next = Math.max(0, Math.floor(Number(tokenBudgetDraft) || 0));
    onLorebookTokenBudgetChange(next);
    setTokenBudgetDraft(String(next));
  };

  useEffect(() => {
    setTokenBudgetDraft(String(lorebookTokenBudget));
  }, [lorebookTokenBudget]);

  return (
    <ChatSettingsSection
      id="lorebooks"
      forceOpen={forceOpen}
      label={localizeUi("navigation.topbar.lorebooks")}
      icon={<BookOpen size="0.875rem" />}
      count={activeLorebooks.length}
      help={localizeUi("ui.chatSettings.lorebookssection.lorebooksContainWorldInfoCharacterBackstoriesAndLoreThat")}
    >
      <div className="mb-2 rounded-lg bg-[var(--secondary)]/70 p-3 ring-1 ring-[var(--border)]">
        <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
          {localizeUi("ui.chatSettings.lorebookssection.lorebookTokenBudget")}{" "}
          <HelpTooltip
            text={localizeUi("ui.chatSettings.lorebookssection.contextCapForActivatedLorebookRetrievalsInThisChat", {
              value1: LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET,
            })}
          />
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={tokenBudgetDraft}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (!/^\d*$/.test(nextValue)) return;
            setTokenBudgetDraft(nextValue);
          }}
          onBlur={commitTokenBudget}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="w-full rounded-lg bg-[var(--background)] px-3 py-2 text-xs ring-1 ring-transparent focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      {activeLorebooks.length === 0 ? (
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
          {localizeUi("ui.chatSettings.lorebookssection.noLorebooksActiveInThisChat")}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {activeLorebooks.map((lorebook) => {
            const hasAutomaticReason = lorebook.activeReasons.some((reason) => reason !== "Chat");
            return (
              <Fragment key={lorebook.id}>
                <div
                  className={
                    lorebook.isExcluded
                      ? "flex items-center gap-2.5 rounded-lg bg-[var(--secondary)]/50 px-3 py-2 opacity-60 ring-1 ring-[var(--border)]"
                      : "flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
                  }
                >
                  <LibraryArt
                    src={lorebook.imagePath ?? null}
                    kind="lorebook"
                    className={lorebook.isExcluded ? "h-6 w-6 rounded-md grayscale" : "h-6 w-6 rounded-md"}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={lorebook.isExcluded ? "block truncate text-xs line-through" : "block truncate text-xs"}
                    >
                      {lorebook.name}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {lorebook.isExcluded ? (
                        <span className="rounded-full bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                          {localizeUi("ui.agents.agenteditor.disabled")}
                        </span>
                      ) : (
                        lorebook.activeReasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]"
                          >
                            {reason}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditLorebook(lorebook.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)]"
                    title={t("chat.settings.actions.editLorebookEntries")}
                    aria-label={t("chat.settings.actions.editLorebookEntries")}
                  >
                    <Pencil size="0.6875rem" />
                  </button>
                  {lorebook.isExcluded ? (
                    <button
                      onClick={() => onSetLorebookExcluded(lorebook.id, false)}
                      className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                      title={localizeUi("ui.chatSettings.lorebookssection.enableInThisChat")}
                    >
                      <Eye size="0.6875rem" />
                    </button>
                  ) : (
                    <div className="flex shrink-0 items-center gap-1">
                      {lorebook.isPinned && (
                        <button
                          onClick={() => onToggleLorebook(lorebook.id)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title={localizeUi("ui.chatSettings.functioncallingsection.removeFromChat")}
                        >
                          <Trash2 size="0.6875rem" />
                        </button>
                      )}
                      {(!lorebook.isPinned || hasAutomaticReason) && (
                        <button
                          onClick={() => onSetLorebookExcluded(lorebook.id, true)}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                          title={localizeUi("ui.chatSettings.lorebookssection.disableInThisChat")}
                        >
                          <EyeOff size="0.6875rem" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {editingLorebookId === lorebook.id && inlineLorebookEditor}
              </Fragment>
            );
          })}
        </div>
      )}

      <button
        ref={addButtonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((open) => !open)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
      >
        <Plus size="0.75rem" /> {localizeUi("ui.chatSettings.lorebookssection.addLorebook")}
      </button>
      {pickerOpen && (
        <LorebookPickerWindow
          anchorRef={addButtonRef}
          lorebooks={pickable}
          selectedIds={pinnedIds}
          onToggle={onToggleLorebook}
          onAdd={onAddLorebooks}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </ChatSettingsSection>
  );
}
