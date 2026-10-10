import { type ChangeEvent, type RefObject, useEffect, useMemo, useRef } from "react";
import { useTranslation as useUiTranslation } from "react-i18next";
import { ChevronRight, FileUp, Loader2, Plus, Save, Star, Trash2 } from "lucide-react";
import type { MariInstructionDetail } from "@marinara-engine/shared";

import { useUIStore } from "../../stores/ui.store";
import { SettingsSwitch } from "../panels/settings/SettingControls";
import { cn } from "../../lib/utils";
import {
  MariPanelSortSelect,
  MariSidePanelHeader,
  MariSideSearch,
  compareMariPanelItems,
  type MemoryDraftState,
} from "./MariPanelControls";

// #4851: the Memories management panel, next to Skills. Mirrors ProfessorMariSkillsMenu;
// adds a Persistent toggle (with a "keep it small" tooltip) and drops file diagnostics
// (memories are DB-backed). Enable + Persistent are direct toggles; name/description/
// content save together.
export function ProfessorMariMemoriesMenu({
  memories,
  query,
  selectedMemory,
  draft,
  loading,
  saving,
  fileInputRef,
  onClose,
  onNew,
  onUploadClick,
  onFileChange,
  onSelect,
  onDraftChange,
  onSave,
  onDelete,
  onToggleEnabled,
  onTogglePersistent,
  onQueryChange,
  className,
}: {
  memories: MariInstructionDetail[];
  query: string;
  selectedMemory: MariInstructionDetail | null;
  draft: MemoryDraftState;
  loading: boolean;
  saving: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onNew: () => void;
  onUploadClick: () => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSelect: (id: string | null) => void;
  onDraftChange: (draft: MemoryDraftState) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  onToggleEnabled: (memory: MariInstructionDetail) => void;
  onTogglePersistent: (memory: MariInstructionDetail) => void;
  onQueryChange: (query: string) => void;
  className?: string;
}) {
  const { t: localizeUi } = useUiTranslation();
  const enabledCount = memories.filter((memory) => memory.enabled).length;
  const hasMemories = memories.length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  // Pure textual match: drives the noMatches message. The open (selected) row is re-added in
  // `displayed` below so its editor stays visible even when the search excludes it.
  const filtered = useMemo(
    () =>
      normalizedQuery
        ? memories.filter((memory) => `${memory.name} ${memory.description}`.toLowerCase().includes(normalizedQuery))
        : memories,
    [memories, normalizedQuery],
  );
  const sortMode = useUIStore((s) => s.mariPanelSortMode);
  const setSortMode = useUIStore((s) => s.setMariPanelSortMode);
  const displayed = useMemo(() => {
    // Re-add the open (selected) row BEFORE sorting/partitioning so it lands in its correct group
    // and sorted position, not appended out of order at the end.
    const candidates =
      selectedMemory && !filtered.some((memory) => memory.id === selectedMemory.id)
        ? [...filtered, selectedMemory]
        : filtered;
    const sorted = [...candidates].sort((a, b) => compareMariPanelItems(a, b, sortMode));
    // Persistent memories are pinned above the rest; each group keeps the chosen sort order.
    return [...sorted.filter((memory) => memory.persistent), ...sorted.filter((memory) => !memory.persistent)];
  }, [filtered, sortMode, selectedMemory]);
  // Keep the open editor in view when its row moves (selection change, persistent toggle, or a rename).
  const activeEditorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeEditorRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedMemory?.id, selectedMemory?.persistent, selectedMemory?.updatedAt, sortMode, normalizedQuery]);

  return (
    <section className={cn("flex h-full min-h-0 min-w-0 flex-col", className)}>
      <MariSidePanelHeader
        title={localizeUi("ui.chat.professormarimemoriesmenu.professorMariMemories")}
        hint={
          hasMemories
            ? `${enabledCount} ${localizeUi("ui.chat.professormariskillsmenu.active")} ${memories.length} ${localizeUi("ui.chat.professormariskillsmenu.total")}`
            : localizeUi("ui.chat.professormarimemoriesmenu.hint")
        }
        onClose={onClose}
        closeLabel={localizeUi("ui.chat.professormarimemoriesmenu.close")}
      />

      <div className={cn("shrink-0 flex-wrap items-center gap-2 px-3 pb-2", selectedMemory ? "hidden" : "flex")}>
        <button
          type="button"
          onClick={() => {
            onQueryChange("");
            onNew();
          }}
          disabled={saving}
          className="mari-btn"
        >
          <Plus size="0.78rem" />
          {localizeUi("ui.lorebooks.lorebookassignmentsection.new")}
        </button>
        <button type="button" onClick={onUploadClick} disabled={saving} className="mari-btn">
          <FileUp size="0.78rem" />
          {localizeUi("ui.characters.characterclipcard.upload")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {hasMemories && !selectedMemory && (
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2">
          <MariSideSearch
            value={query}
            onChange={onQueryChange}
            label={localizeUi("ui.chat.professormarimemoriesmenu.searchPlaceholder")}
          />
          <MariPanelSortSelect value={sortMode} onChange={setSortMode} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="mari-edit">
          {!loading && hasMemories && filtered.length === 0 && (
            <div className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.professormarimemoriesmenu.noMatches")}
            </div>
          )}
          {loading ? (
            <div className="h-12 animate-pulse bg-[var(--muted)]/20" />
          ) : !hasMemories ? (
            <div className="px-3 py-3 text-xs text-[var(--muted-foreground)]">
              {localizeUi("ui.chat.professormarimemoriesmenu.noMemoriesYet")}
            </div>
          ) : (
            (selectedMemory ? [selectedMemory] : displayed).map((memory) => {
              const active = selectedMemory?.id === memory.id;
              return (
                <div
                  key={memory.id}
                  className={cn("mari-edit__row w-full min-w-0", active && "bg-[var(--mari-hover)]")}
                >
                  <div className="flex w-full min-w-0 items-stretch gap-1">
                    <button
                      type="button"
                      onClick={() => onSelect(active ? null : memory.id)}
                      aria-expanded={active}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 pl-3 pr-2 text-left hover:bg-[var(--mari-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"
                    >
                      {memory.persistent && (
                        <Star
                          size="0.72rem"
                          aria-label={localizeUi("ui.chat.professormarimemoriesmenu.persistent")}
                          className="shrink-0 fill-[var(--primary)] text-[var(--primary)]"
                        />
                      )}
                      <ChevronRight
                        size="0.8rem"
                        className={cn(
                          "shrink-0 text-[var(--muted-foreground)] transition-transform",
                          active && "rotate-90",
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-semibold text-[var(--foreground)]">
                          {memory.name}
                        </span>
                        {memory.description && (
                          <span className="mt-0.5 hidden truncate text-[0.65rem] text-[var(--muted-foreground)] md:block">
                            {memory.description}
                          </span>
                        )}
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center pr-3">
                      <SettingsSwitch
                        ariaLabel={
                          memory.enabled
                            ? localizeUi("ui.chat.professormarimemoriesmenu.disableMemory")
                            : localizeUi("ui.chat.professormarimemoriesmenu.enableMemory")
                        }
                        title={
                          memory.enabled
                            ? localizeUi("ui.noodle.noodlehome.enabled")
                            : localizeUi("ui.agents.agenteditor.disabled")
                        }
                        checked={memory.enabled}
                        onChange={() => onToggleEnabled(memory)}
                        disabled={saving}
                        className="p-0 hover:bg-transparent"
                      />
                    </span>
                  </div>
                  {active && (
                    <div
                      ref={active ? activeEditorRef : undefined}
                      className="space-y-2 border-t border-[var(--mari-divider)] px-3 py-3"
                    >
                      {!memory.enabled && (
                        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[0.65rem] text-amber-200">
                          {localizeUi("ui.chat.professormarimemoriesmenu.disabledHint")}
                        </div>
                      )}
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.characters.metadatatab.name")}
                        <input
                          value={draft.name}
                          onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
                          disabled={saving}
                          className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("chat.settings.inlineEditor.fields.description")}
                        <input
                          value={draft.description}
                          onChange={(event) => onDraftChange({ ...draft, description: event.target.value })}
                          disabled={saving}
                          className="mt-1 h-8 w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="block text-[0.6875rem] font-semibold text-[var(--muted-foreground)]">
                        {localizeUi("ui.chat.professormarimemoriesmenu.memory")}
                        <textarea
                          value={draft.content}
                          onChange={(event) => onDraftChange({ ...draft, content: event.target.value })}
                          disabled={saving}
                          rows={9}
                          className="mt-1 min-h-40 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-2 font-mono text-[0.6875rem] leading-relaxed text-[var(--foreground)] outline-none transition-colors focus:border-[var(--primary)]/55 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <div
                        className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)]/60 bg-[var(--card)]/60 px-2.5 py-1.5"
                        title={localizeUi("ui.chat.professormarimemoriesmenu.persistentHint")}
                      >
                        <span className="min-w-0">
                          <span className="block text-[0.6875rem] font-semibold text-[var(--foreground)]">
                            {localizeUi("ui.chat.professormarimemoriesmenu.persistent")}
                          </span>
                          <span className="mt-0.5 block text-[0.6rem] leading-snug text-[var(--muted-foreground)]">
                            {localizeUi("ui.chat.professormarimemoriesmenu.persistentHint")}
                          </span>
                        </span>
                        <SettingsSwitch
                          ariaLabel={localizeUi("ui.chat.professormarimemoriesmenu.persistent")}
                          checked={memory.persistent}
                          onChange={() => onTogglePersistent(memory)}
                          disabled={saving}
                          className="shrink-0 p-0 hover:bg-transparent"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onDelete(memory.id)}
                          disabled={saving}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.6875rem] font-semibold text-[var(--destructive)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Trash2 size="0.75rem" />
                          {localizeUi("lorebook.editor.batch.delete")}
                        </button>
                        <button type="button" onClick={onSave} disabled={saving} className="mari-btn mari-btn--solid">
                          {saving ? <Loader2 size="0.75rem" className="animate-spin" /> : <Save size="0.75rem" />}
                          {localizeUi("ui.noodle.noodlehome.save")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
