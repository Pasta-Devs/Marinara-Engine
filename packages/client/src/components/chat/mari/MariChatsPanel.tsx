import { Plus, Loader2, Check, Square, EllipsisVertical, Pencil, Trash2 } from "lucide-react";
import type { Dispatch, KeyboardEvent, RefObject, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { readMariThread } from "../../../lib/mari-arrival";
import { ProfessorMariWorkspaceDestination } from "../../../lib/professor-mari-workspace-navigation";
import { formatRelativeContact } from "../../../lib/relative-time";
import { MariPanelSortMode } from "../../../stores/ui.store";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";
import { MariSidePanelHeader, MariSideSearch, MariPanelSortSelect } from "../MariPanelControls";
import { ProfessorMariChatSummary, isProfessorMariChatActive } from "./mari-chat-helpers";

/** The Chats side panel: her past conversations, with search, sort, rename, delete and bulk delete. */
type MariChatsPanelProps = {
  chatHistory: ProfessorMariChatSummary[];
  chatHistoryLoading: boolean;
  chatHistoryQuery: string;
  chatHistorySelectionMode: boolean;
  chatHistorySortMode: MariPanelSortMode;
  chatId: string | null;
  chatRowMenuId: string | null;
  chatRowMenuRef: RefObject<HTMLDivElement | null>;
  chatRowPopoverRef: RefObject<HTMLDivElement | null>;
  displayedChatHistory: ProfessorMariChatSummary[];
  handleBulkDeleteProfessorChats: () => Promise<void>;
  handleDeleteProfessorChat: (id: string) => Promise<void>;
  handleRenameProfessorChat: (id: string) => Promise<void>;
  handleSelectProfessorChat: (id: string) => Promise<boolean>;
  isBusy: boolean;
  onChatRowMenuKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  renameDraft: string;
  renamingChatId: string | null;
  runRestart: () => Promise<void>;
  selectedChatHistoryIds: Set<string>;
  setChatHistoryQuery: Dispatch<SetStateAction<string>>;
  setChatHistorySelectionMode: Dispatch<SetStateAction<boolean>>;
  setChatHistorySortMode: (mode: MariPanelSortMode) => void;
  setChatRowMenuId: Dispatch<SetStateAction<string | null>>;
  setRenameDraft: Dispatch<SetStateAction<string>>;
  setRenamingChatId: Dispatch<SetStateAction<string | null>>;
  setSelectedChatHistoryIds: Dispatch<SetStateAction<Set<string>>>;
  setWorkspaceDestination: Dispatch<SetStateAction<ProfessorMariWorkspaceDestination>>;
  toggleProfessorChatSelection: (id: string) => void;
};

export function MariChatsPanel({
  chatHistory,
  chatHistoryLoading,
  chatHistoryQuery,
  chatHistorySelectionMode,
  chatHistorySortMode,
  chatId,
  chatRowMenuId,
  chatRowMenuRef,
  chatRowPopoverRef,
  displayedChatHistory,
  handleBulkDeleteProfessorChats,
  handleDeleteProfessorChat,
  handleRenameProfessorChat,
  handleSelectProfessorChat,
  isBusy,
  onChatRowMenuKeyDown,
  renameDraft,
  renamingChatId,
  runRestart,
  selectedChatHistoryIds,
  setChatHistoryQuery,
  setChatHistorySelectionMode,
  setChatHistorySortMode,
  setChatRowMenuId,
  setRenameDraft,
  setRenamingChatId,
  setSelectedChatHistoryIds,
  setWorkspaceDestination,
  toggleProfessorChatSelection,
}: MariChatsPanelProps) {
  const { t: localizeUi } = useTranslation();
  const { t } = useTranslation();
  return (
    <>
      <MariSidePanelHeader
        title={t("home.professorMari.chats")}
        onClose={() => setWorkspaceDestination("chat")}
        closeLabel={t("home.professorMari.closeChats")}
        actions={
          <>
            {/* #5752: the affordance people hunt for lives where they look for it. */}
            <button
              type="button"
              onClick={() => {
                setWorkspaceDestination("chat");
                void runRestart();
              }}
              disabled={isBusy}
              className="mari-link"
              title={t("home.professorMari.newChat")}
            >
              <Plus size="0.8rem" aria-hidden="true" />
              {localizeUi("ui.chat.homeprofessormarichat.newChat")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (chatHistorySelectionMode) {
                  setChatHistorySelectionMode(false);
                  setSelectedChatHistoryIds(new Set());
                } else {
                  setChatHistorySelectionMode(true);
                }
              }}
              disabled={chatHistory.length === 0 || chatHistoryLoading}
              className="mari-link"
              aria-pressed={chatHistorySelectionMode}
            >
              {localizeUi(
                chatHistorySelectionMode
                  ? "ui.chat.homeprofessormarichat.cancelSelection"
                  : "ui.chat.homeprofessormarichat.selectChats",
              )}
            </button>
          </>
        }
      />
      {chatHistory.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
          <MariSideSearch
            value={chatHistoryQuery}
            onChange={setChatHistoryQuery}
            label={localizeUi("ui.chat.homeprofessormarichat.searchChats")}
          />
          <MariPanelSortSelect value={chatHistorySortMode} onChange={setChatHistorySortMode} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {chatHistoryLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted-foreground)]">
            <Loader2 size="0.875rem" className="mr-2 animate-spin" />
            {localizeUi("ui.chat.homeprofessormarichat.loadingChats")}
          </div>
        ) : (
          <div className="mari-list mari-edit--menus" data-cards="chats">
            {chatHistory.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                {t("home.professorMari.noPreviousChats")}{" "}
                {localizeUi("ui.chat.homeprofessormarichat.newChatSavesTheCurrentChatHere")}
              </p>
            ) : displayedChatHistory.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
                {localizeUi("ui.chat.homeprofessormarichat.noMatchingChats")}
              </p>
            ) : (
              displayedChatHistory.map((item) => {
                const active = item.id === chatId || isProfessorMariChatActive(item);
                const renaming = renamingChatId === item.id;
                const selected = selectedChatHistoryIds.has(item.id);
                const menuOpen = chatRowMenuId === item.id;
                const name = item.name || localizeUi("ui.chat.homeprofessormarichat.unnamedChat");
                const thread = readMariThread(item);
                return (
                  <div key={item.id} data-professor-mari-chat-id={item.id} className="mari-list__item">
                    <div className="mari-row" aria-current={active ? "true" : undefined}>
                      {renaming ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-1.5 py-1"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleRenameProfessorChat(item.id);
                          }}
                        >
                          <input
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            aria-label={localizeUi("ui.chat.homeprofessormarichat.renameChatInput")}
                            className="min-w-0 flex-1 rounded-md bg-[var(--background)] px-2 py-1.5 text-xs outline-none ring-1 ring-[var(--mari-hairline)] focus:ring-[var(--primary)]"
                            autoFocus
                          />
                          <button type="submit" className="mari-btn mari-btn--solid">
                            {localizeUi("ui.noodle.noodlehome.save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingChatId(null);
                              setRenameDraft("");
                            }}
                            className="mari-link"
                          >
                            {localizeUi("chat.delete.dialog.cancel")}
                          </button>
                        </form>
                      ) : (
                        <>
                          {chatHistorySelectionMode && (
                            <span className="shrink-0 text-[var(--primary)]" aria-hidden="true">
                              {selected ? <Check size="0.875rem" /> : <Square size="0.875rem" />}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              chatHistorySelectionMode
                                ? toggleProfessorChatSelection(item.id)
                                : void handleSelectProfessorChat(item.id)
                            }
                            disabled={isBusy}
                            aria-pressed={chatHistorySelectionMode ? selected : undefined}
                            className="mari-row__toggle disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {/* Q6 / R10: the slot says it is a Mari chat; the fact says what it is about. */}
                            <span className="mari-row__slot" aria-hidden="true">
                              <ResultTypeIcon type="mari-chat" glyph />
                            </span>
                            <span className="mari-row__text">
                              <span className="mari-row__title">
                                <span>{name}</span>
                              </span>
                              <span className="mari-row__fact">
                                {[
                                  // R7: what the thread is about ("Zylo's chat · 2 days ago · 4 messages").
                                  thread.contextLabel || localizeUi("ui.chat.homeprofessormarichat.generalThread"),
                                  formatRelativeContact(item.lastMessageAt ?? item.updatedAt),
                                  localizeUi("ui.chat.homeprofessormarichat.messageCount", {
                                    count: item.messageCount ?? 0,
                                  }),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                          </button>
                          {!chatHistorySelectionMode && (
                            <div
                              ref={menuOpen ? chatRowMenuRef : undefined}
                              className="mari-row__more relative"
                              data-open={menuOpen ? "true" : undefined}
                            >
                              <button
                                type="button"
                                onClick={() => setChatRowMenuId(menuOpen ? null : item.id)}
                                className="mari-omnibar-header-menu__trigger"
                                aria-expanded={menuOpen}
                                aria-label={localizeUi("ui.chat.homeprofessormarichat.chatRowActions", {
                                  name,
                                })}
                              >
                                <EllipsisVertical size="0.9rem" aria-hidden="true" />
                              </button>
                              {menuOpen ? (
                                <div
                                  ref={chatRowPopoverRef}
                                  className="mari-omnibar-header-menu__popover"
                                  onKeyDown={onChatRowMenuKeyDown}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setChatRowMenuId(null);
                                      setRenamingChatId(item.id);
                                      setRenameDraft(item.name || "");
                                    }}
                                  >
                                    <Pencil size="0.875rem" aria-hidden="true" />
                                    <span>{localizeUi("ui.chat.homeprofessormarichat.renameChat")}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setChatRowMenuId(null);
                                      void handleDeleteProfessorChat(item.id);
                                    }}
                                  >
                                    <Trash2 size="0.875rem" aria-hidden="true" />
                                    <span>{localizeUi("lorebook.editor.batch.delete")}</span>
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      {chatHistorySelectionMode && (
        <div className="flex items-center gap-2 border-t border-[var(--mari-hairline)] px-3 py-2">
          <span className="min-w-0 flex-1 text-xs text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.homeprofessormarichat.selectedChats", {
              count: selectedChatHistoryIds.size,
            })}
          </span>
          <button
            type="button"
            onClick={() => void handleBulkDeleteProfessorChats()}
            disabled={selectedChatHistoryIds.size === 0}
            className="mari-btn mari-btn--danger"
          >
            <Trash2 size="0.75rem" aria-hidden="true" />
            {localizeUi("ui.chat.homeprofessormarichat.deleteSelectedChats")}
          </button>
        </div>
      )}
    </>
  );
}
