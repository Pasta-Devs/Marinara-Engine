import { BookOpen, Globe, Plus, Tag, ToggleLeft, ToggleRight, Users, UserRound, Wand2, X } from "lucide-react";
import type { LorebookCategory, LorebookEntry } from "../../../../../engine/contracts/types/lorebook";
import { HelpTooltip } from "../../../../../shared/components/ui/HelpTooltip";
import { cn } from "../../../../../shared/lib/utils";
import { ExpandableTextarea } from "../shared/LorebookFormFields";
import { LinkedResourcePicker } from "./LinkedResourcePicker";
import { LorebookVectorizeSection } from "./LorebookVectorizeSection";
import { readBoolFlag } from "./lorebook-editor-utils";

const CATEGORY_OPTIONS: Array<{ value: LorebookCategory; label: string; icon: typeof Globe }> = [
  { value: "world", label: "World", icon: Globe },
  { value: "character", label: "Character", icon: Users },
  { value: "npc", label: "NPC", icon: UserRound },
  { value: "spellbook", label: "Spellbook", icon: Wand2 },
  { value: "uncategorized", label: "Uncategorized", icon: BookOpen },
];

type ScopeSummaryLine = { label: string; names: string };

export type LorebookOverviewScopeSummary =
  | null
  | { text: string }
  | {
      characters: ScopeSummaryLine | null;
      personas: ScopeSummaryLine | null;
    };

export function LorebookOverviewTab({
  lorebookId,
  entries,
  persistedExcludeFromVectorization,
  name,
  description,
  tags,
  newTag,
  category,
  enabled,
  global,
  excludeFromVectorization,
  scanDepth,
  tokenBudget,
  recursive,
  maxRecursionDepth,
  characterIds,
  personaIds,
  characters,
  personas,
  scopeSummary,
  characterLinkSearch,
  debouncedCharacterLinkSearch,
  personaLinkSearch,
  characterLinkPickerOpen,
  personaLinkPickerOpen,
  allRawCharactersFetching,
  allRawCharactersError,
  onNameChange,
  onDescriptionChange,
  onTagsChange,
  onNewTagChange,
  onCategoryChange,
  onEnabledChange,
  onGlobalChange,
  onExcludeFromVectorizationChange,
  onScanDepthChange,
  onTokenBudgetChange,
  onRecursiveChange,
  onMaxRecursionDepthChange,
  onCharacterIdsChange,
  onPersonaIdsChange,
  onCharacterLinkSearchChange,
  onPersonaLinkSearchChange,
  onCharacterLinkPickerOpenChange,
  onPersonaLinkPickerOpenChange,
  onDirty,
}: {
  lorebookId: string;
  entries: LorebookEntry[];
  persistedExcludeFromVectorization: unknown;
  name: string;
  description: string;
  tags: string[];
  newTag: string;
  category: LorebookCategory;
  enabled: boolean;
  global: boolean;
  excludeFromVectorization: boolean;
  scanDepth: number;
  tokenBudget: number;
  recursive: boolean;
  maxRecursionDepth: number;
  characterIds: string[];
  personaIds: string[];
  characters: Array<{ id: string; name: string; searchText?: string[] }>;
  personas: Array<{ id: string; name: string; comment?: string | null }>;
  scopeSummary: LorebookOverviewScopeSummary;
  characterLinkSearch: string;
  debouncedCharacterLinkSearch: string;
  personaLinkSearch: string;
  characterLinkPickerOpen: boolean;
  personaLinkPickerOpen: boolean;
  allRawCharactersFetching: boolean;
  allRawCharactersError: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTagsChange: (value: string[]) => void;
  onNewTagChange: (value: string) => void;
  onCategoryChange: (value: LorebookCategory) => void;
  onEnabledChange: (value: boolean) => void;
  onGlobalChange: (value: boolean) => void;
  onExcludeFromVectorizationChange: (value: boolean) => void;
  onScanDepthChange: (value: number) => void;
  onTokenBudgetChange: (value: number) => void;
  onRecursiveChange: (value: boolean) => void;
  onMaxRecursionDepthChange: (value: number) => void;
  onCharacterIdsChange: (value: string[]) => void;
  onPersonaIdsChange: (value: string[]) => void;
  onCharacterLinkSearchChange: (value: string) => void;
  onPersonaLinkSearchChange: (value: string) => void;
  onCharacterLinkPickerOpenChange: (value: boolean) => void;
  onPersonaLinkPickerOpenChange: (value: boolean) => void;
  onDirty: () => void;
}) {
  const addTag = () => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      onTagsChange([...tags, tag]);
      onDirty();
    }
    onNewTagChange("");
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-1.5 block text-xs font-medium">Name</label>
        <input
          value={name}
          onChange={(event) => {
            onNameChange(event.target.value);
            onDirty();
          }}
          className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium">Description</label>
        <ExpandableTextarea
          value={description}
          onChange={(value) => {
            onDescriptionChange(value);
            onDirty();
          }}
          rows={3}
          title="Edit lorebook description"
        />
      </div>

      <div>
        <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
          <Tag size="0.75rem" /> Tags
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-1 text-[0.6875rem] font-medium text-amber-400"
            >
              {tag}
              <button
                onClick={() => {
                  onTagsChange(tags.filter((current) => current !== tag));
                  onDirty();
                }}
                className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-amber-400/20"
                aria-label={`Remove tag ${tag}`}
              >
                <X size="0.625rem" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <input
            value={newTag}
            onChange={(event) => onNewTagChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && newTag.trim()) {
                event.preventDefault();
                addTag();
              }
            }}
            placeholder="Add tag…"
            className="flex-1 rounded-xl bg-[var(--secondary)] px-3 py-2 text-xs ring-1 ring-[var(--border)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
          <button
            onClick={addTag}
            className="rounded-xl bg-[var(--secondary)] px-3 py-2 text-xs font-medium ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)]"
            aria-label="Add tag"
          >
            <Plus size="0.75rem" />
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium">Category</label>
        <div className="flex gap-2">
          {CATEGORY_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => {
                  onCategoryChange(option.value);
                  onDirty();
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                  category === option.value
                    ? "bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/30"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                <Icon size="0.8125rem" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {!global && (
        <div className="rounded-xl bg-[var(--secondary)]/60 p-4 ring-1 ring-[var(--border)]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <LinkedResourcePicker
              label="Linked Characters"
              help="When linked to characters, this lorebook auto-activates in chats that include any of them."
              emptyText="No characters selected"
              addLabel="Add Character"
              searchPlaceholder="Search characters..."
              icon={<Users size="0.875rem" />}
              items={characters}
              selectedIds={characterIds}
              search={characterLinkSearch}
              onSearchChange={onCharacterLinkSearchChange}
              isLoading={
                characterLinkPickerOpen &&
                (allRawCharactersFetching || characterLinkSearch.trim() !== debouncedCharacterLinkSearch.trim())
              }
              isError={characterLinkPickerOpen && allRawCharactersError}
              isOpen={characterLinkPickerOpen}
              onOpen={() => {
                onCharacterLinkPickerOpenChange(true);
                onCharacterLinkSearchChange("");
              }}
              onClose={() => onCharacterLinkPickerOpenChange(false)}
              onAdd={(id) => {
                onCharacterIdsChange(characterIds.includes(id) ? characterIds : [...characterIds, id]);
                onDirty();
              }}
              onRemove={(id) => {
                onCharacterIdsChange(characterIds.filter((characterId) => characterId !== id));
                onDirty();
              }}
            />

            <LinkedResourcePicker
              label="Linked Personas"
              help="When linked to personas, this lorebook auto-activates in chats that use any of them."
              emptyText="No personas selected"
              addLabel="Add Persona"
              searchPlaceholder="Search personas..."
              icon={<UserRound size="0.875rem" />}
              items={personas.map((persona) => ({
                id: persona.id,
                name: persona.name,
                description: persona.comment,
              }))}
              selectedIds={personaIds}
              search={personaLinkSearch}
              onSearchChange={onPersonaLinkSearchChange}
              isOpen={personaLinkPickerOpen}
              onOpen={() => {
                onPersonaLinkPickerOpenChange(true);
                onPersonaLinkSearchChange("");
              }}
              onClose={() => onPersonaLinkPickerOpenChange(false)}
              onAdd={(id) => {
                onPersonaIdsChange(personaIds.includes(id) ? personaIds : [...personaIds, id]);
                onDirty();
              }}
              onRemove={(id) => {
                onPersonaIdsChange(personaIds.filter((personaId) => personaId !== id));
                onDirty();
              }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex min-h-[4.75rem] items-center justify-between rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)]">
          <div>
            <p className="text-xs font-medium">Enabled</p>
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              When off, entries in this lorebook won't activate
            </p>
          </div>
          <button
            onClick={() => {
              onEnabledChange(!enabled);
              onDirty();
            }}
            className="transition-colors"
            aria-label={enabled ? "Disable lorebook" : "Enable lorebook"}
            aria-pressed={enabled}
          >
            {enabled ? (
              <ToggleRight size="1.75rem" className="text-amber-400" />
            ) : (
              <ToggleLeft size="1.75rem" className="text-[var(--muted-foreground)]" />
            )}
          </button>
        </div>

        {scopeSummary && (
          <div className="flex h-[10.25rem] items-start overflow-hidden rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)] md:row-span-2">
            <div className="min-w-0 overflow-hidden">
              <p className="mb-1 text-xs font-medium">Linked To:</p>
              {"text" in scopeSummary ? (
                <p className="text-[0.6875rem] text-[var(--muted-foreground)]">{scopeSummary.text}</p>
              ) : (
                <div
                  className="space-y-1 overflow-hidden text-[0.6875rem] leading-snug text-[var(--muted-foreground)]"
                  title={[scopeSummary.characters, scopeSummary.personas]
                    .filter((line): line is ScopeSummaryLine => line !== null)
                    .map((line) => `${line.label} ${line.names}`)
                    .join("\n")}
                >
                  {scopeSummary.characters && (
                    <p>
                      <span className="font-medium text-[var(--foreground)]">{scopeSummary.characters.label}</span>{" "}
                      {scopeSummary.characters.names}
                    </p>
                  )}
                  {scopeSummary.personas && (
                    <p>
                      <span className="font-medium text-[var(--foreground)]">{scopeSummary.personas.label}</span>{" "}
                      {scopeSummary.personas.names}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex min-h-[4.75rem] items-center justify-between rounded-xl bg-[var(--secondary)] px-4 py-3 ring-1 ring-[var(--border)]">
          <div>
            <p className="text-xs font-medium">Global</p>
            <p className="text-[0.6875rem] text-[var(--muted-foreground)]">
              Active in every chat when this lorebook is enabled
            </p>
          </div>
          <button
            onClick={() => {
              onGlobalChange(!global);
              onDirty();
            }}
            className="transition-colors"
            aria-label={global ? "Disable global lorebook" : "Enable global lorebook"}
            aria-pressed={global}
          >
            {global ? (
              <ToggleRight size="1.75rem" className="text-amber-400" />
            ) : (
              <ToggleLeft size="1.75rem" className="text-[var(--muted-foreground)]" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
            Scan Depth{" "}
            <HelpTooltip text="How many recent messages to scan for keyword matches. Higher = searches further back in chat history, but uses more processing." />
          </label>
          <input
            type="number"
            value={scanDepth}
            onChange={(event) => {
              onScanDepthChange(Math.max(0, parseInt(event.target.value, 10) || 0));
              onDirty();
            }}
            min={0}
            className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
            Token Budget{" "}
            <HelpTooltip text="Maximum number of tokens this lorebook can inject per generation. Prevents a lorebook from consuming too much of the context window." />
          </label>
          <input
            type="number"
            value={tokenBudget}
            onChange={(event) => {
              onTokenBudgetChange(Math.max(0, parseInt(event.target.value, 10) || 0));
              onDirty();
            }}
            min={0}
            className="w-full rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex items-center justify-between rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]">
            <span className="mr-2 text-xs">Recursive</span>
            <button
              onClick={() => {
                onRecursiveChange(!recursive);
                onDirty();
              }}
              aria-label={recursive ? "Disable recursive scanning" : "Enable recursive scanning"}
              aria-pressed={recursive}
            >
              {recursive ? (
                <ToggleRight size="1.375rem" className="text-amber-400" />
              ) : (
                <ToggleLeft size="1.375rem" className="text-[var(--muted-foreground)]" />
              )}
            </button>
          </div>
          {recursive && (
            <div>
              <label className="mb-1.5 flex items-center gap-1 text-xs font-medium">
                Max Depth{" "}
                <HelpTooltip text="Maximum number of recursive passes. Each pass scans activated entry content for additional keyword matches. Higher values find more connections but use more processing." />
              </label>
              <input
                type="number"
                value={maxRecursionDepth}
                onChange={(event) => {
                  onMaxRecursionDepthChange(Math.max(1, Math.min(10, parseInt(event.target.value) || 3)));
                  onDirty();
                }}
                min={1}
                max={10}
                className="w-20 rounded-xl bg-[var(--secondary)] px-3 py-2.5 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
          )}
        </div>
        <div className="flex items-end">
          <div className="flex w-full items-center justify-between rounded-xl bg-[var(--secondary)] px-3 py-2.5 ring-1 ring-[var(--border)]">
            <span className="mr-2 inline-flex items-center gap-1 text-xs">
              No Vector
              <HelpTooltip text="Skip semantic embeddings for every entry in this lorebook. Keyword matching still works." />
            </span>
            <button
              onClick={() => {
                onExcludeFromVectorizationChange(!excludeFromVectorization);
                onDirty();
              }}
              aria-label={
                excludeFromVectorization ? "Enable semantic vectorization" : "Disable semantic vectorization"
              }
              aria-pressed={excludeFromVectorization}
            >
              {excludeFromVectorization ? (
                <ToggleRight size="1.375rem" className="text-amber-400" />
              ) : (
                <ToggleLeft size="1.375rem" className="text-[var(--muted-foreground)]" />
              )}
            </button>
          </div>
        </div>
      </div>

      <LorebookVectorizeSection
        lorebookId={lorebookId}
        entries={entries}
        excludeFromVectorization={excludeFromVectorization}
        hasUnsavedVectorizationToggle={excludeFromVectorization !== readBoolFlag(persistedExcludeFromVectorization)}
      />
    </div>
  );
}
