import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { resourceResultType } from "../../../lib/command-icons";
import { getMariCommand } from "../../../lib/mari-commands";
import { isCommandRow, isFieldRow, type PickerRow, type ReferenceState } from "../../../lib/mari-composer-references";
import { ResultTypeIcon } from "../../command-center/ResultTypeIcon";
import { MariRow } from "../mari-primitives";

export type MariReferencePickerProps = {
  /** The listbox id; the textarea points at the active option with `aria-activedescendant`. */
  id: string;
  rows: readonly PickerRow[];
  activeIndex: number;
  /** Showing one lorebook's entries, or the open editor's fields, instead of the groups. */
  drilled: boolean;
  /** The open editor's row lists that editor's fields. */
  fieldsDrillable?: boolean;
  onPick: (index: number) => void;
  onDrill: (index: number) => void;
  /** Leaves the entries or fields for the groups (ArrowLeft's tap twin). */
  onBack?: () => void;
};

export const referenceOptionId = (listboxId: string, index: number) => `${listboxId}-option-${index}`;

const STATE_FACT_KEYS: Record<ReferenceState, string> = {
  always: "mari.composerReferences.state.always",
  on: "mari.composerReferences.state.on",
  off: "mari.composerReferences.state.off",
};

/**
 * The `@` / `/` picker above Professor Mari's composer: one column of grouped rows (commands, characters,
 * personas, lorebooks, presets, skills, memories), narrow enough for a phone and her 24rem companion pane. The textarea keeps focus and
 * owns the keys (see `composerKeyAction`); the rows only draw the choice and take a tap or click.
 */
export function MariReferencePicker({
  id,
  rows,
  activeIndex,
  drilled,
  fieldsDrillable = false,
  onPick,
  onDrill,
  onBack,
}: MariReferencePickerProps) {
  const { t } = useTranslation();
  const groupLabels: Record<PickerRow["group"], string> = {
    command: t("mari.composerReferences.group.command"),
    field: t("mari.composerReferences.group.field"),
    open: t("mari.composerReferences.group.open"),
    character: t("mari.composerReferences.group.character"),
    persona: t("mari.composerReferences.group.persona"),
    lorebook: t("mari.composerReferences.group.lorebook"),
    preset: t("mari.composerReferences.group.preset"),
    skill: t("mari.composerReferences.group.skill"),
    memory: t("mari.composerReferences.group.memory"),
    chat: t("mari.composerReferences.group.chat"),
    agent: t("mari.composerReferences.group.agent"),
    doc: t("mari.composerReferences.group.doc"),
    lorebookEntry: t("mari.composerReferences.group.lorebookEntry"),
  };
  useEffect(() => {
    document.getElementById(referenceOptionId(id, activeIndex))?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, id]);

  // Rows arrive grouped; a heading starts each run.
  const groups: Array<{ group: PickerRow["group"]; start: number; rows: PickerRow[] }> = [];
  rows.forEach((row, index) => {
    const last = groups[groups.length - 1];
    if (last?.group === row.group) last.rows.push(row);
    else groups.push({ group: row.group, start: index, rows: [row] });
  });

  return (
    <div
      id={id}
      role="listbox"
      aria-label={t("mari.composerReferences.listLabel")}
      className="mari-composer-menu__popover mari-reference-picker"
      data-component="MariReferencePicker"
      // Taps on the list must not steal focus from the textarea.
      onMouseDown={(event) => event.preventDefault()}
    >
      {groups.map((group) => (
        <div key={`${group.group}:${group.start}`} role="group" aria-labelledby={`${id}-group-${group.start}`}>
          <p id={`${id}-group-${group.start}`} className="mari-composer-menu__head">
            {groupLabels[group.group]}
          </p>
          {group.rows.map((row, offset) => {
            const index = group.start + offset;
            if (isCommandRow(row)) {
              const command = getMariCommand(row.command);
              return (
                <MariRow
                  key={row.key}
                  id={referenceOptionId(id, index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  slot={<command.Icon aria-hidden="true" />}
                  title={t(command.labelKey)}
                  fact={t(command.factKey)}
                  state={index === activeIndex ? "selected" : undefined}
                  onClick={() => onPick(index)}
                />
              );
            }
            if (isFieldRow(row)) {
              return (
                <MariRow
                  key={row.key}
                  id={referenceOptionId(id, index)}
                  role="option"
                  aria-selected={index === activeIndex}
                  // The pencil of her context row's field chip, which this pick sets.
                  slot={<Pencil aria-hidden="true" />}
                  title={row.field.label}
                  fact={t("mari.composerReferences.fieldFact")}
                  state={index === activeIndex ? "selected" : undefined}
                  onClick={() => onPick(index)}
                />
              );
            }
            const media = row.media;
            const drillLabel =
              row.group === "open"
                ? t("mari.composerReferences.showFields")
                : t("mari.composerReferences.showEntries", { name: row.ref.label });
            return (
              <MariRow
                key={row.key}
                id={referenceOptionId(id, index)}
                role="option"
                aria-selected={index === activeIndex}
                // Its avatar or artwork, badged with its kind, as in the omnibar and her reply rows.
                slot={
                  <ResultTypeIcon
                    type={media?.chatMode ?? resourceResultType(row.ref.kind)}
                    src={media?.src}
                    kind="avatar"
                    avatarCropStyle={media?.avatarCropStyle}
                    faces={media?.faces}
                  />
                }
                title={row.ref.label}
                fact={
                  row.group === "open"
                    ? t("mari.composerReferences.openFact")
                    : row.state
                      ? t(STATE_FACT_KEYS[row.state])
                      : row.detail
                }
                state={index === activeIndex ? "selected" : undefined}
                onClick={() => onPick(index)}
                action={
                  // Drilled in, the lorebook or editor row leads and takes you back out.
                  drilled && index === 0 && onBack ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="mari-reference-picker__drill"
                      aria-label={t("mari.composerReferences.back")}
                      title={t("mari.composerReferences.back")}
                      onClick={onBack}
                    >
                      <ChevronLeft aria-hidden="true" />
                    </button>
                  ) : !drilled && (row.group === "lorebook" || (row.group === "open" && fieldsDrillable)) ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="mari-reference-picker__drill"
                      aria-label={drillLabel}
                      title={drillLabel}
                      onClick={() => onDrill(index)}
                    >
                      <ChevronRight aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
