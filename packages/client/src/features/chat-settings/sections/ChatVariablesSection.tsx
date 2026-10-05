import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Braces, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { MAX_CHAT_VARIABLE_VALUE_LENGTH, type ChatVariableNameIssue } from "@marinara-engine/shared";
import { ChatSettingsSection } from "../ChatSettingsSection";
import { useDrawerContentVisible } from "../../../components/ui/Drawer";
import { chatKeys, useUpdateChatMetadata } from "../../../hooks/use-chats";
import { useUIStore } from "../../../stores/ui.store";
import { useChatStore } from "../../../stores/chat.store";
import { cn } from "../../../lib/utils";
import { showConfirmDialog } from "../../../lib/app-dialogs";
import { trackChatMetadataSave } from "../../../lib/chat-metadata-save-barrier";
import {
  buildCommitPatch,
  buildRemovePatch,
  effectiveSavedName,
  newDraftRow,
  reconcileRows,
  rowNameIssue,
  toRows,
  type VariableRow,
} from "./chat-variables-rows";

interface ChatVariablesSectionProps {
  sectionId: string;
  order: number;
  chatId: string;
  /** The chat's saved macro variables, including any a prompt or lorebook set. */
  variables: Record<string, string>;
}

// Passed through interpolation rather than written into the locale string:
// i18next would read a literal {{char1}} in the copy as a placeholder, and
// scripts/check-locales.mjs would report it as a token translators must keep.
const EXAMPLE_TAG = "{{char1}}";

export function ChatVariablesSection({ sectionId, order, chatId, variables }: ChatVariablesSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const qc = useQueryClient();
  // save() queues the whole mutation so each patch uses the last successful name.
  const updateMeta = useUpdateChatMetadata();
  const expanded = useUIStore((s) => s.chatSettingsExpandedSections[sectionId]);
  const contentVisible = useDrawerContentVisible(sectionId, Boolean(expanded));

  const [rows, setRows] = useState<VariableRow[]>(() => toRows(variables));
  // removeRow waits for an answer; a save that lands meanwhile changes the row it must remove.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [pendingWrites, setPendingWrites] = useState(0);
  const queuedRowsRef = useRef(
    new Map<string, { savedName: string | null; pendingName: string | null; pendingValue: string; count: number }>(),
  );

  // A patch carries only the names it changes, so the cached map is partial
  // until the server answers. Fold saved values in only while nothing is in
  // flight — that is also when a {{setvar}} from a generation shows up.
  // The signature, not the object, is the dependency: an unrelated metadata
  // write hands us an equal map with a new identity.
  const savedSignature = useMemo(() => JSON.stringify(variables), [variables]);
  useEffect(() => {
    if (pendingWrites > 0) return;
    const saved = JSON.parse(savedSignature) as Record<string, string>;
    setRows((current) => reconcileRows(current, saved));
  }, [savedSignature, pendingWrites]);

  // Nothing invalidates the chat after a generation persists a {{setvar}} —
  // that write deliberately leaves updatedAt alone, to keep the chat list from
  // reordering. So refetch on the two moments that matter: when the section is
  // opened, and when a generation for this chat finishes while it is open.
  const wasVisible = useRef(false);
  useEffect(() => {
    if (contentVisible && !wasVisible.current) void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    wasVisible.current = contentVisible;
  }, [contentVisible, chatId, qc]);

  const streaming = useChatStore((s) => s.streamingChatId === chatId);
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (!streaming && wasStreaming.current && contentVisible) {
      void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
    }
    wasStreaming.current = streaming;
  }, [streaming, contentVisible, chatId, qc]);

  // `onSaved` stamps the row's saved snapshot, and runs only once the PATCH has
  // landed: a failed write rolls the cached metadata back, so a row marked
  // saved up front would read as untouched and lose the edit to the next fold.
  const save = useCallback(
    (
      row: VariableRow,
      nextName: string | null,
      buildPatch: (savedName: string | null) => Record<string, string | null> | null,
      onSaved?: () => void,
    ) => {
      const queued = queuedRowsRef.current.get(row.key) ?? {
        savedName: row.savedName,
        pendingName: nextName,
        pendingValue: row.value,
        count: 0,
      };
      queued.pendingName = nextName;
      queued.pendingValue = row.value;
      queued.count += 1;
      queuedRowsRef.current.set(row.key, queued);
      setPendingWrites((count) => count + 1);
      void trackChatMetadataSave(chatId, async () => {
        const patch = buildPatch(queued.savedName);
        if (patch) await updateMeta.mutateAsync({ id: chatId, macroVariables: patch });
        queued.savedName = nextName;
        onSaved?.();
      })
        .catch(() => toast.error(localizeUi("ui.chatSettings.chatvariablessection.couldNotSaveThatVariable")))
        .finally(() => {
          setPendingWrites((count) => count - 1);
          queued.count -= 1;
          if (queued.count === 0) queuedRowsRef.current.delete(row.key);
        });
    },
    [chatId, localizeUi, updateMeta],
  );

  const nameIssue = useCallback((row: VariableRow) => rowNameIssue(row, rows), [rows]);

  const updateRow = (key: string, patch: Partial<VariableRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const commitRow = (key: string) => {
    const row = rows.find((entry) => entry.key === key);
    if (!row) return;
    const name = row.name.trim();
    if (nameIssue(row)) return;
    const queued = queuedRowsRef.current.get(key);
    const previousName = effectiveSavedName(row, queued?.pendingName);
    if (previousName === name && (queued?.pendingValue ?? row.savedValue) === row.value) return;
    // A rename is one patch: drop the name it replaces and write the new one
    // together, so a failure cannot leave both or neither.
    // Show the trimmed name straight away; the row stays dirty until the write
    // lands, so a failure leaves the typed value on screen to retry.
    const savedValue = row.value;
    updateRow(key, { name });
    save(
      row,
      name,
      (savedName) => buildCommitPatch(name, savedValue, savedName),
      () => updateRow(key, { savedName: name, savedValue }),
    );
  };

  const removeRow = async (key: string) => {
    // Ask first, so one stray tap cannot delete a variable. A blank new row has nothing to lose.
    const asked = rows.find((entry) => entry.key === key);
    const name = asked?.name.trim() || asked?.savedName;
    if (
      name &&
      !(await showConfirmDialog({
        title: localizeUi("ui.chatSettings.chatvariablessection.removeVariable"),
        message: localizeUi("ui.chatSettings.chatvariablessection.removeNameFromThisChat", { name }),
        confirmLabel: localizeUi("ui.chatSettings.chatvariablessection.remove"),
        tone: "destructive",
      }))
    )
      return;
    const row = rowsRef.current.find((entry) => entry.key === key);
    setRows((current) => current.filter((entry) => entry.key !== key));
    if (!row) return;
    save(row, null, buildRemovePatch);
  };

  const issueMessage = (issue: ChatVariableNameIssue | null) => {
    if (issue === "reserved") return localizeUi("ui.chatSettings.chatvariablessection.thatNameBelongsToABuiltInMacro");
    if (issue === "duplicate")
      return localizeUi("ui.chatSettings.chatvariablessection.thatNameIsAlreadyUsedInThisChat");
    if (issue === "format")
      return localizeUi("ui.chatSettings.chatvariablessection.useLettersNumbersAndUnderscoresStartingWithA");
    return null;
  };

  return (
    <ChatSettingsSection
      id={sectionId}
      style={{ order }}
      label={localizeUi("ui.chatSettings.chatvariablessection.chatVariables")}
      icon={<Braces size="0.875rem" />}
      count={rows.filter((row) => row.savedName !== null).length}
      help={localizeUi("ui.chatSettings.chatvariablessection.typeTheNameInDoubleBracesInAnyMessageThe", {
        example: EXAMPLE_TAG,
      })}
    >
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="px-1 text-[0.6875rem] leading-relaxed text-[var(--muted-foreground)]">
            {localizeUi("ui.chatSettings.chatvariablessection.noVariablesYetAddOneNamedChar1WithTheValue", {
              example: EXAMPLE_TAG,
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {rows.map((row) => {
              const issue = row.savedName === null && row.name === "" && row.value === "" ? null : nameIssue(row);
              const message = issueMessage(issue);
              return (
                <div key={row.key} data-chat-variable-row={row.savedName ?? ""} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      value={row.name}
                      onChange={(e) => updateRow(row.key, { name: e.target.value })}
                      onBlur={() => commitRow(row.key)}
                      onKeyDown={(e) => e.key === "Enter" && commitRow(row.key)}
                      aria-label={localizeUi("ui.chatSettings.chatvariablessection.variableName")}
                      aria-invalid={issue !== null}
                      placeholder={localizeUi("ui.chatSettings.chatvariablessection.name")}
                      className={cn(
                        "mari-chrome-field min-w-0 basis-1/3 !rounded-md px-3 py-2 text-xs",
                        issue && "ring-1 ring-[var(--destructive)]",
                      )}
                    />
                    <input
                      value={row.value}
                      maxLength={MAX_CHAT_VARIABLE_VALUE_LENGTH}
                      onChange={(e) => updateRow(row.key, { value: e.target.value })}
                      onBlur={() => commitRow(row.key)}
                      onKeyDown={(e) => e.key === "Enter" && commitRow(row.key)}
                      aria-label={localizeUi("ui.chatSettings.chatvariablessection.variableValue")}
                      placeholder={localizeUi("ui.chatSettings.chatvariablessection.value")}
                      className="mari-chrome-field min-w-0 flex-1 !rounded-md px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => void removeRow(row.key)}
                      title={localizeUi("ui.chatSettings.chatvariablessection.removeVariable")}
                      aria-label={localizeUi("ui.chatSettings.chatvariablessection.removeVariable")}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--destructive)]/15 hover:text-[var(--destructive)]"
                    >
                      <Trash2 size="0.6875rem" />
                    </button>
                  </div>
                  {message && <p className="px-1 text-[0.625rem] text-[var(--destructive)]">{message}</p>}
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setRows((current) => [...current, newDraftRow()])}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
        >
          <Plus size="0.75rem" /> {localizeUi("ui.chatSettings.chatvariablessection.addVariable")}
        </button>
        <p className="px-1 text-[0.625rem] leading-relaxed text-[var(--muted-foreground)]">
          {localizeUi("ui.chatSettings.chatvariablessection.aPromptSectionOrLorebookEntryThatSetsA")}
        </p>
      </div>
    </ChatSettingsSection>
  );
}
