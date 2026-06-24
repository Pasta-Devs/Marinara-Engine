import { useEffect, useState } from "react";
import { BookOpen, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { LIMITS, type Lorebook } from "@marinara-engine/shared";
import { isLorebookScopeActiveForChat } from "../../../lib/lorebook-scope";
import { HelpTooltip } from "../../../components/ui/HelpTooltip";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { PickerDropdown } from "../PickerDropdown";

type LorebookActiveReason = "Global" | "Character" | "Persona" | "Chat";

export type ActiveLorebookView = Lorebook & {
  activeReasons: LorebookActiveReason[];
  isPinned: boolean;
  /** User disabled this auto-activated book for the chat (in excludedLorebookIds). */
  isExcluded: boolean;
};

interface LorebooksSectionProps {
  chatId: string;
  activeLorebooks: ActiveLorebookView[];
  lorebooks: Lorebook[];
  lorebookSearch: string;
  lorebookTokenBudget: number;
  showLorebookPicker: boolean;
  onLorebookSearchChange: (value: string) => void;
  onLorebookTokenBudgetChange: (value: number) => void;
  onShowLorebookPickerChange: (show: boolean) => void;
  onToggleLorebook: (lorebookId: string) => void;
  onSetLorebookExcluded: (lorebookId: string, excluded: boolean) => void;
}

export function LorebooksSection({
  chatId,
  activeLorebooks,
  lorebooks,
  lorebookSearch,
  lorebookTokenBudget,
  showLorebookPicker,
  onLorebookSearchChange,
  onLorebookTokenBudgetChange,
  onShowLorebookPickerChange,
  onToggleLorebook,
  onSetLorebookExcluded,
}: LorebooksSectionProps) {
  const [tokenBudgetDraft, setTokenBudgetDraft] = useState(String(lorebookTokenBudget));
  const activeLorebookIdSet = new Set(activeLorebooks.map((lorebook) => lorebook.id));
  const inactiveLorebooks = lorebooks
    .filter((lorebook) => isLorebookScopeActiveForChat(lorebook.scope, chatId))
    .filter((lorebook) => !activeLorebookIdSet.has(lorebook.id));
  const visibleInactiveLorebooks = inactiveLorebooks.filter((lorebook) =>
    lorebook.name.toLowerCase().includes(lorebookSearch.toLowerCase()),
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
      label="Lorebooks"
      icon={<BookOpen size="0.875rem" />}
      count={activeLorebooks.length}
      help="Lorebooks contain world info, character backstories, and lore that gets injected into the AI's context when relevant keywords appear."
    >
      <div className="mb-2 rounded-lg bg-[var(--secondary)]/70 p-3 ring-1 ring-[var(--border)]">
        <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
          Lorebook Token Budget{" "}
          <HelpTooltip
            text={`Context cap for activated lorebook retrievals in this chat. Default: ${LIMITS.DEFAULT_LOREBOOK_TOKEN_BUDGET}. Set to 0 for unlimited.`}
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
        <p className="text-[0.6875rem] text-[var(--muted-foreground)]">No lorebooks active in this chat.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {activeLorebooks.map((lorebook) => (
            <div
              key={lorebook.id}
              className={
                lorebook.isExcluded
                  ? "flex items-center gap-2.5 rounded-lg bg-[var(--secondary)]/50 px-3 py-2 opacity-60 ring-1 ring-[var(--border)]"
                  : "flex items-center gap-2.5 rounded-lg bg-[var(--primary)]/10 px-3 py-2 ring-1 ring-[var(--primary)]/30"
              }
            >
              <BookOpen
                size="0.875rem"
                className={lorebook.isExcluded ? "text-[var(--muted-foreground)]" : "text-[var(--primary)]"}
              />
              <div className="min-w-0 flex-1">
                <span className={lorebook.isExcluded ? "block truncate text-xs line-through" : "block truncate text-xs"}>
                  {lorebook.name}
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {lorebook.isExcluded ? (
                    <span className="rounded-full bg-[var(--background)]/70 px-1.5 py-0.5 text-[0.5625rem] font-medium text-[var(--muted-foreground)] ring-1 ring-[var(--border)]">
                      Disabled
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
              {lorebook.isExcluded ? (
                <button
                  onClick={() => onSetLorebookExcluded(lorebook.id, false)}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--primary)]/15 hover:text-[var(--primary)]"
                  title="Enable in this chat"
                >
                  <Eye size="0.6875rem" />
                </button>
              ) : lorebook.isPinned ? (
                <button
                  onClick={() => onToggleLorebook(lorebook.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                  title="Remove from chat"
                >
                  <Trash2 size="0.6875rem" />
                </button>
              ) : (
                <button
                  onClick={() => onSetLorebookExcluded(lorebook.id, true)}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                  title="Disable in this chat"
                >
                  <EyeOff size="0.6875rem" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!showLorebookPicker ? (
        <button
          onClick={() => {
            onShowLorebookPickerChange(true);
            onLorebookSearchChange("");
          }}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
        >
          <Plus size="0.75rem" /> Add Lorebook
        </button>
      ) : (
        <PickerDropdown
          search={lorebookSearch}
          onSearchChange={onLorebookSearchChange}
          onClose={() => onShowLorebookPickerChange(false)}
          placeholder="Search lorebooks…"
        >
          {visibleInactiveLorebooks.map((lorebook) => (
            <button
              key={lorebook.id}
              onClick={() => {
                onToggleLorebook(lorebook.id);
                onShowLorebookPickerChange(false);
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all hover:bg-[var(--accent)]"
            >
              <BookOpen size="0.875rem" className="text-[var(--muted-foreground)]" />
              <span className="flex-1 truncate text-xs">{lorebook.name}</span>
              <Plus size="0.75rem" className="text-[var(--muted-foreground)]" />
            </button>
          ))}
          {visibleInactiveLorebooks.length === 0 && (
            <p className="px-3 py-2 text-[0.6875rem] text-[var(--muted-foreground)]">
              {inactiveLorebooks.length === 0 ? "All available lorebooks are already active here." : "No matches."}
            </p>
          )}
        </PickerDropdown>
      )}
    </ChatSettingsSection>
  );
}
