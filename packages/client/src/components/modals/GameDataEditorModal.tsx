// ──────────────────────────────────────────────
// Game Data Editor — the State Editor opened on a Game Mode chat's own data
// (party cards, NPCs, journal, story, maps, …). Allow-listed sections save
// through PATCH /api/game/:chatId/data, which checks every key; the rest are read-only.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Chat, GameDataEditIssue, GameDataEditRefusal } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { StateEditor } from "../ui/state-editor/StateEditor";
import { api, ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { trackChatMetadataSave } from "../../lib/chat-metadata-save-barrier";
import {
  buildGameDataEditorEdits,
  buildGameDataEditorSections,
  readGameMetadata,
  type GameDataEditorIssue,
} from "../../lib/state-editor/game-data-editor-source";
import type { StateEditorChange } from "../../lib/state-editor/state-editor.types";
import { chatKeys } from "../../hooks/use-chats";

interface GameDataEditorModalProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
}

/** Waits for queued metadata writes, so the editor shows what the server will hold. */
async function fetchGameMetadata(chatId: string): Promise<Record<string, unknown>> {
  await trackChatMetadataSave(chatId, async () => undefined);
  const chat = await api.get<Chat>(`/chats/${chatId}`);
  return readGameMetadata(chat.metadata);
}

/** `2.name` as people count: "#3 › name". */
function readablePath(path: string): string {
  return path
    .split(".")
    .map((part) => (/^\d+$/.test(part) ? `#${Number(part) + 1}` : part))
    .join(" › ");
}

const NOTICE_CLASS =
  "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-[var(--marinara-app-accent-static)]/10 px-3 py-2 text-xs text-[var(--marinara-app-accent-static)] ring-1 ring-[var(--marinara-app-accent-static)]/30";

export function GameDataEditorModal({ open, onClose, chatId }: GameDataEditorModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["state-editor", "game-data", chatId] as const, [chatId]);
  const metadataQuery = useQuery({
    queryKey,
    queryFn: () => fetchGameMetadata(chatId),
    enabled: open && !!chatId,
    staleTime: 0,
    gcTime: 0,
    // The loaded data is the drafts' baseline: only Reload or a save may replace it.
    refetchOnReconnect: false,
  });
  /** Why the editor asks for a Reload: the game changed the data, or a save landed but reading it back failed. */
  const [notice, setNotice] = useState<"stale" | "refreshFailed" | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const dirtyRef = useRef(false);

  const metadata = metadataQuery.data;
  const sections = useMemo(
    () =>
      metadata
        ? buildGameDataEditorSections(metadata, (sectionId, part) =>
            localizeUi(`ui.stateEditor.gameData.sections.${sectionId}.${part}`),
          )
        : [],
    [localizeUi, metadata],
  );

  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const requestClose = useCallback(async () => {
    if (dirtyRef.current) {
      const confirmed = await showConfirmDialog({
        title: localizeUi("ui.stateEditor.discard.title"),
        message: localizeUi("ui.stateEditor.discard.closeMessage"),
        confirmLabel: localizeUi("ui.stateEditor.discard.confirm"),
        cancelLabel: localizeUi("ui.stateEditor.discard.cancel"),
        tone: "destructive",
      });
      if (!confirmed) return;
    }
    onClose();
  }, [localizeUi, onClose]);

  const reload = useCallback(async () => {
    setNotice(null);
    dirtyRef.current = false;
    setEditorKey((key) => key + 1);
    await metadataQuery.refetch();
  }, [metadataQuery]);

  const editorIssueMessage = useCallback(
    (sectionId: string, issue: GameDataEditorIssue) => {
      const section = sections.find((item) => item.id === sectionId)?.label ?? sectionId;
      switch (issue.kind) {
        case "notObject":
          return localizeUi("ui.stateEditor.gameData.errors.notObject", { section });
        case "unknownKey":
          return localizeUi("ui.stateEditor.gameData.errors.unknownKey", { section, key: issue.key });
        case "readOnly":
          return localizeUi("ui.stateEditor.gameData.errors.readOnly", { section });
      }
    },
    [localizeUi, sections],
  );

  const serverIssueMessage = useCallback(
    (issue: GameDataEditIssue) => {
      const values = {
        key: localizeUi(`ui.stateEditor.gameData.keys.${issue.key}`),
        path: issue.path ? readablePath(issue.path) : "",
        name: issue.name ?? "",
        max: issue.max?.toLocaleString() ?? "",
      };
      // A shape or length problem at the top of the value has no path to point at.
      const reason =
        (issue.reason === "shape" || issue.reason === "tooLong") && !issue.path ? `${issue.reason}Value` : issue.reason;
      return localizeUi(`ui.stateEditor.gameData.errors.${reason}`, values);
    },
    [localizeUi],
  );

  const save = useCallback(
    async (changes: StateEditorChange[]) => {
      if (!metadata) return;
      const result = buildGameDataEditorEdits(metadata, changes);
      if ("issue" in result) throw new Error(editorIssueMessage(result.sectionId, result.issue));
      if (result.edits.length === 0) return;
      try {
        // Same queue as the game's other metadata writes from this tab, so none lands out of order.
        await trackChatMetadataSave(chatId, () => api.patch(`/game/${chatId}/data`, { edits: result.edits }));
      } catch (error) {
        const refusal = error instanceof ApiError ? (error.payload as Partial<GameDataEditRefusal> | undefined) : null;
        if (!refusal?.issues?.length) throw error;
        if (error instanceof ApiError && error.status === 409) setNotice("stale");
        throw new Error(refusal.issues.map(serverIssueMessage).join(" "));
      }
      // A save that landed answers any earlier stale refusal; a failed read-back below sets its own notice.
      setNotice(null);
      void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      toast.success(localizeUi("ui.stateEditor.gameData.saved"));
      // The save landed: a failed read-back must not report it as failed (and keep drafts already saved).
      try {
        qc.setQueryData(queryKey, await fetchGameMetadata(chatId));
      } catch {
        setNotice("refreshFailed");
      }
    },
    [chatId, editorIssueMessage, localizeUi, metadata, qc, queryKey, serverIssueMessage],
  );

  return (
    <Modal
      open={open}
      onClose={() => void requestClose()}
      title={localizeUi("ui.stateEditor.gameData.title")}
      width="max-w-4xl"
      mobileFullscreen
      panelClassName="sm:h-[min(85dvh,44rem)]"
      contentClassName="flex flex-col p-0! overflow-hidden!"
    >
      {metadataQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-[var(--muted-foreground)]">
          <Loader2 size="1rem" className="animate-spin" />
          {localizeUi("ui.stateEditor.gameData.loading")}
        </div>
      ) : metadataQuery.isError || !metadata ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-[var(--muted-foreground)]">
          <AlertTriangle size="1.25rem" className="text-[var(--marinara-app-accent-static)]" />
          {localizeUi("ui.stateEditor.gameData.loadFailed")}
          <button
            type="button"
            onClick={() => void reload()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
          >
            <RefreshCw size="0.875rem" />
            {localizeUi("ui.stateEditor.gameData.reload")}
          </button>
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-[var(--muted-foreground)]">
          {localizeUi("ui.stateEditor.gameData.empty")}
        </div>
      ) : (
        <StateEditor
          key={editorKey}
          sections={sections}
          onSave={save}
          onDirtyChange={handleDirtyChange}
          notice={
            <div className="flex flex-col gap-2">
              <div role="note" className={NOTICE_CLASS}>
                <AlertTriangle size="0.875rem" className="shrink-0" />
                <span className="min-w-0 flex-1">{localizeUi("ui.stateEditor.gameData.warning")}</span>
              </div>
              {notice ? (
                <div role="alert" className={NOTICE_CLASS}>
                  <AlertTriangle size="0.875rem" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    {localizeUi(
                      notice === "stale"
                        ? "ui.stateEditor.gameData.staleNotice"
                        : "ui.stateEditor.gameData.refreshFailedNotice",
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => void reload()}
                    className="inline-flex min-h-8 items-center gap-1 rounded-md bg-[var(--secondary)] px-2.5 font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
                  >
                    <RefreshCw size="0.75rem" />
                    {localizeUi("ui.stateEditor.gameData.reload")}
                  </button>
                </div>
              ) : null}
            </div>
          }
        />
      )}
    </Modal>
  );
}
