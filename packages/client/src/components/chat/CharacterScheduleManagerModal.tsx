import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  getAdjacentScheduleBlocks,
  getCurrentStatus,
  PROFESSOR_MARI_ID,
  type ConversationPresenceStatus,
  type WeekSchedule,
} from "@marinara-engine/shared";
import { useCharacters, useUpdateCharacter } from "../../hooks/use-characters";
import { useCharacterGroups, useCreateGroup, useUpdateGroup } from "../../hooks/use-characters";
import { useChatStore } from "../../stores/chat.store";
import { useChats } from "../../hooks/use-chats";
import { useUIStore } from "../../stores/ui.store";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";
import { CharacterScheduleEditorModal } from "./CharacterScheduleEditorModal";
import { getAvatarCropStyle } from "../../lib/utils";

type ManagerCharacter = {
  id: string;
  name: string;
  avatarPath: string | null;
  avatarCrop?: unknown;
  schedule?: WeekSchedule;
  conversationStatus: ConversationPresenceStatus;
  autoRenew: boolean;
};

function readCard(row: Record<string, unknown>): ManagerCharacter | null {
  const id = typeof row.id === "string" ? row.id : "";
  if (!id || id === PROFESSOR_MARI_ID) return null;
  let data: Record<string, unknown> = row;
  if (typeof row.data === "string") {
    try {
      data = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const extensions =
    data.extensions && typeof data.extensions === "object" ? (data.extensions as Record<string, unknown>) : {};
  const schedule = extensions.conversationSchedule as WeekSchedule | undefined;
  return {
    id,
    name: typeof data.name === "string" ? data.name : id,
    avatarPath: typeof row.avatarPath === "string" ? row.avatarPath : null,
    avatarCrop: row.avatarCrop,
    schedule,
    conversationStatus:
      extensions.conversationStatus === "idle" ||
      extensions.conversationStatus === "dnd" ||
      extensions.conversationStatus === "offline"
        ? extensions.conversationStatus
        : "online",
    autoRenew: schedule ? extensions.conversationScheduleAutoRenew !== false : true,
  };
}

function scheduleState(schedule: WeekSchedule | undefined, now = new Date()): "current" | "due" {
  if (!schedule) return "current";
  const weekStart = new Date(schedule.weekStart).getTime();
  const monday = new Date(now);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return Number.isFinite(weekStart) && monday.getTime() > weekStart ? "due" : "current";
}

function statusDotClass(status: ConversationPresenceStatus) {
  return status === "offline"
    ? "bg-gray-400"
    : status === "dnd"
      ? "bg-red-500"
      : status === "idle"
        ? "bg-yellow-500"
        : "bg-green-500";
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CharacterScheduleManagerModal({ open, onClose }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const { data: rows, isLoading } = useCharacters(open);
  const { data: chats } = useChats();
  const { data: groups } = useCharacterGroups();
  const createGroup = useCreateGroup();
  const updateGroup = useUpdateGroup();
  const updateCharacter = useUpdateCharacter();
  const activeChatId = useChatStore((state) => state.activeChatId);
  const conversationTimeZone = useUIStore((state) => state.conversationTimeZone);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<"generate" | "remove" | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);

  const characters = useMemo(
    () =>
      (rows ?? [])
        .map((row) => readCard(row as Record<string, unknown>))
        .filter((row): row is ManagerCharacter => !!row),
    [rows],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return characters.filter((character) => !normalized || character.name.toLowerCase().includes(normalized));
  }, [characters, query]);
  const scheduled = filtered.filter((character) => character.schedule);
  const unscheduled = filtered.filter((character) => !character.schedule);
  const activeConversationChat = chats?.find((chat) => chat.id === activeChatId && chat.mode === "conversation");
  const parsedGroups = useMemo(
    () =>
      (groups ?? []).map((group) => {
        const row = group as { id: string; name: string; characterIds?: string };
        let memberIds: string[] = [];
        try {
          memberIds = JSON.parse(row.characterIds ?? "[]") as string[];
        } catch {
          /* Ignore malformed legacy groups. */
        }
        return { id: row.id, name: row.name, memberIds };
      }),
    [groups],
  );
  const folderFor = (id: string) => parsedGroups.find((group) => group.memberIds.includes(id));
  const editingCharacter = characters.find((character) => character.id === editingCharacterId);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generate = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setWorking("generate");
    try {
      await api.post("/conversation/schedule/generate", {
        ...(activeConversationChat ? { chatId: activeConversationChat.id } : {}),
        characterIds: ids,
        forceRefresh: ids.some((id) => characters.find((character) => character.id === id)?.schedule),
        timeZone: conversationTimeZone,
      });
      toast.success(localizeUi("ui.characters.schedulemanager.schedulesGenerated"));
      setSelected(new Set());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : localizeUi("ui.characters.schedulemanager.generationFailed"),
      );
    } finally {
      setWorking(null);
    }
  };

  const remove = async () => {
    const targets = characters.filter((character) => selected.has(character.id) && character.schedule);
    if (!targets.length) return;
    const confirmed = await showConfirmDialog({
      title: localizeUi("ui.characters.schedulemanager.removeSchedules"),
      message: localizeUi("ui.characters.schedulemanager.removeSchedulesConfirm", { count: targets.length }),
      confirmLabel: localizeUi("ui.characters.schedulemanager.remove"),
      cancelLabel: localizeUi("ui.characters.schedulemanager.cancel"),
    });
    if (!confirmed) return;
    setWorking("remove");
    try {
      await Promise.all(
        targets.map((character) =>
          updateCharacter.mutateAsync({
            id: character.id,
            data: { extensions: { conversationSchedule: null, conversationScheduleAutoRenew: false } },
            skipVersionSnapshot: true,
          }),
        ),
      );
      setSelected(new Set());
      toast.success(localizeUi("ui.characters.schedulemanager.schedulesRemoved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("ui.characters.schedulemanager.removalFailed"));
    } finally {
      setWorking(null);
    }
  };

  const setAutoRenew = (character: ManagerCharacter, value: boolean) => {
    updateCharacter.mutate({
      id: character.id,
      data: { extensions: { conversationScheduleAutoRenew: value } },
      skipVersionSnapshot: true,
    });
  };

  const moveToFolder = async (characterId: string, folderId: string | null) => {
    await Promise.all(
      parsedGroups.map((group) => {
        const characterIds = group.memberIds.filter((id) => id !== characterId);
        if (group.id === folderId) characterIds.push(characterId);
        return updateGroup.mutateAsync({ id: group.id, characterIds });
      }),
    );
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const createFolder = () => {
    const names = new Set(parsedGroups.map((folder) => folder.name.trim().toLowerCase()));
    let name = "Unnamed";
    let number = 2;
    while (names.has(name.toLowerCase())) name = `Unnamed ${number++}`;
    createGroup.mutate({ name, characterIds: [] });
  };

  const renderGroup = (title: string, groupCharacters: ManagerCharacter[]) => (
    <CharacterScheduleGroup
      title={title}
      characters={groupCharacters}
      selected={selected}
      onToggle={toggle}
      onAutoRenew={setAutoRenew}
      onEditSchedule={setEditingCharacterId}
      localizeUi={localizeUi}
      folders={parsedGroups}
      folderFor={folderFor}
      onMoveToFolder={moveToFolder}
    />
  );

  return (
    <>
      <Modal
        open={open && !editingCharacterId}
        onClose={onClose}
        title={localizeUi("ui.characters.schedulemanager.title")}
        width="max-w-2xl"
        mobileFullscreen
      >
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2">
            <Search className="h-4 w-4 text-[var(--muted-foreground)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={localizeUi("ui.characters.schedulemanager.search")}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={localizeUi("ui.characters.schedulemanager.clearSearch")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
            <button
              type="button"
              onClick={() => setSelected(new Set(filtered.map((character) => character.id)))}
              className="text-xs font-medium text-[var(--primary)]"
            >
              {localizeUi("ui.characters.schedulemanager.selectVisible")}
            </button>
            <button
              type="button"
              onClick={createFolder}
              disabled={createGroup.isPending}
              className="inline-flex items-center gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {localizeUi("ui.characters.schedulemanager.newFolder")}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-[var(--muted-foreground)]"
            >
              {localizeUi("ui.characters.schedulemanager.clearSelection")}
            </button>
            <span className="ml-auto text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.characters.schedulemanager.selected", { count: selected.size })}
            </span>
            <button
              type="button"
              disabled={!selected.size || working !== null}
              onClick={() => void generate()}
              className="inline-flex items-center gap-1 rounded-md bg-[var(--primary)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {localizeUi("ui.characters.schedulemanager.generate")}
            </button>
            <button
              type="button"
              disabled={!selected.size || working !== null}
              onClick={() => void remove()}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--destructive)]/40 px-2.5 py-1.5 text-xs font-semibold text-[var(--destructive)] disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {localizeUi("ui.characters.schedulemanager.remove")}
            </button>
          </div>
          {isLoading ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" />
          ) : (
            <div className="max-h-[min(60vh,36rem)] space-y-4 overflow-y-auto pr-1">
              {parsedGroups.map((folder) => {
                const members = filtered.filter((character) => folder.memberIds.includes(character.id));
                if (!members.length) return null;
                const isExpanded = expandedFolders.has(folder.id);
                return (
                  <section key={folder.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleFolder(folder.id)}
                      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      <FolderPlus className="h-3.5 w-3.5" />
                      {folder.name} <span className="font-normal">({members.length})</span>
                    </button>
                    {isExpanded && (
                      <div className="space-y-4 pl-2">
                        {renderGroup(
                          localizeUi("ui.characters.schedulemanager.scheduled"),
                          members.filter((character) => character.schedule),
                        )}
                        {renderGroup(
                          localizeUi("ui.characters.schedulemanager.unscheduled"),
                          members.filter((character) => !character.schedule),
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
              {renderGroup(
                localizeUi("ui.characters.schedulemanager.scheduled"),
                scheduled.filter((character) => !folderFor(character.id)),
              )}
              {renderGroup(
                localizeUi("ui.characters.schedulemanager.unscheduled"),
                unscheduled.filter((character) => !folderFor(character.id)),
              )}
              {!scheduled.length && !unscheduled.length && (
                <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                  {localizeUi("ui.characters.schedulemanager.noCharacters")}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
      {editingCharacter && (
        <CharacterScheduleEditorModal
          open
          characterId={editingCharacter.id}
          characterName={editingCharacter.name}
          characterAvatarUrl={editingCharacter.avatarPath}
          schedule={editingCharacter.schedule}
          onClose={() => setEditingCharacterId(null)}
          onSave={(characterId, schedule) =>
            updateCharacter.mutate({
              id: characterId,
              data: { extensions: { conversationSchedule: schedule } },
              skipVersionSnapshot: true,
            })
          }
        />
      )}
    </>
  );
}

function CharacterScheduleGroup({
  title,
  characters,
  selected,
  onToggle,
  onAutoRenew,
  onEditSchedule,
  localizeUi,
  folders,
  folderFor,
  onMoveToFolder,
}: {
  title: string;
  characters: ManagerCharacter[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAutoRenew: (character: ManagerCharacter, value: boolean) => void;
  onEditSchedule: (id: string) => void;
  localizeUi: (key: string, options?: Record<string, unknown>) => string;
  folders: Array<{ id: string; name: string; memberIds: string[] }>;
  folderFor: (id: string) => { id: string; name: string } | undefined;
  onMoveToFolder: (characterId: string, folderId: string | null) => Promise<void>;
}) {
  if (!characters.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title} <span className="font-normal">({characters.length})</span>
      </h2>
      {characters.map((character) => {
        const state = scheduleState(character.schedule);
        const current = character.schedule ? getCurrentStatus(character.schedule) : null;
        const currentBlock = character.schedule ? getAdjacentScheduleBlocks(character.schedule).current : null;
        return (
          <div
            key={character.id}
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)] px-3 py-2"
          >
            <button
              type="button"
              onClick={() => onToggle(character.id)}
              aria-label={localizeUi("ui.characters.schedulemanager.selectCharacter", { name: character.name })}
              className="shrink-0"
            >
              {selected.has(character.id) ? (
                <Check className="h-4 w-4 text-[var(--primary)]" />
              ) : (
                <span className="block h-4 w-4 rounded border border-[var(--muted-foreground)]/50" />
              )}
            </button>
            {character.avatarPath ? (
              <img
                src={character.avatarPath}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
                style={getAvatarCropStyle(character.avatarCrop as Parameters<typeof getAvatarCropStyle>[0])}
              />
            ) : (
              <CalendarClock className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
            )}
            <button
              type="button"
              onClick={() => onEditSchedule(character.id)}
              className="min-w-0 flex-1 text-left"
              aria-label={localizeUi("ui.characters.schedulemanager.editCharacter", { name: character.name })}
            >
              <p className="truncate text-sm font-medium">{character.name}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${statusDotClass(current?.status ?? character.conversationStatus)}`}
                  />
                  {character.schedule
                    ? currentBlock?.activity ||
                      (state === "due"
                        ? localizeUi("ui.characters.schedulemanager.needsRenewal")
                        : localizeUi("ui.characters.schedulemanager.noCurrentBlock"))
                    : localizeUi("ui.characters.schedulemanager.noSchedule")}
                </span>
              </p>
            </button>
            {character.schedule && (
              <label className="flex shrink-0 items-center gap-1 text-[0.65rem] text-[var(--muted-foreground)]">
                <input
                  type="checkbox"
                  checked={character.autoRenew}
                  onChange={(event) => onAutoRenew(character, event.target.checked)}
                />
                {localizeUi("ui.characters.schedulemanager.autoRenew")}
              </label>
            )}
            {onEditSchedule && (
              <button
                type="button"
                onClick={() => onEditSchedule(character.id)}
                className="text-xs font-medium text-[var(--primary)]"
              >
                {localizeUi("ui.characters.schedulemanager.edit")}
              </button>
            )}
            <select
              value={folderFor(character.id)?.id ?? ""}
              onChange={(event) => void onMoveToFolder(character.id, event.target.value || null)}
              aria-label={localizeUi("ui.characters.schedulemanager.folderFor", { name: character.name })}
              className="max-w-28 rounded bg-[var(--background)] px-1 py-1 text-[0.65rem]"
            >
              <option value="">{localizeUi("ui.characters.schedulemanager.noFolder")}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </section>
  );
}
