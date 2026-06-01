import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Hash, Key, Settings2 } from "lucide-react";
import type {
  LorebookEntry,
  LorebookFilterMode,
  LorebookMatchingSource,
} from "../../../../../engine/contracts/types/lorebook";
import { cn } from "../../../../../shared/lib/utils";
import { useUpdateLorebookEntry } from "../../hooks/use-lorebooks";
import {
  ExpandableTextarea,
  FieldGroup,
  KeysEditor,
  NumberField,
  ToggleButton,
  estimateTokens,
} from "../shared/LorebookFormFields";
import { deriveStatus, STATUS_DESCRIPTION, STATUS_DOT_COLOR } from "./lorebook-entry-row-status";

const ENTRY_AUTOSAVE_DELAY_MS = 850;

const FILTER_MODE_LABEL: Record<LorebookFilterMode, string> = {
  any: "Any",
  include: "Only",
  exclude: "Exclude",
};

const MATCHING_SOURCE_OPTIONS: Array<{ value: LorebookMatchingSource; label: string }> = [
  { value: "character_name", label: "Character name" },
  { value: "character_description", label: "Character description" },
  { value: "character_personality", label: "Personality" },
  { value: "character_scenario", label: "Scenario" },
  { value: "character_tags", label: "Character tags" },
  { value: "persona_description", label: "Persona description" },
  { value: "persona_tags", label: "Persona tags" },
];

const GENERATION_TRIGGER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "conversation", label: "Conversation" },
  { value: "roleplay", label: "Roleplay" },
  { value: "game", label: "Game" },
  { value: "chat", label: "Chat reply" },
  { value: "continue", label: "Continue" },
  { value: "autonomous", label: "Autonomous" },
  { value: "swipe", label: "Swipe" },
  { value: "impersonate", label: "Impersonate" },
  { value: "prompt_preview", label: "Prompt preview" },
  { value: "test_scan", label: "Test scan" },
  { value: "game_setup", label: "Game setup" },
  { value: "lorebook_assistant", label: "Lorebook Assistant" },
];

function toggleStringValue(values: string[] | undefined, value: string) {
  const current = values ?? [];
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function buildEntrySavePayload(form: Partial<LorebookEntry>) {
  const payload: Partial<LorebookEntry> = {
    content: form.content,
    description: form.description,
    keys: form.keys,
    secondaryKeys: form.secondaryKeys,
    selectiveLogic: form.selectiveLogic,
    matchWholeWords: form.matchWholeWords,
    caseSensitive: form.caseSensitive,
    useRegex: form.useRegex,
    characterFilterMode: form.characterFilterMode,
    characterFilterIds: form.characterFilterIds,
    characterTagFilterMode: form.characterTagFilterMode,
    characterTagFilters: form.characterTagFilters,
    generationTriggerFilterMode: form.generationTriggerFilterMode,
    generationTriggerFilters: form.generationTriggerFilters,
    additionalMatchingSources: form.additionalMatchingSources,
    role: form.role,
    sticky: form.sticky,
    cooldown: form.cooldown,
    delay: form.delay,
    ephemeral: form.ephemeral,
    group: form.group,
    tag: form.tag,
    locked: form.locked,
    preventRecursion: form.preventRecursion,
    excludeFromVectorization: form.excludeFromVectorization,
  };
  const name = typeof form.name === "string" ? form.name.trim() : "";
  if (name) payload.name = name;
  return payload;
}

function FilterModeSelect({
  value,
  onChange,
}: {
  value: LorebookFilterMode;
  onChange: (value: LorebookFilterMode) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as LorebookFilterMode)}
      className="h-7 rounded-lg bg-[var(--secondary)] px-2 text-[0.6875rem] ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
    >
      {(["any", "include", "exclude"] as LorebookFilterMode[]).map((mode) => (
        <option key={mode} value={mode}>
          {FILTER_MODE_LABEL[mode]}
        </option>
      ))}
    </select>
  );
}

function FilterPills({
  values,
  selected,
  onChange,
  emptyLabel,
}: {
  values: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  if (values.length === 0) {
    return <p className="text-[0.625rem] text-[var(--muted-foreground)]">{emptyLabel}</p>;
  }

  return (
    <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto pr-1">
      {values.map((item) => {
        const active = selected.includes(item.value);
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(toggleStringValue(selected, item.value))}
            className={cn(
              "rounded-full px-2 py-0.5 text-[0.625rem] ring-1 transition-colors",
              active
                ? "bg-amber-400/15 text-amber-300 ring-amber-400/30"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] ring-[var(--border)] hover:text-[var(--foreground)]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function LorebookEntryDrawer({
  entry,
  lorebookId,
  characters,
  characterTags,
}: {
  entry: LorebookEntry;
  lorebookId: string;
  characters: Array<{ id: string; name: string; tags: string[] }>;
  characterTags: string[];
}) {
  const { mutate: mutateEntry, mutateAsync: mutateEntryAsync } = useUpdateLorebookEntry();
  const [form, setForm] = useState<Partial<LorebookEntry>>(() => ({ ...entry }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const loadedEntryIdRef = useRef(entry.id);
  const formRef = useRef<Partial<LorebookEntry>>({ ...entry });
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const changeVersionRef = useRef(0);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const saveNowRef = useRef<() => Promise<void>>(async () => {});
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const drawerStatus = deriveStatus(entry);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const queueAutosave = useCallback(
    (delay = ENTRY_AUTOSAVE_DELAY_MS) => {
      clearAutosaveTimer();
      autosaveTimerRef.current = setTimeout(() => {
        void saveNowRef.current();
      }, delay);
    },
    [clearAutosaveTimer],
  );

  const saveNow = useCallback(async () => {
    clearAutosaveTimer();
    if (!dirtyRef.current) return;
    if (savePromiseRef.current) {
      await savePromiseRef.current;
      return;
    }

    savePromiseRef.current = (async () => {
      const versionAtStart = changeVersionRef.current;
      const entryIdAtStart = loadedEntryIdRef.current;
      const snapshot = formRef.current;
      savingRef.current = true;
      if (mountedRef.current) {
        setSaving(true);
        setSaveError(false);
      }

      try {
        await mutateEntryAsync({
          lorebookId,
          entryId: entryIdAtStart,
          ...buildEntrySavePayload(snapshot),
        });

        if (!mountedRef.current) return;
        if (changeVersionRef.current === versionAtStart) {
          dirtyRef.current = false;
          setDirty(false);
        } else {
          queueAutosave();
        }
      } catch {
        if (!mountedRef.current) return;
        dirtyRef.current = true;
        setDirty(true);
        setSaveError(true);
      } finally {
        savingRef.current = false;
        savePromiseRef.current = null;
        if (mountedRef.current) setSaving(false);
      }
    })();
    await savePromiseRef.current;
  }, [clearAutosaveTimer, lorebookId, mutateEntryAsync, queueAutosave]);

  useEffect(() => {
    saveNowRef.current = saveNow;
  }, [saveNow]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAutosaveTimer();
      if (dirtyRef.current) {
        mutateEntry({
          lorebookId,
          entryId: loadedEntryIdRef.current,
          ...buildEntrySavePayload(formRef.current),
        });
      }
    };
  }, [clearAutosaveTimer, lorebookId, mutateEntry]);

  useEffect(() => {
    let cancelled = false;

    const syncEntry = async () => {
      const switched = loadedEntryIdRef.current !== entry.id;
      if (switched && dirtyRef.current) {
        await saveNowRef.current();
        if (cancelled || dirtyRef.current) return;
      }

      if (cancelled) return;
      if (switched || (!dirtyRef.current && !savingRef.current)) {
        const next = { ...entry };
        formRef.current = next;
        setForm(next);
        dirtyRef.current = false;
        setDirty(false);
        setSaveError(false);
        loadedEntryIdRef.current = entry.id;
      }
    };

    void syncEntry();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const update = useCallback(
    (patch: Partial<LorebookEntry>) => {
      changeVersionRef.current += 1;
      dirtyRef.current = true;
      setDirty(true);
      setSaveError(false);
      const next = { ...formRef.current, ...patch };
      formRef.current = next;
      setForm(next);
      queueAutosave();
    },
    [queueAutosave],
  );

  const flushAutosave = useCallback(() => {
    void saveNowRef.current();
  }, []);

  return (
    <div
      className="space-y-4 border-t border-[var(--border)] px-3 py-3 sm:px-4"
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        flushAutosave();
      }}
    >
      <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/55 px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
        <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", STATUS_DOT_COLOR[drawerStatus])} />
        <p>{STATUS_DESCRIPTION[drawerStatus]}</p>
      </div>

      <FieldGroup
        label="Description"
        icon={FileText}
        help="Brief summary of what this entry is about. Used by the Knowledge Router agent to decide whether to inject this entry — not sent to the main AI as content."
      >
        <textarea
          value={form.description ?? ""}
          onChange={(e) => update({ description: e.target.value })}
          onBlur={flushAutosave}
          rows={2}
          className="w-full resize-y rounded-lg bg-[var(--secondary)] px-2.5 py-2 text-sm ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          placeholder="Brief summary of what this entry is about (used by Knowledge Router agent)."
        />
      </FieldGroup>

      <FieldGroup
        label="Primary Keys"
        icon={Key}
        help="Keywords that trigger this entry. When any of these words appear in the chat, this entry's content is injected into the AI's context."
      >
        <KeysEditor keys={form.keys ?? []} onChange={(keys) => update({ keys })} />
      </FieldGroup>

      <FieldGroup
        label="Secondary Keys"
        icon={Key}
        help="Additional keywords used with AND/OR/NOT logic. 'AND' means both primary AND secondary must match. 'NOT' means primary must match but secondary must NOT."
      >
        <KeysEditor keys={form.secondaryKeys ?? []} onChange={(keys) => update({ secondaryKeys: keys })} />
        <div className="mt-2 flex items-center gap-3">
          <label className="text-[0.6875rem] text-[var(--muted-foreground)]">Logic:</label>
          {(["and", "or", "not"] as const).map((logic) => (
            <button
              key={logic}
              onClick={() => update({ selectiveLogic: logic })}
              className={cn(
                "rounded-md px-2 py-0.5 text-[0.6875rem] font-medium transition-colors",
                form.selectiveLogic === logic
                  ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]",
              )}
            >
              {logic.toUpperCase()}
            </button>
          ))}
        </div>
      </FieldGroup>

      <details className="rounded-lg border border-[var(--border)] bg-[var(--card)]/40 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-[var(--foreground)]">
          Context filters & matching sources
        </summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-2 rounded-lg bg-[var(--secondary)]/45 p-2 ring-1 ring-[var(--border)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-medium">Characters</span>
                <FilterModeSelect
                  value={form.characterFilterMode ?? "any"}
                  onChange={(value) => update({ characterFilterMode: value })}
                />
              </div>
              <FilterPills
                values={characters.map((character) => ({ value: character.id, label: character.name }))}
                selected={form.characterFilterIds ?? []}
                onChange={(next) => update({ characterFilterIds: next })}
                emptyLabel="No characters available."
              />
            </div>

            <div className="space-y-2 rounded-lg bg-[var(--secondary)]/45 p-2 ring-1 ring-[var(--border)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-medium">Character tags</span>
                <FilterModeSelect
                  value={form.characterTagFilterMode ?? "any"}
                  onChange={(value) => update({ characterTagFilterMode: value })}
                />
              </div>
              <FilterPills
                values={characterTags.map((tag) => ({ value: tag, label: tag }))}
                selected={form.characterTagFilters ?? []}
                onChange={(next) => update({ characterTagFilters: next })}
                emptyLabel="No character tags available."
              />
            </div>

            <div className="space-y-2 rounded-lg bg-[var(--secondary)]/45 p-2 ring-1 ring-[var(--border)]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[0.6875rem] font-medium">Generation</span>
                <FilterModeSelect
                  value={form.generationTriggerFilterMode ?? "any"}
                  onChange={(value) => update({ generationTriggerFilterMode: value })}
                />
              </div>
              <FilterPills
                values={GENERATION_TRIGGER_OPTIONS}
                selected={form.generationTriggerFilters ?? []}
                onChange={(next) => update({ generationTriggerFilters: next })}
                emptyLabel="No trigger filters available."
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-[var(--secondary)]/45 p-2 ring-1 ring-[var(--border)]">
            <div>
              <p className="text-[0.6875rem] font-medium">Additional matching sources</p>
              <p className="text-[0.625rem] text-[var(--muted-foreground)]">
                Optional card fields to scan for this entry&apos;s keywords in addition to recent chat.
              </p>
            </div>
            <FilterPills
              values={MATCHING_SOURCE_OPTIONS}
              selected={form.additionalMatchingSources ?? []}
              onChange={(next) => update({ additionalMatchingSources: next as LorebookMatchingSource[] })}
              emptyLabel="No sources available."
            />
          </div>
        </div>
      </details>

      <FieldGroup
        label="Content"
        icon={FileText}
        help="The text that gets injected into the AI's context when this entry activates. Write it as you'd want the AI to know it."
      >
        <ExpandableTextarea
          value={form.content ?? ""}
          onChange={(v) => update({ content: v })}
          onBlur={flushAutosave}
          onCommit={flushAutosave}
          rows={5}
          placeholder="The content that will be injected into the prompt when this entry activates…"
          title="Edit Content"
        />
        <p className="mt-1 flex items-center gap-1 text-[0.625rem] text-[var(--muted-foreground)]">
          <Hash size="0.5625rem" />~{estimateTokens(form.content ?? "").toLocaleString()} tokens
        </p>
      </FieldGroup>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <ToggleButton
          label="Whole Words"
          value={form.matchWholeWords ?? false}
          onChange={(v) => update({ matchWholeWords: v })}
        />
        <ToggleButton
          label="Case Sensitive"
          value={form.caseSensitive ?? false}
          onChange={(v) => update({ caseSensitive: v })}
        />
        <ToggleButton
          label="Locked"
          value={form.locked ?? false}
          onChange={(v) => update({ locked: v })}
          tooltip="Prevents the Lorebook Keeper agent from modifying this entry."
        />
        <ToggleButton
          label="No Recursion"
          value={form.preventRecursion ?? false}
          onChange={(v) => update({ preventRecursion: v })}
          tooltip="When enabled, this entry's content won't trigger additional entries during recursive scanning."
        />
        <ToggleButton
          label="No Vector"
          value={form.excludeFromVectorization ?? false}
          onChange={(v) => update({ excludeFromVectorization: v })}
          tooltip="When enabled, bulk vectorization skips this entry and removes any stored embedding."
        />
      </div>

      <FieldGroup
        label="Role"
        icon={Settings2}
        help="Which role this entry's content is attributed to in the prompt (only meaningful when injected at depth)."
      >
        <select
          value={form.role ?? "system"}
          onChange={(e) => update({ role: e.target.value as "system" | "user" | "assistant" })}
          className="w-full max-w-xs rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        >
          <option value="system">System</option>
          <option value="user">User</option>
          <option value="assistant">Assistant</option>
        </select>
      </FieldGroup>

      <FieldGroup
        label="Timing"
        icon={Settings2}
        help="Sticky = stays active for N messages after triggering. Cooldown = waits N messages before it can trigger again. Delay = waits N messages before first activation. Ephemeral = auto-disables after N activations (0 = unlimited)."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <NumberField
            label="Sticky"
            value={form.sticky ?? 0}
            onChange={(v) => update({ sticky: v || null })}
            min={0}
          />
          <NumberField
            label="Cooldown"
            value={form.cooldown ?? 0}
            onChange={(v) => update({ cooldown: v || null })}
            min={0}
          />
          <NumberField label="Delay" value={form.delay ?? 0} onChange={(v) => update({ delay: v || null })} min={0} />
          <NumberField
            label="Ephemeral"
            value={form.ephemeral ?? 0}
            onChange={(v) => update({ ephemeral: v || null })}
            min={0}
          />
        </div>
      </FieldGroup>

      <FieldGroup
        label="Group & Tag"
        icon={Settings2}
        help="Group entries together so only one from the group activates at a time. Tags are for your own organization."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[0.6875rem] text-[var(--muted-foreground)]">Group</label>
            <input
              value={form.group ?? ""}
              onChange={(e) => update({ group: e.target.value })}
              onBlur={flushAutosave}
              className="w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="Group name"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.6875rem] text-[var(--muted-foreground)]">Tag</label>
            <input
              value={form.tag ?? ""}
              onChange={(e) => update({ tag: e.target.value })}
              onBlur={flushAutosave}
              className="w-full rounded-lg bg-[var(--secondary)] px-2 py-1.5 text-xs ring-1 ring-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              placeholder="e.g. location, item, lore"
            />
          </div>
        </div>
      </FieldGroup>

      <div className="flex items-center justify-end border-t border-[var(--border)] pt-3">
        <span
          className={cn("text-[0.6875rem]", saveError ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]")}
        >
          {saveError
            ? "Autosave failed. Your edits are still here and will retry when you change the entry again."
            : saving
              ? "Saving…"
              : dirty
                ? "Autosaving…"
                : "Saved automatically"}
        </span>
      </div>
    </div>
  );
}
