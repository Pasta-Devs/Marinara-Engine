// ──────────────────────────────────────────────
// Game Data Editor — the State Editor opened on a Game Mode chat's own data
// (party cards, NPCs, journal, story, maps, …). Allow-listed sections save
// through PATCH /api/game/:chatId/data, which checks every key; inventory goes
// through the game's own inventory ops; the rest are read-only.
// ──────────────────────────────────────────────
import { useCallback, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  normalizeGameInventoryStacks,
  type Chat,
  type GameDataEditIssue,
  type GameDataEditRefusal,
  type GameDataEditRequest,
  type GameInventoryOp,
  type GameInventoryStack,
  type HudWidget,
  type GameInventoryOpResult,
} from "@marinara-engine/shared";
import { Modal } from "../ui/Modal";
import { StateEditor } from "../ui/state-editor/StateEditor";
import { api, ApiError } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { trackChatMetadataSave } from "../../lib/chat-metadata-save-barrier";
import { describeGameInventoryRefusal } from "../../lib/game-inventory-refusal";
import {
  buildGameDataEditorEdits,
  buildGameDataEditorSections,
  gameDataSectionRoute,
  readGameDataRouteSection,
  readGameMetadata,
  type GameDataEditorIssue,
} from "../../lib/state-editor/game-data-editor-source";
import {
  buildGameInventoryOps,
  findGameInventoryStacksChangedSince,
  gameInventoryOpsExpected,
  type GameDataInventoryIssue,
  type GameDataInventoryOpLabel,
} from "../../lib/state-editor/game-data-inventory";
import { stateValuesEqual } from "../../lib/state-editor/state-editor-json";
import type { StateEditorChange } from "../../lib/state-editor/state-editor.types";
import { chatKeys } from "../../hooks/use-chats";
import { useUpdateGameWidgets } from "../../hooks/use-game";
import { stalePartySheet, useSavePartySheet } from "../../hooks/use-party-sheet";

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
  const savePartySheet = useSavePartySheet();
  const updateWidgets = useUpdateGameWidgets();
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

  const inventoryIssueMessage = useCallback(
    (issue: GameDataInventoryIssue) => {
      const section = localizeUi("ui.stateEditor.gameData.sections.inventory.label");
      switch (issue.kind) {
        case "notList":
          return localizeUi("ui.stateEditor.gameData.inventory.notList", { section });
        case "notStack":
        case "newStack":
          return localizeUi(`ui.stateEditor.gameData.inventory.${issue.kind}`, { section, number: issue.index + 1 });
        case "unknownStack":
        case "duplicateStack":
          return localizeUi(`ui.stateEditor.gameData.inventory.${issue.kind}`, { section, id: issue.id });
        case "fixed":
          return localizeUi("ui.stateEditor.gameData.inventory.fixed", {
            section,
            name: issue.name,
            field: issue.field,
          });
        case "quantity":
          return localizeUi("ui.stateEditor.gameData.inventory.quantity", { section, name: issue.name });
        case "tooMany":
          return localizeUi("ui.stateEditor.gameData.inventory.tooMany", { section, max: issue.max });
      }
    },
    [localizeUi],
  );

  /**
   * A checkpoint of the game as it is before this save, so the edit can be undone. Taken after the
   * checks (nothing refused is worth a checkpoint) and before any write. A game too new to have a
   * snapshot has no checkpoint to take: that never blocks the save.
   */
  const takeCheckpoint = useCallback(async () => {
    try {
      await api.post("/game/checkpoint", {
        chatId,
        label: localizeUi("ui.stateEditor.gameData.checkpointLabel"),
        triggerType: "state_editor_save",
      });
    } catch {
      // Best effort: the save itself must not depend on it.
    }
  }, [chatId, localizeUi]);

  /** The data route's keys. A refusal throws, so nothing after it is sent. */
  const saveDataEdits = useCallback(
    async (edits: GameDataEditRequest["edits"]) => {
      try {
        // Same queue as the game's other metadata writes from this tab, so none lands out of order.
        await trackChatMetadataSave(chatId, () => api.patch(`/game/${chatId}/data`, { edits }));
      } catch (error) {
        const refusal = error instanceof ApiError ? (error.payload as Partial<GameDataEditRefusal> | undefined) : null;
        if (!refusal?.issues?.length) throw error;
        if (error instanceof ApiError && error.status === 409) setNotice("stale");
        throw new Error(refusal.issues.map(serverIssueMessage).join(" "), { cause: error });
      }
    },
    [chatId, serverIssueMessage],
  );

  /** The inventory ops, applied one by one by the game: what it refused, worded per stack. */
  const saveInventoryOps = useCallback(
    async (ops: GameInventoryOp[], labels: GameDataInventoryOpLabel[], opened: GameInventoryStack[]) => {
      // The touched stacks as opened ride along: the route refuses the ops when one changed since.
      let response: { results: GameInventoryOpResult[] };
      try {
        response = await trackChatMetadataSave(chatId, () =>
          api.post<{ results: GameInventoryOpResult[] }>("/game/inventory", {
            chatId,
            ops,
            expected: gameInventoryOpsExpected(opened, ops),
          }),
        );
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 409) throw error;
        setNotice("stale");
        const ids = new Set((error.payload as { stacks?: string[] } | undefined)?.stacks ?? []);
        const names = opened.filter((stack) => ids.has(stack.id)).map((stack) => stack.nickname || stack.name);
        throw new Error(localizeUi("ui.stateEditor.gameData.inventory.stale", { names: names.join(", ") }), {
          cause: error,
        });
      }
      return response.results.flatMap((outcome, index) => {
        if (outcome.ok) return [];
        const label = labels[index];
        const fallback =
          ops[index]?.op === "add"
            ? "ui.game.gamesurfacecomponent.failedToAddValue1ToInventory"
            : "ui.game.gamesurfacecomponent.failedToChangeValue1";
        return [
          describeGameInventoryRefusal(localizeUi, outcome.reason, label?.name ?? "", fallback, label?.holder ?? ""),
        ];
      });
    },
    [chatId, localizeUi],
  );

  /**
   * One section saved through the game's own route for it, which checks it its own way: the world's
   * edits layer (against the world, its towns and its story), the story script (against the world),
   * the party sheet (on the revision it was opened at) and the HUD widgets.
   */
  const saveRoute = useCallback(
    async (sectionId: string, value: unknown) => {
      const label = sections.find((section) => section.id === sectionId)?.label ?? sectionId;
      try {
        await trackChatMetadataSave(chatId, async () => {
          switch (gameDataSectionRoute(sectionId)) {
            case "world":
              // The layer the editor opened rides along, so a save by another writer meanwhile is refused
              // rather than replaced by this older draft.
              await api.put(`/game/${chatId}/world/edits`, {
                edits: value,
                expected: readGameDataRouteSection(metadata ?? {}, sectionId),
              });
              return;
            case "story":
              // Clearing the section takes the story away; either way the story the editor opened rides along.
              await api.put(`/game/${chatId}/story`, {
                story: value,
                expected: readGameDataRouteSection(metadata ?? {}, sectionId),
              });
              return;
            case "partySheet": {
              const revision = Number(metadata?.gamePartySheetRevision ?? 0);
              await savePartySheet.mutateAsync({ chatId, sheet: value, revision });
              return;
            }
            case "widgets":
              // A typo in the JSON view must not read as "no widgets at all".
              if (!Array.isArray(value)) throw new Error(localizeUi("ui.stateEditor.gameData.widgets.notList"));
              await updateWidgets.mutateAsync({
                chatId,
                widgets: value as HudWidget[],
                expected: readGameDataRouteSection(metadata ?? {}, sectionId),
              });
              return;
          }
        });
      } catch (error) {
        if (stalePartySheet(error) || (error instanceof ApiError && error.status === 409)) {
          setNotice("stale");
          throw new Error(localizeUi("ui.stateEditor.gameData.routeStale", { section: label }), { cause: error });
        }
        const refusal = error instanceof ApiError ? (error.payload as { error?: string } | undefined) : null;
        if (!refusal?.error) throw error;
        throw new Error(localizeUi("ui.stateEditor.gameData.routeRefused", { section: label, error: refusal.error }), {
          cause: error,
        });
      }
    },
    [chatId, localizeUi, metadata, savePartySheet, sections, updateWidgets],
  );

  const save = useCallback(
    async (changes: StateEditorChange[]) => {
      if (!metadata) return;
      const result = buildGameDataEditorEdits(metadata, changes);
      if ("issue" in result) throw new Error(editorIssueMessage(result.sectionId, result.issue));

      // Inventory ops are worked out (and refused) before anything is sent, so a bad edit sends nothing.
      const inventoryChange = changes.find((change) => change.sectionId === "inventory");
      const openedStacks = normalizeGameInventoryStacks(metadata.gameInventory);
      const inventory = inventoryChange ? buildGameInventoryOps(openedStacks, inventoryChange.value) : null;
      if (inventory && "issue" in inventory) throw new Error(inventoryIssueMessage(inventory.issue));
      const ops = inventory?.ops ?? [];
      // Sections saved through their own route (inventory has its ops, above). Checked ones go first.
      const order = ["world", "story", "partySheet", "widgets"] as const;
      const routed = changes
        .filter((change) => change.sectionId !== "inventory" && gameDataSectionRoute(change.sectionId))
        .sort(
          (a, b) =>
            order.indexOf(gameDataSectionRoute(a.sectionId) as (typeof order)[number]) -
            order.indexOf(gameDataSectionRoute(b.sectionId) as (typeof order)[number]),
        );
      if (result.edits.length === 0 && ops.length === 0 && routed.length === 0) return;

      // Only the party sheet's route and the data route check staleness themselves: compare the rest now.
      const unchecked = routed.filter((change) => gameDataSectionRoute(change.sectionId) !== "partySheet");
      if (ops.length > 0 || unchecked.length > 0) {
        const fresh = await fetchGameMetadata(chatId);
        const moved = findGameInventoryStacksChangedSince(
          openedStacks,
          normalizeGameInventoryStacks(fresh.gameInventory),
          ops,
        );
        if (moved.length > 0) {
          setNotice("stale");
          throw new Error(localizeUi("ui.stateEditor.gameData.inventory.stale", { names: moved.join(", ") }));
        }
        const changed = unchecked.find(
          (change) =>
            !stateValuesEqual(
              readGameDataRouteSection(fresh, change.sectionId),
              readGameDataRouteSection(metadata, change.sectionId),
            ),
        );
        if (changed) {
          setNotice("stale");
          const section = sections.find((item) => item.id === changed.sectionId)?.label ?? changed.sectionId;
          throw new Error(localizeUi("ui.stateEditor.gameData.routeStale", { section }));
        }
      }

      await takeCheckpoint();

      // The strictly checked routes first, so a refusal there sends nothing else; inventory last, as it
      // saves what fits.
      let landed = false;
      let refused: string[] = [];
      try {
        for (const change of routed) {
          await saveRoute(change.sectionId, change.value);
          landed = true;
        }
        if (result.edits.length > 0) {
          await saveDataEdits(result.edits);
          landed = true;
        }
        if (inventory && "ops" in inventory && ops.length > 0)
          refused = await saveInventoryOps(ops, inventory.labels, openedStacks);
      } catch (error) {
        if (!landed) throw error;
        // Part of it saved: move the baseline to what's stored, so the saved sections read clean and only
        // the refused one keeps its draft (a retry would otherwise resend saved keys and be refused as stale).
        try {
          qc.setQueryData(queryKey, await fetchGameMetadata(chatId));
        } catch {
          setNotice("refreshFailed");
        }
        void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(localizeUi("ui.stateEditor.gameData.partlySaved", { error: message }), { cause: error });
      }

      // A save that landed answers any earlier stale refusal; a failed read-back below sets its own notice.
      setNotice(null);
      void qc.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
      // What landed is saved; refused inventory ops are listed, and the editor reloads to what the game holds.
      if (refused.length > 0) {
        toast.warning(localizeUi("ui.stateEditor.gameData.inventory.partlySaved"), { description: refused.join(" ") });
      } else {
        toast.success(localizeUi("ui.stateEditor.gameData.saved"));
      }
      // The save landed: a failed read-back must not report it as failed (and keep drafts already saved).
      try {
        qc.setQueryData(queryKey, await fetchGameMetadata(chatId));
      } catch {
        setNotice("refreshFailed");
      }
    },
    [
      chatId,
      editorIssueMessage,
      inventoryIssueMessage,
      localizeUi,
      metadata,
      qc,
      queryKey,
      saveDataEdits,
      saveInventoryOps,
      saveRoute,
      sections,
      takeCheckpoint,
    ],
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
