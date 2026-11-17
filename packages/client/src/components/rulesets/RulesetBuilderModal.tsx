// ──────────────────────────────────────────────
// The ruleset builder: make a small ruleset in a form, or open one it made before
//
// A freeform sheet with real dice is a small ruleset: how a check rolls, what it is rolled against,
// the stats and skills it reads, and what play spends and fills. The form asks for those, and the
// shared builder writes an ordinary ruleset, which is saved like an imported one. Everything a ruleset
// gets comes with it: the sheet, the Engine's dice, the narrator's teaching, Game Mode.
// ──────────────────────────────────────────────
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation as useUiTranslation } from "react-i18next";
import {
  RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE,
  RULESET_BUILDER_GUIDANCE_MAX,
  RULESET_BUILDER_MAX,
  RULESET_BUILDER_REFERENCE_MAX,
  rulesetBuilderDefaultCheckGuidance,
  rulesetBuilderFreeId,
  rulesetBuilderKey,
  rulesetBuilderPresetOf,
  rulesetBuilderProblems,
  rulesetBuilderStarter,
  rulesetFromBuilderDraft,
  type InstalledRuleset,
  type RulesetBuilderDicePreset,
  type RulesetBuilderColumnType,
  type RulesetBuilderDisplay,
  type RulesetBuilderDraft,
  type RulesetBuilderList,
} from "@marinara-engine/shared";
import { DraftNumberInput } from "../ui/DraftNumberInput";
import { Modal } from "../ui/Modal";
import { useImportRuleset } from "../../hooks/use-capability-packages";
import { useTouchFolderDrag } from "../../hooks/use-touch-folder-drag";
import { insertLibraryItems } from "../../lib/library-order";
import { cn } from "../../lib/utils";
import { Checkbox } from "../ui/Checkbox";
import { Select } from "../ui/Select";

const PRESETS: RulesetBuilderDicePreset[] = ["d20", "2d6-bands", "pool", "highest", "percentile", "duality", "no-dice"];
/** A preset's localization key segment: keys take no dashes and start with a letter. */
const presetKey = (preset: RulesetBuilderDicePreset) =>
  preset === "2d6-bands" ? "bands" : preset === "no-dice" ? "noDice" : preset;

const INPUT =
  "w-full min-w-0 rounded-md bg-[var(--secondary)] px-2 py-1 text-xs text-[var(--foreground)] ring-1 ring-[var(--border)] focus:outline-none focus:ring-[var(--ring)]";
const NUMBER = cn(INPUT, "w-16 shrink-0 tabular-nums");

function Group({
  title,
  help,
  children,
  onAdd,
}: {
  title: string;
  help?: string;
  children: ReactNode;
  onAdd?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <section className="space-y-1.5 rounded-xl bg-[var(--muted)]/15 p-3 ring-1 ring-[var(--border)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          {title}
        </h3>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={localizeUi("rulesetBuilder.addTo", { section: title })}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)]"
          >
            <Plus size="0.6875rem" />
            {localizeUi("rulesetBuilder.add")}
          </button>
        )}
      </div>
      {help && <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">{help}</p>}
      {children}
    </section>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      title={localizeUi("rulesetBuilder.remove")}
      aria-label={localizeUi("rulesetBuilder.remove")}
      className="shrink-0 rounded-md p-1 text-[var(--destructive)] transition-colors hover:bg-[var(--accent)] active:scale-90"
    >
      <Trash2 size="0.75rem" />
    </button>
  );
}

/** The ruleset's own prompt text, each with how many lines its box opens with and its limit. */
const PROMPT_FIELDS = [
  { key: "checkGuidance", rows: 3, max: RULESET_BUILDER_GUIDANCE_MAX },
  { key: "sheetGuidance", rows: 3, max: RULESET_BUILDER_GUIDANCE_MAX },
  { key: "rulesReference", rows: 6, max: RULESET_BUILDER_REFERENCE_MAX },
  { key: "worldGuidance", rows: 2, max: RULESET_BUILDER_GUIDANCE_MAX },
] as const;

const COLUMN_TYPES: RulesetBuilderColumnType[] = ["text", "number", "check"];

const DISPLAYS = ["counter", "bar", "dots"] as const;

/** How the sheet draws a pool or track: the number alone, a fill bar, or a row of dots. */
function DisplayPicker({
  value,
  onChange,
}: {
  value: RulesetBuilderDisplay | undefined;
  onChange: (value: RulesetBuilderDisplay | undefined) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <Select
      value={value ?? "counter"}
      title={localizeUi("rulesetBuilder.displayHelp")}
      label={localizeUi("rulesetBuilder.display")}
      onChange={(next) => onChange(next === "counter" ? undefined : (next as RulesetBuilderDisplay))}
      className={cn(INPUT, "w-24 shrink-0")}
      options={DISPLAYS.map((display) => ({ value: display, label: localizeUi(`rulesetBuilder.displays.${display}`) }))}
    />
  );
}

/** One list: its name, the tab it shows on, and its columns after the name every row has. */
function ListEditor({
  list,
  onChange,
}: {
  list: RulesetBuilderList;
  onChange: (next: RulesetBuilderList | null) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <div className="space-y-1.5 rounded-lg p-2 ring-1 ring-[var(--border)]">
      <div className="flex items-center gap-1.5">
        <input
          value={list.label}
          placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
          aria-label={localizeUi("rulesetBuilder.listName")}
          onChange={(event) => onChange({ ...list, label: event.target.value })}
          className={INPUT}
        />
        <input
          value={list.tab ?? ""}
          placeholder={localizeUi("rulesetBuilder.listTabPlaceholder")}
          aria-label={localizeUi("rulesetBuilder.listTab")}
          onChange={(event) => onChange({ ...list, tab: event.target.value })}
          className={cn(INPUT, "w-32 shrink-0")}
        />
        <RemoveButton onClick={() => onChange(null)} />
      </div>
      <SortableRows
        kind="ruleset-builder-columns"
        rows={list.columns}
        label={(column) => column.label}
        onReorder={(rows) => onChange({ ...list, columns: rows })}
      >
        {(column, index) => (
          <div className="flex items-center gap-1.5">
            <input
              value={column.label}
              placeholder={localizeUi("rulesetBuilder.columnPlaceholder")}
              aria-label={localizeUi("rulesetBuilder.columnName")}
              onChange={(event) =>
                onChange({ ...list, columns: patchRow(list.columns, index, { ...column, label: event.target.value }) })
              }
              className={INPUT}
            />
            <Select
              value={column.type}
              label={localizeUi("rulesetBuilder.fieldType")}
              onChange={(next) =>
                onChange({
                  ...list,
                  columns: patchRow(list.columns, index, {
                    ...column,
                    type: next as RulesetBuilderColumnType,
                  }),
                })
              }
              className={cn(INPUT, "w-28 shrink-0")}
              options={COLUMN_TYPES.map((type) => ({
                value: type,
                label: localizeUi(`rulesetBuilder.columnTypes.${type}`),
              }))}
            />
            <RemoveButton onClick={() => onChange({ ...list, columns: patchRow(list.columns, index, null) })} />
          </div>
        )}
      </SortableRows>
      {list.columns.length < RULESET_BUILDER_MAX.columns && (
        <button
          type="button"
          onClick={() =>
            onChange({ ...list, columns: [...list.columns, { key: rulesetBuilderKey(), label: "", type: "text" }] })
          }
          className="ml-5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] text-[var(--muted-foreground)] ring-1 ring-[var(--border)] transition-colors hover:text-[var(--foreground)]"
        >
          <Plus size="0.6875rem" />
          {localizeUi("rulesetBuilder.addColumn")}
        </button>
      )}
    </div>
  );
}

/**
 * Rows the author puts in order by their grip: dragged with the mouse or a finger, or moved with the
 * arrow keys on the grip. The order is the order the sheet shows them in. Built on the drag the
 * Engine's lists already use, so a row is picked up and dropped the same way everywhere.
 */
function SortableRows<T>({
  kind,
  rows,
  label,
  onReorder,
  children,
}: {
  kind: string;
  rows: T[];
  label: (row: T) => string;
  onReorder: (rows: T[]) => void;
  children: (row: T, index: number) => ReactNode;
}) {
  const { t: localizeUi } = useUiTranslation();
  // One kind per list, so a column cannot be dropped into another list's columns. The kind becomes part
  // of an attribute selector, so it keeps to letters, digits and dashes.
  const dragKind = `${kind}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const container = useRef<HTMLDivElement>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const ids = rows.map((_, index) => String(index));
  const { startTouchDrag } = useTouchFolderDrag({
    onActivate: setDragged,
    onReorder: (moved, target, edge) => {
      setDragged(null);
      const order = insertLibraryItems(ids, moved, target, edge);
      if (order.some((id, index) => id !== ids[index])) onReorder(order.map((id) => rows[Number(id)]!));
    },
    onDrop: () => setDragged(null),
    onCancel: () => setDragged(null),
  });
  const moveWithKeys = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const to = event.key === "ArrowUp" ? index - 1 : event.key === "ArrowDown" ? index + 1 : -1;
    if (to < 0 || to >= rows.length) return;
    event.preventDefault();
    const next = [...rows];
    [next[index], next[to]] = [next[to]!, next[index]!];
    onReorder(next);
    // The grip keeps focus as its row moves, so the keys can carry it further.
    requestAnimationFrame(() =>
      container.current
        ?.querySelector<HTMLButtonElement>(`[data-drag-id="${to}"] > [data-folder-drag-handle]`)
        ?.focus(),
    );
  };
  return (
    <div ref={container} className="space-y-1.5">
      {rows.map((row, index) => (
        <div
          key={index}
          data-drag-kind={dragKind}
          data-drag-id={String(index)}
          className={cn("flex items-start gap-1", dragged === String(index) && "opacity-40")}
        >
          <button
            type="button"
            data-folder-drag-handle=""
            aria-label={localizeUi("rulesetBuilder.reorder", {
              name: label(row).trim() || localizeUi("rulesetBuilder.reorderUnnamed", { number: index + 1 }),
            })}
            title={localizeUi("rulesetBuilder.reorderHint")}
            onMouseDown={(event) =>
              startTouchDrag(event, String(index), {
                sourceElement: event.currentTarget.parentElement,
                allowInteractiveTarget: true,
              })
            }
            onTouchStart={(event) => {
              event.stopPropagation();
              startTouchDrag(event, String(index), {
                sourceElement: event.currentTarget.parentElement,
                allowInteractiveTarget: true,
              });
            }}
            onKeyDown={(event) => moveWithKeys(event, index)}
            className="mt-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] active:cursor-grabbing"
          >
            <GripVertical size="0.875rem" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">{children(row, index)}</div>
        </div>
      ))}
    </div>
  );
}

/** Replace row `index` of a list with `next`, or remove it with null. */
function patchRow<T>(rows: T[], index: number, next: T | null): T[] {
  return next === null ? rows.filter((_, at) => at !== index) : rows.map((row, at) => (at === index ? next : row));
}

export function RulesetBuilderModal({
  open,
  onClose,
  initial,
  installedVersion,
  installed,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** A ruleset the form can hold, to edit; a new one when absent. */
  initial?: RulesetBuilderDraft | null;
  /** The newest stored version of the ruleset being edited, so the save is the next one. */
  installedVersion?: number;
  /** The installed rulesets: a new one takes an id none of them has, and the form points at a shipped one
   *  that already rolls the chosen way. */
  installed: InstalledRuleset[];
  onSaved?: (rulesetId: string) => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const importRuleset = useImportRuleset();
  const editing = Boolean(initial);
  const [draft, setDraft] = useState<RulesetBuilderDraft>(() => initial ?? rulesetBuilderStarter("d20"));
  const [saving, setSaving] = useState(false);
  // Each skill group once, as the author spelled it first, for the groups a practice meter may leave out.
  const skillGroups = draft.skills.reduce<string[]>((groups, skill) => {
    const group = skill.group?.trim();
    return group && !groups.some((entry) => entry.toLowerCase() === group.toLowerCase()) ? [...groups, group] : groups;
  }, []);
  const set = (patch: Partial<RulesetBuilderDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const namedAbilities = draft.abilities.filter((ability) => ability.label.trim());
  // Every ruleset is its own sheet on each character, and sheets don't carry between rulesets (#9017).
  // So a new ruleset hears which installed ones already roll the chosen way: a package to play, or one
  // of the player's own to keep using.
  const alike = editing
    ? []
    : installed.filter((entry) => rulesetBuilderPresetOf(entry.definition.resolution) === draft.dice.preset);
  const shipped = alike.filter((entry) => entry.packageId);
  const yours = alike.filter((entry) => !entry.packageId);
  const ladderHelp = draft.dice.preset === "pool" ? "rulesetBuilder.ladderHelpPool" : "rulesetBuilder.ladderHelp";

  const choosePreset = (preset: RulesetBuilderDicePreset) => {
    // A new ruleset still on its starter takes the family's usual stats with its dice; one being edited,
    // or one the player has already filled in, keeps its own.
    const untouched =
      !editing &&
      JSON.stringify(rulesetFromBuilderDraft(draft)) ===
        JSON.stringify(
          rulesetFromBuilderDraft({
            ...rulesetBuilderStarter(draft.dice.preset, draft.name),
            name: draft.name,
            id: draft.id,
          }),
        );
    if (!untouched) {
      const starter = rulesetBuilderStarter(preset);
      set({ dice: { ...starter.dice }, ...(draft.ladder.length === 0 ? { ladder: starter.ladder } : {}) });
    } else setDraft({ ...rulesetBuilderStarter(preset, draft.name), name: draft.name, id: draft.id });
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error(localizeUi("rulesetBuilder.nameRequired"));
      return;
    }
    // Saving never drops a row the form shows, so a row it could not write stops the save instead.
    const problem = rulesetBuilderProblems(draft)[0];
    if (problem) {
      toast.error(localizeUi(`rulesetBuilder.problems.${problem}`));
      return;
    }
    // An unchanged ruleset stays the version it is, rather than another copy of it.
    if (
      editing &&
      initial &&
      JSON.stringify(rulesetFromBuilderDraft(draft)) === JSON.stringify(rulesetFromBuilderDraft(initial))
    ) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const version = editing ? (installedVersion ?? 0) + 1 : 1;
      const id = editing
        ? draft.id
        : rulesetBuilderFreeId(
            draft.name,
            installed.map((entry) => entry.definition.id),
          );
      const definition = rulesetFromBuilderDraft({ ...draft, id }, version);
      const saved = await importRuleset.mutateAsync(JSON.stringify(definition, null, 2));
      toast.success(localizeUi("rulesetBuilder.saved", { name: draft.name }));
      onSaved?.(saved.rulesetId);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : localizeUi("rulesetBuilder.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      // A save in flight finishes and pins either way, so the form stays until it does.
      closeDisabled={saving}
      title={localizeUi(editing ? "rulesetBuilder.editTitle" : "rulesetBuilder.newTitle")}
      width="max-w-2xl"
      mobileFullscreen
    >
      <div className="space-y-3">
        <Group title={localizeUi("rulesetBuilder.about")}>
          <label className="block space-y-1">
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">{localizeUi("rulesetBuilder.name")}</span>
            <input value={draft.name} onChange={(event) => set({ name: event.target.value })} className={INPUT} />
          </label>
          <label className="block space-y-1">
            <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
              {localizeUi("rulesetBuilder.summary")}
            </span>
            <input
              value={draft.summary ?? ""}
              onChange={(event) => set({ summary: event.target.value })}
              className={INPUT}
            />
          </label>
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.dice")}
          help={localizeUi(`rulesetBuilder.presets.${presetKey(draft.dice.preset)}.help`)}
        >
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={draft.dice.preset === preset}
                onClick={() => choosePreset(preset)}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-left text-[0.6875rem] font-medium ring-1 transition-colors",
                  draft.dice.preset === preset
                    ? "bg-[var(--primary)]/15 text-[var(--primary)] ring-[var(--primary)]/60"
                    : "text-[var(--foreground)] ring-[var(--border)] hover:bg-[var(--accent)]",
                )}
              >
                {localizeUi(`rulesetBuilder.presets.${presetKey(preset)}.label`)}
              </button>
            ))}
          </div>
          {shipped.length > 0 && (
            <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
              {localizeUi("rulesetBuilder.shipped", {
                names: shipped.map((entry) => entry.definition.name).join(", "),
              })}
            </p>
          )}
          {yours.length > 0 && (
            <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
              {localizeUi("rulesetBuilder.yours", {
                names: yours.map((entry) => entry.definition.name).join(", "),
              })}
            </p>
          )}
          {draft.dice.preset === "pool" && (
            <div className="flex flex-wrap items-center gap-2 text-[0.6875rem] text-[var(--muted-foreground)]">
              <div className="flex items-center gap-1.5">
                {localizeUi("rulesetBuilder.poolSides")}
                <Select
                  value={String(draft.dice.sides ?? 10)}
                  label={localizeUi("rulesetBuilder.poolSides")}
                  onChange={(next) => set({ dice: { ...draft.dice, sides: Number(next) } })}
                  className={NUMBER}
                  options={[6, 10].map((sides) => ({
                    value: String(sides),
                    label: localizeUi("ui.dice.diceglyph.dValue1", { value1: sides }),
                  }))}
                />
              </div>
              <label className="flex items-center gap-1.5">
                {localizeUi("rulesetBuilder.poolTarget")}
                <DraftNumberInput
                  value={draft.dice.target ?? 6}
                  commitOnValidChange
                  onCommit={(value) => set({ dice: { ...draft.dice, target: value } })}
                  className={NUMBER}
                />
              </label>
            </div>
          )}
        </Group>

        {draft.dice.preset !== "highest" && (
          <Group
            title={localizeUi("rulesetBuilder.ladder")}
            help={localizeUi(ladderHelp)}
            onAdd={
              draft.ladder.length < RULESET_BUILDER_MAX.ladder
                ? () => set({ ladder: [...draft.ladder, { label: "", value: 0 }] })
                : undefined
            }
          >
            <SortableRows
              kind="ruleset-builder-ladder"
              rows={draft.ladder}
              label={(step) => step.label}
              onReorder={(rows) => set({ ladder: rows })}
            >
              {(step, index) => (
                <div className="flex items-center gap-1.5">
                  <input
                    value={step.label}
                    placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
                    aria-label={localizeUi("rulesetBuilder.difficultyName")}
                    onChange={(event) =>
                      set({ ladder: patchRow(draft.ladder, index, { ...step, label: event.target.value }) })
                    }
                    className={INPUT}
                  />
                  <DraftNumberInput
                    value={step.value}
                    ariaLabel={localizeUi(
                      draft.dice.preset === "pool"
                        ? "rulesetBuilder.difficultySuccesses"
                        : "rulesetBuilder.difficultyNumber",
                    )}
                    commitOnValidChange
                    onCommit={(value) =>
                      set({
                        ladder: patchRow(draft.ladder, index, {
                          ...step,
                          value,
                        }),
                      })
                    }
                    className={NUMBER}
                  />
                  <RemoveButton onClick={() => set({ ladder: patchRow(draft.ladder, index, null) })} />
                </div>
              )}
            </SortableRows>
          </Group>
        )}

        <Group
          title={localizeUi("rulesetBuilder.abilities")}
          help={localizeUi("rulesetBuilder.abilitiesHelp")}
          onAdd={
            draft.abilities.length < RULESET_BUILDER_MAX.abilities
              ? () =>
                  set({
                    abilities: [
                      ...draft.abilities,
                      { key: rulesetBuilderKey(), label: "", min: 0, max: 5, default: 0 },
                    ],
                  })
              : undefined
          }
        >
          {draft.abilities.length > 0 && (
            <div className="hidden gap-1.5 px-0.5 text-[0.625rem] uppercase tracking-wider text-[var(--muted-foreground)] sm:flex">
              {/* Lines up with the rows, which start with their grip. */}
              <span className="w-4 shrink-0" />
              <span className="flex-1">{localizeUi("rulesetBuilder.labelPlaceholder")}</span>
              <span className="w-28">{localizeUi("rulesetBuilder.skillGroup")}</span>
              <span className="w-16">{localizeUi("rulesetBuilder.min")}</span>
              <span className="w-16">{localizeUi("rulesetBuilder.max")}</span>
              <span className="w-16">{localizeUi("rulesetBuilder.default")}</span>
              <span className="w-6" />
            </div>
          )}
          <SortableRows
            kind="ruleset-builder-abilities"
            rows={draft.abilities}
            label={(ability) => ability.label}
            onReorder={(rows) => set({ abilities: rows })}
          >
            {(ability, index) => (
              // On a phone the name and group take the first line and each number carries its own caption on
              // the second, since the header row above only lines up on a wider screen.
              <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                <input
                  value={ability.label}
                  aria-label={localizeUi("rulesetBuilder.labelPlaceholder")}
                  onChange={(event) =>
                    set({ abilities: patchRow(draft.abilities, index, { ...ability, label: event.target.value }) })
                  }
                  className={cn(INPUT, "basis-0 flex-1")}
                />
                <input
                  value={ability.group ?? ""}
                  placeholder={localizeUi("rulesetBuilder.skillGroup")}
                  aria-label={localizeUi("rulesetBuilder.skillGroup")}
                  onChange={(event) =>
                    set({ abilities: patchRow(draft.abilities, index, { ...ability, group: event.target.value }) })
                  }
                  className={cn(INPUT, "w-24 shrink-0 sm:w-28")}
                />
                <div className="basis-full sm:hidden" />
                {(["min", "max", "default"] as const).map((key) => (
                  <label key={key} className="flex min-w-0 flex-1 items-center gap-1 sm:flex-none">
                    <span className="text-[0.625rem] uppercase tracking-wider text-[var(--muted-foreground)] sm:hidden">
                      {localizeUi(`rulesetBuilder.${key}`)}
                    </span>
                    <DraftNumberInput
                      value={ability[key]}
                      ariaLabel={localizeUi(`rulesetBuilder.${key}`)}
                      commitOnValidChange
                      onCommit={(value) =>
                        set({
                          abilities: patchRow(draft.abilities, index, {
                            ...ability,
                            [key]: value,
                          }),
                        })
                      }
                      className={cn(NUMBER, "w-auto min-w-0 flex-1 sm:w-16 sm:flex-none")}
                    />
                  </label>
                ))}
                <RemoveButton onClick={() => set({ abilities: patchRow(draft.abilities, index, null) })} />
              </div>
            )}
          </SortableRows>
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.skills")}
          help={localizeUi("rulesetBuilder.skillsHelp")}
          onAdd={
            draft.skills.length < RULESET_BUILDER_MAX.skills
              ? () =>
                  set({
                    skills: [
                      ...draft.skills,
                      { key: rulesetBuilderKey(), label: "", ability: namedAbilities[0]?.key ?? "" },
                    ],
                  })
              : undefined
          }
        >
          <SortableRows
            kind="ruleset-builder-skills"
            rows={draft.skills}
            label={(skill) => skill.label}
            onReorder={(rows) => set({ skills: rows })}
          >
            {(skill, index) => (
              // Four controls do not fit a phone's width, so the name takes its own line there.
              <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
                <input
                  value={skill.label}
                  placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
                  aria-label={localizeUi("rulesetBuilder.labelPlaceholder")}
                  onChange={(event) =>
                    set({ skills: patchRow(draft.skills, index, { ...skill, label: event.target.value }) })
                  }
                  className={cn(INPUT, "basis-full sm:basis-0 sm:flex-1")}
                />
                <input
                  value={skill.group ?? ""}
                  placeholder={localizeUi("rulesetBuilder.skillGroup")}
                  aria-label={localizeUi("rulesetBuilder.skillGroup")}
                  onChange={(event) =>
                    set({ skills: patchRow(draft.skills, index, { ...skill, group: event.target.value }) })
                  }
                  className={cn(INPUT, "w-auto flex-1 sm:w-28 sm:flex-none")}
                />
                <Select
                  value={namedAbilities.some((ability) => ability.key === skill.ability) ? skill.ability : null}
                  label={localizeUi("rulesetBuilder.skillAbility")}
                  // A skill whose stat was removed says so, rather than seeming to roll with the first one.
                  placeholder={localizeUi("rulesetBuilder.chooseStat")}
                  onChange={(next) => set({ skills: patchRow(draft.skills, index, { ...skill, ability: next }) })}
                  className={cn(INPUT, "w-auto flex-1 sm:w-36 sm:flex-none")}
                  options={namedAbilities.map((ability) => ({ value: ability.key, label: ability.label }))}
                />
                <RemoveButton onClick={() => set({ skills: patchRow(draft.skills, index, null) })} />
              </div>
            )}
          </SortableRows>
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.ranks")}
          help={localizeUi("rulesetBuilder.ranksHelp")}
          onAdd={
            draft.ranks.length < RULESET_BUILDER_MAX.ranks
              ? () =>
                  set({
                    ranks: [
                      ...draft.ranks,
                      { key: rulesetBuilderKey(), label: "", bonus: (draft.ranks.at(-1)?.bonus ?? 0) + 1 },
                    ],
                  })
              : undefined
          }
        >
          <SortableRows
            kind="ruleset-builder-ranks"
            rows={draft.ranks}
            label={(rank) => rank.label}
            onReorder={(rows) => set({ ranks: rows })}
          >
            {(rank, index) => (
              <div className="flex items-center gap-1.5">
                <input
                  value={rank.label}
                  placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
                  aria-label={localizeUi("rulesetBuilder.rankName")}
                  onChange={(event) =>
                    set({ ranks: patchRow(draft.ranks, index, { ...rank, label: event.target.value }) })
                  }
                  className={INPUT}
                />
                <DraftNumberInput
                  value={rank.bonus}
                  ariaLabel={localizeUi("rulesetBuilder.rankBonus")}
                  commitOnValidChange
                  onCommit={(value) =>
                    set({
                      ranks: patchRow(draft.ranks, index, { ...rank, bonus: value }),
                    })
                  }
                  className={NUMBER}
                />
                <RemoveButton onClick={() => set({ ranks: patchRow(draft.ranks, index, null) })} />
              </div>
            )}
          </SortableRows>
          <label className="flex items-center gap-2 pt-1 text-xs text-[var(--foreground)]">
            <Checkbox checked={draft.practice === true} onChange={(event) => set({ practice: event.target.checked })} />
            {localizeUi("rulesetBuilder.practice")}
          </label>
          <p className="text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
            {localizeUi("rulesetBuilder.practiceHelp")}
          </p>
          {draft.practice && skillGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--foreground)]">
              <span className="text-[0.6875rem] text-[var(--muted-foreground)]">
                {localizeUi("rulesetBuilder.practiceExcept")}
              </span>
              {skillGroups.map((group) => (
                <label key={group} className="flex items-center gap-1">
                  <Checkbox
                    checked={(draft.practiceExcept ?? []).some((entry) => entry.toLowerCase() === group.toLowerCase())}
                    onChange={(event) =>
                      set({
                        practiceExcept: event.target.checked
                          ? [...(draft.practiceExcept ?? []), group]
                          : (draft.practiceExcept ?? []).filter((entry) => entry.toLowerCase() !== group.toLowerCase()),
                      })
                    }
                  />
                  {group}
                </label>
              ))}
            </div>
          )}
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.pools")}
          help={localizeUi("rulesetBuilder.poolsHelp")}
          onAdd={
            draft.pools.length < RULESET_BUILDER_MAX.pools
              ? () => set({ pools: [...draft.pools, { key: rulesetBuilderKey(), label: "", max: 5 }] })
              : undefined
          }
        >
          <SortableRows
            kind="ruleset-builder-pools"
            rows={draft.pools}
            label={(pool) => pool.label}
            onReorder={(rows) => set({ pools: rows })}
          >
            {(pool, index) => (
              <div className="flex items-center gap-1.5">
                <input
                  value={pool.label}
                  placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
                  aria-label={localizeUi("rulesetBuilder.poolName")}
                  onChange={(event) =>
                    set({ pools: patchRow(draft.pools, index, { ...pool, label: event.target.value }) })
                  }
                  className={INPUT}
                />
                <DraftNumberInput
                  value={pool.max}
                  ariaLabel={localizeUi("rulesetBuilder.max")}
                  commitOnValidChange
                  onCommit={(value) =>
                    set({
                      pools: patchRow(draft.pools, index, { ...pool, max: value }),
                    })
                  }
                  className={NUMBER}
                />
                <DisplayPicker
                  value={pool.display}
                  onChange={(display) => set({ pools: patchRow(draft.pools, index, { ...pool, display }) })}
                />
                <RemoveButton onClick={() => set({ pools: patchRow(draft.pools, index, null) })} />
              </div>
            )}
          </SortableRows>
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.tracks")}
          help={localizeUi("rulesetBuilder.tracksHelp")}
          onAdd={
            draft.tracks.length < RULESET_BUILDER_MAX.tracks
              ? () => set({ tracks: [...draft.tracks, { key: rulesetBuilderKey(), label: "", min: 0, max: 5 }] })
              : undefined
          }
        >
          <SortableRows
            kind="ruleset-builder-tracks"
            rows={draft.tracks}
            label={(track) => track.label}
            onReorder={(rows) => set({ tracks: rows })}
          >
            {(track, index) => (
              <div className="flex items-center gap-1.5">
                <input
                  value={track.label}
                  placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
                  aria-label={localizeUi("rulesetBuilder.trackName")}
                  onChange={(event) =>
                    set({ tracks: patchRow(draft.tracks, index, { ...track, label: event.target.value }) })
                  }
                  className={INPUT}
                />
                {(["min", "max"] as const).map((key) => (
                  <DraftNumberInput
                    key={key}
                    value={track[key]}
                    ariaLabel={localizeUi(`rulesetBuilder.${key}`)}
                    commitOnValidChange
                    onCommit={(value) =>
                      set({
                        tracks: patchRow(draft.tracks, index, {
                          ...track,
                          [key]: value,
                        }),
                      })
                    }
                    className={NUMBER}
                  />
                ))}
                <DisplayPicker
                  value={track.display}
                  onChange={(display) => set({ tracks: patchRow(draft.tracks, index, { ...track, display }) })}
                />
                <RemoveButton onClick={() => set({ tracks: patchRow(draft.tracks, index, null) })} />
              </div>
            )}
          </SortableRows>
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.fields")}
          help={localizeUi("rulesetBuilder.fieldsHelp")}
          onAdd={
            draft.fields.length < RULESET_BUILDER_MAX.fields
              ? () => set({ fields: [...draft.fields, { key: rulesetBuilderKey(), label: "", type: "text" }] })
              : undefined
          }
        >
          <SortableRows
            kind="ruleset-builder-fields"
            rows={draft.fields}
            label={(field) => field.label}
            onReorder={(rows) => set({ fields: rows })}
          >
            {(field, index) => (
              <div className="flex items-center gap-1.5">
                <input
                  value={field.label}
                  placeholder={localizeUi("rulesetBuilder.labelPlaceholder")}
                  aria-label={localizeUi("rulesetBuilder.fieldName")}
                  onChange={(event) =>
                    set({ fields: patchRow(draft.fields, index, { ...field, label: event.target.value }) })
                  }
                  className={INPUT}
                />
                <Select
                  value={field.type}
                  label={localizeUi("rulesetBuilder.fieldType")}
                  onChange={(next) =>
                    set({
                      fields: patchRow(draft.fields, index, {
                        ...field,
                        type: next as "text" | "number",
                      }),
                    })
                  }
                  className={cn(INPUT, "w-28 shrink-0")}
                  options={[
                    { value: "text", label: localizeUi("rulesetBuilder.fieldText") },
                    { value: "number", label: localizeUi("rulesetBuilder.fieldNumber") },
                  ]}
                />
                <RemoveButton onClick={() => set({ fields: patchRow(draft.fields, index, null) })} />
              </div>
            )}
          </SortableRows>
        </Group>

        <Group
          title={localizeUi("rulesetBuilder.lists")}
          help={localizeUi("rulesetBuilder.listsHelp")}
          onAdd={
            draft.lists.length < RULESET_BUILDER_MAX.lists
              ? () => set({ lists: [...draft.lists, { key: rulesetBuilderKey(), label: "", columns: [] }] })
              : undefined
          }
        >
          <SortableRows
            kind="ruleset-builder-lists"
            rows={draft.lists}
            label={(list) => list.label}
            onReorder={(rows) => set({ lists: rows })}
          >
            {(list, index) => (
              <ListEditor list={list} onChange={(next) => set({ lists: patchRow(draft.lists, index, next) })} />
            )}
          </SortableRows>
        </Group>

        <Group title={localizeUi("rulesetBuilder.prompts")} help={localizeUi("rulesetBuilder.promptsHelp")}>
          {PROMPT_FIELDS.map(({ key, rows, max }) => (
            <label key={key} className="block space-y-1">
              <span className="text-[0.6875rem] font-medium text-[var(--foreground)]">
                {localizeUi(`rulesetBuilder.prompt.${key}.label`)}
              </span>
              <span className="block text-[0.6875rem] leading-snug text-[var(--muted-foreground)]">
                {localizeUi(`rulesetBuilder.prompt.${key}.help`)}
              </span>
              <textarea
                value={draft[key] ?? ""}
                rows={rows}
                maxLength={max}
                placeholder={
                  key === "checkGuidance"
                    ? rulesetBuilderDefaultCheckGuidance(draft.name)
                    : key === "sheetGuidance"
                      ? RULESET_BUILDER_DEFAULT_SHEET_GUIDANCE
                      : undefined
                }
                onChange={(event) => set({ [key]: event.target.value })}
                className={cn(INPUT, "resize-y")}
              />
            </label>
          ))}
        </Group>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs ring-1 ring-[var(--border)] transition-colors hover:bg-[var(--accent)] disabled:opacity-50"
          >
            {localizeUi("rulesetBuilder.cancel")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity disabled:opacity-50"
          >
            {localizeUi(editing ? "rulesetBuilder.saveEdit" : "rulesetBuilder.create")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
