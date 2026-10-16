// ──────────────────────────────────────────────
// Chat Variables Editor — the State Editor opened on a chat's `{{name}}`
// variables, for searching and bulk-editing them as one JSON map.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { MAX_CHAT_VARIABLE_VALUE_LENGTH, MAX_CHAT_VARIABLES, type Chat } from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { StateEditor } from "../ui/state-editor/StateEditor";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { trackChatMetadataSave } from "../../lib/chat-metadata-save-barrier";
import {
  buildChatVariablesEditorPatch,
  buildChatVariablesEditorSections,
  readChatVariables,
  type ChatVariablesEditorIssue,
} from "../../lib/state-editor/chat-variables-editor-source";
import type { StateEditorChange } from "../../lib/state-editor/state-editor.types";
import { chatKeys } from "../../hooks/use-chats";

interface ChatVariablesEditorModalProps {
  open: boolean;
  onClose: () => void;
  chatId: string;
}

/** Waits for queued Chat Variables writes, so the editor starts from what the server will hold. */
async function fetchSavedVariables(chatId: string): Promise<Record<string, string>> {
  await trackChatMetadataSave(chatId, async () => undefined);
  const chat = await api.get<Chat>(`/chats/${chatId}`);
  return readChatVariables(chat.metadata);
}

export function ChatVariablesEditorModal({ open, onClose, chatId }: ChatVariablesEditorModalProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["state-editor", "chat-variables", chatId] as const, [chatId]);
  const variablesQuery = useQuery({
    queryKey,
    queryFn: () => fetchSavedVariables(chatId),
    enabled: open && !!chatId,
    staleTime: 0,
    gcTime: 0,
  });
  const dirtyRef = useRef(false);

  const variables = variablesQuery.data;
  const sections = useMemo(
    () =>
      variables
        ? buildChatVariablesEditorSections(variables, (part) =>
            localizeUi(`ui.stateEditor.chatVariables.section.${part}`),
          )
        : [],
    [localizeUi, variables],
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

  const issueMessage = useCallback(
    (issue: ChatVariablesEditorIssue) => {
      switch (issue.kind) {
        case "notObject":
          return localizeUi("ui.stateEditor.chatVariables.errors.notObject");
        case "notString":
          return localizeUi("ui.stateEditor.chatVariables.errors.notString", { name: issue.name });
        case "tooLong":
          return localizeUi("ui.stateEditor.chatVariables.errors.tooLong", {
            name: issue.name,
            max: MAX_CHAT_VARIABLE_VALUE_LENGTH.toLocaleString(),
          });
        case "tooMany":
          return localizeUi("ui.stateEditor.chatVariables.errors.tooMany", { max: MAX_CHAT_VARIABLES });
        case "name":
          return issue.issue === "reserved"
            ? localizeUi("ui.stateEditor.chatVariables.errors.reservedName", { name: issue.name })
            : localizeUi("ui.stateEditor.chatVariables.errors.invalidName", { name: issue.name });
      }
    },
    [localizeUi],
  );

  const save = useCallback(
    async (changes: StateEditorChange[]) => {
      const change = changes[0];
      if (!variables || !change) return;
      // Compare against what the editor opened with, so names a generation set meanwhile are left alone.
      const saved = await fetchSavedVariables(chatId);
      const result = buildChatVariablesEditorPatch(saved, variables, change.value);
      if ("issue" in result) throw new Error(issueMessage(result.issue));
      if (Object.keys(result.patch).length > 0) {
        // Same queue as the Chat Variables section, so neither write can land out of order.
        await trackChatMetadataSave(chatId, () =>
          api.patch<Chat>(`/chats/${chatId}/metadata`, { macroVariables: result.patch }),
        );
      }
      qc.setQueryData(queryKey, await fetchSavedVariables(chatId));
      void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      toast.success(localizeUi("ui.stateEditor.chatVariables.saved"));
    },
    [chatId, issueMessage, localizeUi, qc, queryKey, variables],
  );

  return (
    <Modal
      open={open}
      onClose={() => void requestClose()}
      title={localizeUi("ui.stateEditor.chatVariables.title")}
      width="max-w-4xl"
      mobileFullscreen
      panelClassName="sm:h-[min(85dvh,44rem)]"
      contentClassName="flex flex-col p-0! overflow-hidden!"
    >
      {variablesQuery.isPending ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-16 text-sm text-[var(--muted-foreground)]">
          <Loader2 size="1rem" className="animate-spin" />
          {localizeUi("ui.stateEditor.chatVariables.loading")}
        </div>
      ) : variablesQuery.isError || !variables ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center text-sm text-[var(--muted-foreground)]">
          <AlertTriangle size="1.25rem" className="text-[var(--marinara-app-accent-static)]" />
          {localizeUi("ui.stateEditor.chatVariables.loadFailed")}
          <button
            type="button"
            onClick={() => void variablesQuery.refetch()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--secondary)] px-3 text-xs font-medium text-[var(--foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]"
          >
            <RefreshCw size="0.875rem" />
            {localizeUi("ui.stateEditor.chatVariables.reload")}
          </button>
        </div>
      ) : (
        <StateEditor sections={sections} onSave={save} onDirtyChange={handleDirtyChange} />
      )}
    </Modal>
  );
}
