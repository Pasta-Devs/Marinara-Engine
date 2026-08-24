import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import {
  customTrackerLockKey,
  customTrackerFieldLockPrefix,
  isTrackerFieldLocked,
  removeTrackerFieldLockPrefix,
  renameTrackerFieldLockPrefix,
  type CustomTrackerField,
} from "@marinara-engine/shared";
import type { TrackerPanelSizeProfile } from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import { visibleText } from "../../lib/tracker-display";
import { InlineEdit } from "../controls/InlineControls";
import { TrackerReadabilityVeil } from "../controls/TrackerProfileChrome";
import { AddRowButton, EmptySection, SectionHeader, TRACKER_SECTION_SHELL_CLASS } from "../controls/SectionControls";
import { useTrackerLockContext } from "../TrackerLockContext";
import { useTranslation as useUiTranslation } from "react-i18next";

function isLongCustomField(field: CustomTrackerField): boolean {
  const name = visibleText(field.name, "");
  const value = visibleText(field.value, "");
  return name.length > 24 || value.length > 32 || (/\s/.test(value) && value.length > 26);
}

function isNumericCustomFieldValue(value: string): boolean {
  return /^[+-]?(?:\d+(?:[.,]\d+)?|\.\d+)(?:\s*%|\s*\/\s*[+-]?\d+(?:[.,]\d+)?)?$/.test(value.trim());
}

function shouldUseCustomFieldColumns(
  fields: CustomTrackerField[],
  trackerPanelSizeProfile: TrackerPanelSizeProfile,
): boolean {
  if (trackerPanelSizeProfile === "compact" || fields.length < 4) {
    return false;
  }
  return !fields.some(isLongCustomField);
}

function CustomFieldList({
  fields,
  onUpdate,
  deleteMode = false,
  trackerPanelSizeProfile,
}: {
  fields: CustomTrackerField[];
  onUpdate?: (fields: CustomTrackerField[]) => void;
  deleteMode?: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock, onUpdateFieldLocks } = useTrackerLockContext();
  if (fields.length === 0 && !onUpdate)
    return <EmptySection>{localizeUi("ui.trackerPanel.customfieldlist.noCustomStatsTracked")}</EmptySection>;
  const readableValues = trackerPanelSizeProfile !== "compact";
  const useFieldColumns = shouldUseCustomFieldColumns(fields, trackerPanelSizeProfile);
  const updateField = (index: number, updated: CustomTrackerField) => {
    if (!onUpdate) return;
    const previous = fields[index];
    if (previous && previous.name !== updated.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          customTrackerFieldLockPrefix(previous, index),
          customTrackerFieldLockPrefix(updated, index),
        ),
      );
    }
    const next = [...fields];
    next[index] = updated;
    onUpdate(next);
  };
  const removeField = (index: number) => {
    if (!onUpdate) return;
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(locks, customTrackerFieldLockPrefix(fields[index]!, index)),
    );
    onUpdate(fields.filter((_, fieldIndex) => fieldIndex !== index));
  };
  return (
    <div className="group/statbox relative">
      {fields.length === 0 ? (
        <div className="px-1 py-1">
          <EmptySection>{localizeUi("ui.trackerPanel.customfieldlist.noCustomStatsTracked")}</EmptySection>
        </div>
      ) : (
        <div
          className={cn(
            "grid grid-cols-1 border-t border-[var(--border)]/30 px-1",
            useFieldColumns && "@min-[300px]:grid-cols-2",
          )}
        >
          {fields.map((field, index) => {
            const allowWrap = readableValues && isLongCustomField(field);
            const valuePreviewLineCount = trackerPanelSizeProfile === "expanded" ? 4 : 3;
            const valueText = visibleText(field.value, "");
            const numericValue = isNumericCustomFieldValue(valueText);
            const valueTypography = numericValue ? "tabular-nums" : undefined;
            const valueLockKey = customTrackerLockKey(field, "value", index);
            const valueLocked = isTrackerFieldLocked(fieldLocks, valueLockKey);
            const toggleValueLock = () => {
              // Migrate the deprecated per-field flag into the shared lock map on first toggle.
              if (field.locked) updateField(index, { ...field, locked: false });
              if (valueLocked || !field.locked) onToggleFieldLock?.(valueLockKey);
            };
            return (
              <div
                key={`${field.name}-${index}`}
                className={cn(
                  "group/field relative grid min-h-7 grid-cols-[minmax(5.5rem,0.42fr)_minmax(0,1fr)] items-center gap-2 border-b border-[var(--border)]/28 px-1 py-1 text-[0.6875rem] leading-[0.875rem] transition-colors hover:bg-[color-mix(in_srgb,var(--foreground)_3%,transparent)]",
                  trackerPanelSizeProfile !== "compact" && "grid-cols-[5.5rem_minmax(0,1fr)]",
                  allowWrap && "leading-[0.95rem]",
                  useFieldColumns &&
                    index % 2 === 0 &&
                    !(fields.length % 2 === 1 && index === fields.length - 1) &&
                    "@min-[300px]:border-r @min-[300px]:border-r-[var(--border)]/20",
                  useFieldColumns &&
                    fields.length % 2 === 1 &&
                    index === fields.length - 1 &&
                    "@min-[300px]:col-span-2",
                  deleteMode && "pr-9",
                )}
              >
                {onUpdate ? (
                  <InlineEdit
                    value={field.name}
                    onSave={(name) => updateField(index, { ...field, name: name || "Field" })}
                    placeholder={localizeUi("ui.trackerPanel.charactertrackercard.field")}
                    className={cn("min-w-0 px-0.5 py-0 font-semibold", allowWrap && "min-h-5")}
                    previewLineCount={allowWrap ? 2 : undefined}
                    previewClassName={allowWrap ? "leading-[1.25]" : undefined}
                    scrollOnHover={!allowWrap}
                    showEditHint={false}
                    locked={isTrackerFieldLocked(fieldLocks, customTrackerLockKey(field, "name", index))}
                    lockMode={lockMode}
                    onToggleLock={() => onToggleFieldLock?.(customTrackerLockKey(field, "name", index))}
                  />
                ) : (
                  <span
                    className={cn(
                      "min-w-0 px-0.5 font-semibold text-[var(--muted-foreground)]",
                      allowWrap ? "line-clamp-2 break-words" : "truncate",
                    )}
                  >
                    {visibleText(field.name, "Field")}
                  </span>
                )}
                {onUpdate ? (
                  <InlineEdit
                    value={field.value}
                    onSave={(value) => updateField(index, { ...field, value })}
                    placeholder={localizeUi("ui.trackerPanel.charactertrackercard.value")}
                    className={cn(
                      "min-w-0 justify-start px-0.5 py-0 text-left",
                      valueTypography,
                      allowWrap ? "min-h-5 leading-[1.15]" : undefined,
                    )}
                    previewLineCount={allowWrap ? valuePreviewLineCount : undefined}
                    previewClassName={allowWrap ? "leading-[1.25]" : undefined}
                    scrollOnHover={!allowWrap}
                    showEditHint={false}
                    locked={valueLocked || field.locked}
                    lockMode={lockMode}
                    onToggleLock={toggleValueLock}
                  />
                ) : (
                  <span
                    className={cn(
                      "min-w-0 px-0.5 py-0 text-left text-[var(--foreground)]",
                      valueTypography,
                      allowWrap
                        ? trackerPanelSizeProfile === "expanded"
                          ? "line-clamp-4 break-words leading-[1.15]"
                          : "line-clamp-3 break-words leading-[1.15]"
                        : "truncate",
                    )}
                  >
                    {visibleText(field.value, "Empty")}
                  </span>
                )}
                {onUpdate && deleteMode && (
                  <span className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--background)]/85 text-[var(--destructive)] shadow-sm ring-1 ring-[var(--border)]/70 backdrop-blur-sm transition-all hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-[var(--border)] active:scale-90"
                      title={localizeUi("ui.trackerPanel.customfieldlist.removeField")}
                      aria-label={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", {
                        value1: visibleText(field.name, "field"),
                      })}
                    >
                      <X size="0.5625rem" />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CustomTrackerPanel({
  fields,
  action,
  onUpdateFields,
  deleteMode,
  addMode,
  trackerPanelSizeProfile,
  collapsed = false,
  onToggleCollapsed,
}: {
  fields: CustomTrackerField[];
  action?: ReactNode;
  onUpdateFields: (fields: CustomTrackerField[]) => void;
  deleteMode: boolean;
  addMode: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    <section className={TRACKER_SECTION_SHELL_CLASS}>
      <TrackerReadabilityVeil strength="strong" />
      <div className="relative z-10">
        <SectionHeader
          icon={<SlidersHorizontal size="0.6875rem" />}
          title={localizeUi("ui.trackerPanel.customtrackerpanel.customStats")}
          action={action}
          addAction={
            addMode ? (
              <AddRowButton
                title={localizeUi("ui.trackerPanel.customtrackerpanel.addCustomStat")}
                onClick={() => onUpdateFields([...fields, { name: "New Field", value: "" }])}
                className="rounded-sm"
              />
            ) : undefined
          }
          collapsed={collapsed}
          onToggle={onToggleCollapsed}
        />
        {!collapsed && (
          <CustomFieldList
            fields={fields}
            onUpdate={onUpdateFields}
            deleteMode={deleteMode}
            trackerPanelSizeProfile={trackerPanelSizeProfile}
          />
        )}
      </div>
    </section>
  );
}
