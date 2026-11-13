import {
  type ExportEnvelope,
  type ChatMemoryRecallExportPayload,
  type ChatMemoryChunk,
  estimateTextTokens,
} from "@marinara-engine/shared";
import { isRecord } from "./lib/is-record";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  useChatMemories,
  useDeleteChatMemory,
  useClearChatMemories,
  useRefreshChatMemories,
  useExportChatMemories,
  useImportChatMemories,
} from "../../hooks/use-chats";
import { useRef, useMemo } from "react";
import { toast } from "sonner";
import { EXPORT_FAILED_TOAST_ID } from "../../lib/file-download";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Modal } from "../../components/ui/Modal";
import { Upload, Download, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatMemoryDate } from "./lib/memory-format";

function isMemoryRecallExportEnvelope(value: unknown): value is ExportEnvelope<ChatMemoryRecallExportPayload> {
  if (!isRecord(value) || value.type !== "marinara_memory_recall" || value.version !== 1) return false;
  const data = value.data;
  return isRecord(data) && Array.isArray(data.chunks);
}

function estimateMemoryTokens(memories: ChatMemoryChunk[]): number {
  const text = memories.map((memory) => memory.content).join("\n\n");
  return estimateTextTokens(text);
}

function formatMemoryChunkCount(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "memory chunk" : "memory chunks"}`;
}

const MEMORY_CONTENT_CLASS =
  "max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--secondary)]/50 px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--foreground)]";

const MAX_MEMORY_RECALL_IMPORT_FILE_BYTES = 25 * 1024 * 1024;

const MAX_MEMORY_RECALL_IMPORT_FILE_LABEL = "25 MB";

export function MemoryRecallMemoriesModal({
  chatId,
  open,
  onClose,
  chatFloatingPanel = false,
}: {
  chatId: string;
  open: boolean;
  onClose: () => void;
  chatFloatingPanel?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const memoriesQuery = useChatMemories(chatId, open);
  const deleteMemory = useDeleteChatMemory(chatId);
  const clearMemories = useClearChatMemories(chatId);
  const refreshMemories = useRefreshChatMemories(chatId);
  const exportMemories = useExportChatMemories(chatId);
  const importMemories = useImportChatMemories(chatId);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const memories = useMemo(() => memoriesQuery.data ?? [], [memoriesQuery.data]);
  const totalTokens = useMemo(() => estimateMemoryTokens(memories), [memories]);

  const handleExport = async () => {
    if (memories.length === 0) {
      toast.error(localizeUi("ui.chat.memoryrecallmemoriesmodal.thereAreNoRecallMemoriesToExportYet"));
      return;
    }

    try {
      const saveStatus = await exportMemories.mutateAsync();
      if (saveStatus === "saved") toast.success(localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryRecallExported"));
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.exportFailedValue1", { value1: err.message })
          : localizeUi("ui.chat.memoryrecallmemoriesmodal.exportFailed"),
        { id: EXPORT_FAILED_TOAST_ID },
      );
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MEMORY_RECALL_IMPORT_FILE_BYTES) {
      toast.error(
        localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryRecallImportFilesMustBeValue1OrSmaller", {
          value1: MAX_MEMORY_RECALL_IMPORT_FILE_LABEL,
        }),
      );
      event.target.value = "";
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isMemoryRecallExportEnvelope(parsed)) {
        toast.error(localizeUi("ui.chat.memoryrecallmemoriesmodal.chooseAMemoryRecallExportFile"));
        return;
      }

      const result = await importMemories.mutateAsync({ envelope: parsed });
      if (result.imported > 0) {
        toast.success(
          localizeUi("ui.chat.memoryrecallmemoriesmodal.importedValue1", {
            value1: formatMemoryChunkCount(result.imported),
          }),
        );
      } else {
        toast.info(localizeUi("ui.chat.memoryrecallmemoriesmodal.noNewRecallMemoriesWereImported"));
      }
    } catch (err) {
      toast.error(
        err instanceof Error
          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.importFailedValue1", { value1: err.message })
          : localizeUi("chat.branches.importFailed"),
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleDelete = async (memory: ChatMemoryChunk) => {
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.memoryrecallmemoriesmodal.forgetMemory"),
      message: localizeUi("ui.chat.memoryrecallmemoriesmodal.removeThisRecallMemoryFromThisChat"),
      confirmLabel: localizeUi("ui.chat.memoryrecallmemoriesmodal.forget"),
      tone: "destructive",
    });
    if (ok) deleteMemory.mutate(memory.id);
  };

  const handleClear = async () => {
    if (memories.length === 0) return;
    const ok = await showConfirmDialog({
      title: localizeUi("ui.chat.memoryrecallmemoriesmodal.clearMemories"),
      message: localizeUi("ui.chat.memoryrecallmemoriesmodal.removeAllRecallMemoriesForThisChatThisDoes"),
      confirmLabel: localizeUi("lorebook.editor.batch.clear"),
      tone: "destructive",
    });
    if (ok) clearMemories.mutate();
  };

  const handleRevectorize = async () => {
    if (memories.length > 0) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemories"),
        message: localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemoriesDescription"),
        confirmLabel: localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAll"),
        tone: "default",
      });
      if (!confirmed) return;
    }

    try {
      const result = await refreshMemories.mutateAsync();
      toast.success(
        localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizedValue1MemoryChunks", {
          value1: result.rebuilt,
        }),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizationFailedValue1", { value1: error.message })
          : localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizationFailed"),
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={localizeUi("ui.chat.memoryrecallmemoriesmodal.memoriesForThisChat")}
      width="max-w-3xl"
      chatFloatingPanel={chatFloatingPanel}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--secondary)]/70 px-3 py-2 ring-1 ring-[var(--border)]">
          <div className="text-[0.6875rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
            <span className="font-semibold text-[var(--foreground)]">{memories.length}</span>{" "}
            {memories.length === 1
              ? localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryChunk")
              : localizeUi("ui.chat.memoryrecallmemoriesmodal.memoryChunks")}
            {memories.length > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="tabular-nums">
                  ~{totalTokens.toLocaleString()} {localizeUi("ui.agents.agenteditor.tokens")}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.marinara"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={memories.length === 0 || exportMemories.isPending}
              className="max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.exportMemories")}
              aria-label={localizeUi("ui.chat.memoryrecallmemoriesmodal.exportMemories")}
            >
              <Upload size="0.8125rem" />
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              disabled={importMemories.isPending}
              className="max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-40"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.importMemories")}
              aria-label={localizeUi("ui.chat.memoryrecallmemoriesmodal.importMemories")}
            >
              <Download size="0.8125rem" />
            </button>
            <button
              type="button"
              onClick={() => void handleRevectorize()}
              disabled={memoriesQuery.isFetching || refreshMemories.isPending || importMemories.isPending}
              className="max-sm:min-h-11 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-2 py-1.5 text-[0.625rem] max-sm:text-[13px] font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)]/80 disabled:opacity-50"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemoriesDescription")}
              aria-label={localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAllMemories")}
            >
              <RefreshCw
                size="0.8125rem"
                className={cn((memoriesQuery.isFetching || refreshMemories.isPending) && "animate-spin")}
              />
              <span>{localizeUi("ui.chat.memoryrecallmemoriesmodal.reVectorizeAll")}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={memories.length === 0 || clearMemories.isPending}
              className="max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
              title={localizeUi("ui.chat.memoryrecallmemoriesmodal.clearAllMemories")}
            >
              <Trash2 size="0.8125rem" />
            </button>
          </div>
        </div>

        {memoriesQuery.isLoading && (
          <div className="rounded-xl bg-[var(--secondary)]/60 px-4 py-8 text-center text-xs max-sm:text-[13px] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.memoryrecallmemoriesmodal.loadingMemories")}
          </div>
        )}

        {memoriesQuery.error && (
          <div className="rounded-xl bg-[var(--destructive)]/10 px-4 py-3 text-xs max-sm:text-[13px] text-[var(--destructive)] ring-1 ring-[var(--destructive)]/25">
            {localizeUi("ui.chat.memoryrecallmemoriesmodal.failedToLoadMemories")}
          </div>
        )}

        {!memoriesQuery.isLoading && !memoriesQuery.error && memories.length === 0 && (
          <div className="rounded-xl bg-[var(--secondary)]/60 px-4 py-8 text-center text-xs max-sm:text-[13px] text-[var(--muted-foreground)]">
            {localizeUi("ui.chat.memoryrecallmemoriesmodal.noRecallMemoriesHaveBeenCreatedForThisChat")}
          </div>
        )}

        {memories.length > 0 && (
          <div className="space-y-2">
            {memories.map((memory) => (
              <article key={memory.id} className="rounded-xl bg-[var(--card)] px-3 py-3 ring-1 ring-[var(--border)]">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 text-[0.625rem] max-sm:text-[13px] text-[var(--muted-foreground)]">
                    <div className="font-medium text-[var(--foreground)]">
                      {formatMemoryDate(memory.firstMessageAt)} - {formatMemoryDate(memory.lastMessageAt)}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
                      <span>
                        {memory.messageCount} {localizeUi("ui.agents.agenteditor.messages")}
                      </span>
                      <span>
                        {memory.hasEmbedding
                          ? localizeUi("ui.chat.memoryrecallmemoriesmodal.vectorized")
                          : memory.embeddingStatus === "unavailable"
                            ? localizeUi("ui.chat.memoryrecallmemoriesmodal.embeddingUnavailable")
                            : localizeUi("ui.chat.memoryrecallmemoriesmodal.waitingForVector")}
                      </span>
                      <span>
                        {localizeUi("ui.chat.memoryrecallmemoriesmodal.created")} {formatMemoryDate(memory.createdAt)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(memory)}
                    disabled={deleteMemory.isPending}
                    className="max-sm:inline-flex max-sm:min-h-11 max-sm:min-w-11 max-sm:items-center max-sm:justify-center shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)] disabled:opacity-40"
                    title={localizeUi("ui.chat.memoryrecallmemoriesmodal.forgetThisMemory")}
                  >
                    <Trash2 size="0.75rem" />
                  </button>
                </div>
                <pre className={MEMORY_CONTENT_CLASS}>{memory.content}</pre>
              </article>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
