import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import {
  includesTextForMatch,
  type Chat,
  type ChatMode,
  type Lorebook,
  type LorebookScope,
  type LorebookScopeMode,
} from "@marinara-engine/shared";
import { useChats } from "../../hooks/use-chats";
import { useEmbedLorebook, useLorebooks, useUpdateLorebook } from "../../hooks/use-lorebooks";
import { DEFAULT_LOREBOOK_SCOPE, normalizeLorebookScope } from "../../lib/lorebook-scope";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui.store";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";

type LorebookOwnerType = "character" | "persona";

interface LorebookAssignmentSectionProps {
  ownerType: LorebookOwnerType;
  ownerId: string | null;
  ownerName: string;
  /** The lorebook currently embedded in the character card (character owners only). */
  embeddedLorebookId?: string | null;
  /** True when the card's single character_book slot is already occupied (may be an unpointered baked book). */
  slotOccupied?: boolean;
  /** Called after a successful embed so the parent editor can patch its local state. */
  onEmbedded?: (result: { lorebookId: string; characterBook: unknown }) => void;
  /** Reports embed/refresh progress so the parent editor can block racing saves. */
  onEmbeddingChange?: (embedding: boolean) => void;
}

interface AssignmentDraft {
  lorebookId: string | null;
  mode: LorebookScopeMode;
  chatIds: string[];
  search: string;
}

const MODE_LABELS: Record<ChatMode, string> = {
  conversation: "Conversation",
  roleplay: "Roleplay",
  game: "Game",
};

function uniqueIds(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function isLorebookAssignedToOwner(lorebook: Lorebook, ownerType: LorebookOwnerType, ownerId: string | null) {
  if (!ownerId) return false;
  if (ownerType === "character") {
    return lorebook.characterIds?.includes(ownerId) || lorebook.characterId === ownerId;
  }
  return lorebook.personaIds?.includes(ownerId) || lorebook.personaId === ownerId;
}

function getOwnerIds(lorebook: Lorebook, ownerType: LorebookOwnerType) {
  return ownerType === "character" ? uniqueIds(lorebook.characterIds ?? []) : uniqueIds(lorebook.personaIds ?? []);
}

function getOwnerLabel(ownerType: LorebookOwnerType, ownerName: string) {
  return ownerName.trim() || (ownerType === "character" ? "this character" : "this persona");
}

function getScopeLabel(scope: LorebookScope, chats: Chat[], ownerType: LorebookOwnerType, ownerName: string) {
  if (scope.mode === "disabled") return "Disabled";
  if (scope.mode === "specific") {
    const count = scope.chatIds.filter((id) => chats.some((chat) => chat.id === id)).length;
    return count === 1 ? "1 chat" : `${count} chats`;
  }
  return `All chats with ${getOwnerLabel(ownerType, ownerName)}`;
}

function matchesOwnerChat(chat: Chat, ownerType: LorebookOwnerType, ownerId: string | null) {
  if (!ownerId) return false;
  if (ownerType === "character") return chat.characterIds.includes(ownerId);
  return chat.personaId === ownerId;
}

export function LorebookAssignmentSection({
  ownerType,
  ownerId,
  ownerName,
  embeddedLorebookId,
  slotOccupied,
  onEmbedded,
  onEmbeddingChange,
}: LorebookAssignmentSectionProps) {
  const { t: localizeUi } = useUiTranslation();
  const openModal = useUIStore((state) => state.openModal);
  const openLorebookDetail = useUIStore((state) => state.openLorebookDetail);
  const { data: lorebooks = [], isLoading } = useLorebooks("character", { includeHidden: true });
  const { data: chats = [] } = useChats();
  const updateLorebook = useUpdateLorebook();
  const embedLorebook = useEmbedLorebook();

  const handleEmbed = async (lorebook: Lorebook) => {
    if (!ownerId) return;
    onEmbeddingChange?.(true);
    try {
      const res = await embedLorebook.mutateAsync({ characterId: ownerId, lorebookId: lorebook.id });
      onEmbedded?.({ lorebookId: lorebook.id, characterBook: res.characterBook });
      toast.success(res.refreshed ?localizeUi("ui.lorebooks.lorebookassignmentsection.refreshedEmbeddedValue1", { value1: lorebook.name }) :localizeUi("ui.lorebooks.lorebookassignmentsection.embeddedValue1IntoTheCard", { value1: lorebook.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.lorebooks.lorebookassignmentsection.failedToEmbedLorebook"));
    } finally {
      onEmbeddingChange?.(false);
    }
  };
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);

  const eligibleChats = useMemo(
    () =>
      (chats as Chat[])
        .filter((chat) => matchesOwnerChat(chat, ownerType, ownerId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [chats, ownerId, ownerType],
  );

  const assignedLorebooks = useMemo(
    () => (lorebooks as Lorebook[]).filter((lorebook) => isLorebookAssignedToOwner(lorebook, ownerType, ownerId)),
    [lorebooks, ownerId, ownerType],
  );

  const filteredLorebooks = useMemo(() => {
    const query = draft?.search ?? "";
    return (lorebooks as Lorebook[]).filter((lorebook) => {
      if (lorebook.hiddenFromLibrary && !isLorebookAssignedToOwner(lorebook, ownerType, ownerId)) return false;
      if (!query) return true;
      return includesTextForMatch(`${lorebook.name} ${lorebook.description ?? ""}`, query);
    });
  }, [draft?.search, lorebooks, ownerId, ownerType]);

  const selectedLorebook = draft?.lorebookId
    ? (lorebooks as Lorebook[]).find((lorebook) => lorebook.id === draft.lorebookId)
    : null;

  const openAssignment = (lorebook?: Lorebook) => {
    const scope = lorebook ? normalizeLorebookScope(lorebook.scope) : DEFAULT_LOREBOOK_SCOPE;
    setDraft({
      lorebookId: lorebook?.id ?? null,
      mode: scope.mode,
      chatIds: scope.chatIds,
      search: "",
    });
  };

  const handleCreateLorebook = () => {
    if (!ownerId) return;
    openModal("create-lorebook", {
      defaultCategory: "character",
      ...(ownerType === "character" ? { characterId: ownerId } : { personaId: ownerId }),
      defaultScope: DEFAULT_LOREBOOK_SCOPE,
    });
  };

  const saveAssignment = async () => {
    if (!draft || !selectedLorebook || !ownerId) return;
    const ownerIds = getOwnerIds(selectedLorebook, ownerType);
    const nextScope: LorebookScope = {
      mode: draft.mode,
      chatIds: draft.mode === "specific" ? uniqueIds(draft.chatIds) : [],
    };
    try {
      await updateLorebook.mutateAsync({
        id: selectedLorebook.id,
        scope: nextScope,
        ...(ownerType === "character"
          ? { characterIds: uniqueIds([...ownerIds, ownerId]) }
          : { personaIds: uniqueIds([...ownerIds, ownerId]) }),
      });
      toast.success(localizeUi("ui.lorebooks.lorebookassignmentsection.assignedValue1", { value1: selectedLorebook.name }));
      setDraft(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.lorebooks.lorebookassignmentsection.failedToAssignLorebook"));
    }
  };

  const unassignLorebook = async (lorebook: Lorebook) => {
    if (!ownerId) return;
    const nextOwnerIds = getOwnerIds(lorebook, ownerType).filter((id) => id !== ownerId);
    const isEmbedded = ownerType === "character" && lorebook.id === embeddedLorebookId;
    try {
      await updateLorebook.mutateAsync({
        id: lorebook.id,
        ...(ownerType === "character" ? { characterIds: nextOwnerIds } : { personaIds: nextOwnerIds }),
      });
      toast.success(
        isEmbedded
          ?localizeUi("ui.lorebooks.lorebookassignmentsection.unlinkedValue1ItSStillEmbeddedInTheCard", { value1: lorebook.name })
          :localizeUi("ui.lorebooks.lorebookassignmentsection.removedValue1", { value1: lorebook.name }),
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message :localizeUi("ui.lorebooks.lorebookassignmentsection.failedToRemoveLorebook"));
    }
  };

  const specificSelectionInvalid = draft?.mode === "specific" && draft.chatIds.length === 0;
  const ownerLabel = getOwnerLabel(ownerType, ownerName);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{localizeUi("navigation.topbar.lorebooks")}</h3>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{localizeUi("ui.lorebooks.lorebookassignmentsection.assignCharacterCategoryLorebooksAndDecideWhichChatsCan")}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCreateLorebook}
            disabled={!ownerId}
            className="mari-editor-action mari-editor-action--compact inline-flex gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          >
            <Plus size="0.75rem" />{localizeUi("ui.lorebooks.lorebookassignmentsection.new")}</button>
          <button
            type="button"
            onClick={() => openAssignment()}
            disabled={!ownerId}
            className="mari-editor-action mari-editor-action--accent mari-editor-action--compact inline-flex gap-1.5 rounded-lg px-3 py-1.5 text-xs"
          >
            <BookOpen size="0.75rem" />{localizeUi("ui.lorebooks.lorebookassignmentsection.assignLorebook")}</button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="shimmer h-12 rounded-xl" />
          <div className="shimmer h-12 rounded-xl" />
        </div>
      ) : assignedLorebooks.length > 0 ? (
        <div className="space-y-2">
          {assignedLorebooks.map((lorebook) => {
            const scope = normalizeLorebookScope(lorebook.scope);
            return (
              <div
                key={lorebook.id}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-3 py-2.5"
              >
                <BookOpen size="0.875rem" className="shrink-0 text-amber-400" />
                <button
                  type="button"
                  onClick={() => openLorebookDetail(lorebook.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-xs font-medium text-[var(--foreground)]">{lorebook.name}</span>
                  <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                    {getScopeLabel(scope, eligibleChats, ownerType, ownerName)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openAssignment(lorebook)}
                  className="mari-editor-action mari-editor-action--compact inline-flex rounded-lg px-2 py-1 text-[0.625rem]"
                >{localizeUi("ui.lorebooks.lorebookassignmentsection.scope")}</button>
                {ownerType === "character" &&
                  (lorebook.id === embeddedLorebookId ? (
                    <>
                      <span className="rounded-lg bg-emerald-500/15 px-2 py-1 text-[0.625rem] font-medium text-emerald-500">{localizeUi("ui.lorebooks.lorebookassignmentsection.embedded")}</span>
                      <button
                        type="button"
                        onClick={() => handleEmbed(lorebook)}
                        disabled={embedLorebook.isPending}
                        className="mari-editor-action mari-editor-action--compact inline-flex rounded-lg px-2 py-1 text-[0.625rem]"
                        title={localizeUi("ui.lorebooks.lorebookassignmentsection.rewriteTheCardSEmbeddedCopyFromThisLorebook")}
                      >{localizeUi("ui.noodle.noodlehome.refresh")}</button>
                    </>
                  ) : embeddedLorebookId || slotOccupied ? (
                    <button
                      type="button"
                      disabled
                      className="mari-editor-action mari-editor-action--compact inline-flex rounded-lg px-2 py-1 text-[0.625rem]"
                      title={localizeUi("ui.lorebooks.lorebookassignmentsection.removeTheCurrentEmbeddedLorebookFirst")}
                    >{localizeUi("ui.lorebooks.lorebookassignmentsection.embedIntoCard")}</button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEmbed(lorebook)}
                      disabled={embedLorebook.isPending}
                      className="mari-editor-action mari-editor-action--accent mari-editor-action--compact inline-flex rounded-lg px-2 py-1 text-[0.625rem]"
                      title={localizeUi("ui.lorebooks.lorebookassignmentsection.writeThisLorebookIntoTheCharacterCardSoIt")}
                    >{localizeUi("ui.lorebooks.lorebookassignmentsection.embedIntoCard")}</button>
                  ))}
                <button
                  type="button"
                  onClick={() => unassignLorebook(lorebook)}
                  disabled={updateLorebook.isPending}
                  className="mari-editor-action mari-editor-action--compact mari-editor-action--danger inline-flex h-7 w-7 rounded-lg p-0"
                  title={
                    ownerType === "character" && lorebook.id === embeddedLorebookId
                      ?localizeUi("ui.lorebooks.lorebookassignmentsection.unlinkLorebookTheCardSEmbeddedCopyStaysUse")
                      :localizeUi("ui.lorebooks.lorebookassignmentsection.removeLorebook")
                  }
                >
                  <Trash2 size="0.75rem" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={localizeUi("ui.lorebooks.lorebookassignmentsection.assignLorebook")} width="max-w-3xl">
        {draft && (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="relative">
              <Search
                size="0.875rem"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
              <input
                value={draft.search}
                onChange={(event) =>
                  setDraft((current) => (current ? { ...current, search: event.target.value } : current))
                }
                placeholder={localizeUi("ui.lorebooks.lorebookassignmentsection.searchCharacterLorebooks")}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--secondary)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]/40 focus:ring-1 focus:ring-[var(--primary)]/20"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="min-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-1.5">
                {filteredLorebooks.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-[var(--muted-foreground)]">{localizeUi("ui.lorebooks.lorebookassignmentsection.noMatchingLorebooks")}</p>
                ) : (
                  filteredLorebooks.map((lorebook) => {
                    const assigned = isLorebookAssignedToOwner(lorebook, ownerType, ownerId);
                    const selected = draft.lorebookId === lorebook.id;
                    return (
                      <button
                        key={lorebook.id}
                        type="button"
                        onClick={() => {
                          const scope = normalizeLorebookScope(lorebook.scope);
                          setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  lorebookId: lorebook.id,
                                  mode: scope.mode,
                                  chatIds: scope.chatIds,
                                }
                              : current,
                          );
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                          selected ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "hover:bg-[var(--accent)]",
                        )}
                      >
                        <BookOpen size="0.8125rem" className="shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-medium">{lorebook.name}</span>
                          <span className="block truncate text-[0.625rem] text-[var(--muted-foreground)]">
                            {assigned
                              ?localizeUi("ui.lorebooks.lorebookassignmentsection.alreadyAssignedToValue1", { value1: ownerName || ownerType })
                              : lorebook.description || "No description"}
                          </span>
                        </span>
                        {selected && <Check size="0.75rem" className="shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--secondary)] p-3">
                <div>
                  <p className="text-xs font-semibold">{localizeUi("ui.lorebooks.lorebookassignmentsection.scope")}</p>
                  <p className="mt-0.5 text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.lorebooks.lorebookassignmentsection.controlsWhereThisAssignmentIsActiveAllChatsMeans")} {ownerLabel}{localizeUi("ui.lorebooks.lorebookassignmentsection.notEveryChatInMarinara")}</p>
                </div>

                {(["all", "disabled", "specific"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDraft((current) => (current ? { ...current, mode } : current))}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors",
                      draft.mode === mode
                        ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/25"
                        : "bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {mode === "all"
                      ?localizeUi("ui.lorebooks.lorebookassignmentsection.allChatsWithValue1", { value1: ownerLabel })
                      : mode === "disabled"
                        ?localizeUi("ui.lorebooks.lorebookassignmentsection.disabledForAllChats")
                        :localizeUi("ui.lorebooks.lorebookassignmentsection.specificChats")}
                    {draft.mode === mode && <Check size="0.75rem" />}
                  </button>
                ))}

                {draft.mode === "specific" && (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-[var(--card)] p-1.5 ring-1 ring-[var(--border)]">
                    {eligibleChats.length === 0 ? (
                      <p className="px-2 py-3 text-[0.625rem] text-[var(--muted-foreground)]">{localizeUi("ui.lorebooks.lorebookassignmentsection.noChatsInclude")} {ownerName || ownerType} {localizeUi("ui.lorebooks.lorebookassignmentsection.yet")}</p>
                    ) : (
                      eligibleChats.map((chat) => {
                        const selected = draft.chatIds.includes(chat.id);
                        return (
                          <button
                            key={chat.id}
                            type="button"
                            onClick={() =>
                              setDraft((current) => {
                                if (!current) return current;
                                return {
                                  ...current,
                                  chatIds: selected
                                    ? current.chatIds.filter((id) => id !== chat.id)
                                    : [...current.chatIds, chat.id],
                                };
                              })
                            }
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--accent)]"
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                selected
                                  ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
                                  : "border-[var(--border)]",
                              )}
                            >
                              {selected && <Check size="0.625rem" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs">{chat.name}</span>
                              <span className="block text-[0.5625rem] text-[var(--muted-foreground)]">
                                {MODE_LABELS[chat.mode] ?? chat.mode}
                              </span>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)]"
              >
                <X size="0.75rem" />{localizeUi("chat.delete.dialog.cancel")}</button>
              <button
                type="button"
                onClick={saveAssignment}
                disabled={!selectedLorebook || specificSelectionInvalid || updateLorebook.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {updateLorebook.isPending ? (
                  <Loader2 size="0.75rem" className="animate-spin" />
                ) : (
                  <Check size="0.75rem" />
                )}{localizeUi("ui.lorebooks.lorebookassignmentsection.assign")}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
