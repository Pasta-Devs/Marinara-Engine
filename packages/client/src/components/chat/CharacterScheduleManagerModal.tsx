import { CalendarClock, Check, Loader2, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PROFESSOR_MARI_ID, type WeekSchedule } from "@marinara-engine/shared";
import { useCharacters, useUpdateCharacter } from "../../hooks/use-characters";
import { useChatStore } from "../../stores/chat.store";
import { useChats } from "../../hooks/use-chats";
import { useUIStore } from "../../stores/ui.store";
import { api } from "../../lib/api-client";
import { showConfirmDialog } from "../../lib/app-dialogs";
import { Modal } from "../ui/Modal";
import { useTranslation as useUiTranslation } from "react-i18next";
import { toast } from "sonner";

type ManagerCharacter = {
  id: string;
  name: string;
  schedule?: WeekSchedule;
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
    schedule,
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

interface Props {
  open: boolean;
  onClose: () => void;
  onEditSchedule?: (characterId: string) => void;
}

export function CharacterScheduleManagerModal({ open, onClose, onEditSchedule }: Props) {
  const { t: localizeUi } = useUiTranslation();
  const { data: rows, isLoading } = useCharacters(open);
  const { data: chats } = useChats();
  const updateCharacter = useUpdateCharacter();
  const activeChatId = useChatStore((state) => state.activeChatId);
  const conversationTimeZone = useUIStore((state) => state.conversationTimeZone);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<"generate" | "remove" | null>(null);

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
    if (!activeConversationChat) {
      toast.error(localizeUi("ui.characters.schedulemanager.openConversationFirst"));
      return;
    }
    setWorking("generate");
    try {
      await api.post("/conversation/schedule/generate", {
        chatId: activeConversationChat.id,
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

  return (
    <Modal
      open={open}
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
            <CharacterScheduleGroup
              title={localizeUi("ui.characters.schedulemanager.scheduled")}
              characters={scheduled}
              selected={selected}
              onToggle={toggle}
              onAutoRenew={setAutoRenew}
              onEditSchedule={onEditSchedule}
              localizeUi={localizeUi}
            />
            <CharacterScheduleGroup
              title={localizeUi("ui.characters.schedulemanager.unscheduled")}
              characters={unscheduled}
              selected={selected}
              onToggle={toggle}
              onAutoRenew={setAutoRenew}
              onEditSchedule={onEditSchedule}
              localizeUi={localizeUi}
            />
            {!scheduled.length && !unscheduled.length && (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                {localizeUi("ui.characters.schedulemanager.noCharacters")}
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
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
}: {
  title: string;
  characters: ManagerCharacter[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onAutoRenew: (character: ManagerCharacter, value: boolean) => void;
  onEditSchedule?: (id: string) => void;
  localizeUi: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!characters.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
        {title} <span className="font-normal">({characters.length})</span>
      </h2>
      {characters.map((character) => {
        const state = scheduleState(character.schedule);
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
            <CalendarClock className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{character.name}</p>
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {character.schedule?.routineSummary?.trim() ||
                  (character.schedule
                    ? state === "due"
                      ? localizeUi("ui.characters.schedulemanager.needsRenewal")
                      : localizeUi("ui.characters.schedulemanager.current")
                    : localizeUi("ui.characters.schedulemanager.noSchedule"))}
              </p>
            </div>
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
            {character.schedule && onEditSchedule && (
              <button
                type="button"
                onClick={() => onEditSchedule(character.id)}
                className="text-xs font-medium text-[var(--primary)]"
              >
                {localizeUi("ui.characters.schedulemanager.edit")}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
}
