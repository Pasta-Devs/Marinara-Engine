import type { ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import type { CustomTrackerField } from "../../../../engine/contracts/types/game-state";
import { cn } from "../../../../shared/lib/utils";
import {
  appendTrackerListItem,
  createManualCustomTrackerField,
  removeTrackerListItem,
  replaceTrackerListItem,
} from "../../world-state/index";
import { visibleText } from "./tracker-display.helpers";
import {
  AddRowButton,
  EmptySection,
  InlineEdit,
  SectionHeader,
  TrackerReadabilityVeil,
} from "./tracker-data-sidebar.controls";

function CustomFieldList({
  fields,
  onUpdate,
  deleteMode = false,
}: {
  fields: CustomTrackerField[];
  onUpdate?: (fields: CustomTrackerField[]) => void;
  deleteMode?: boolean;
}) {
  if (fields.length === 0 && !onUpdate) return <EmptySection>No custom fields tracked.</EmptySection>;
  const updateField = (index: number, updated: CustomTrackerField) => {
    if (!onUpdate) return;
    onUpdate(replaceTrackerListItem(fields, index, updated));
  };
  const removeField = (index: number) => {
    if (!onUpdate) return;
    onUpdate(removeTrackerListItem(fields, index));
  };
  return (
    <div className="group/statbox relative">
      {fields.length === 0 ? (
        <div className="px-1 py-1">
          <EmptySection>No custom fields tracked.</EmptySection>
        </div>
      ) : (
        <div className="grid grid-cols-1 border-t border-[var(--border)]/30 @min-[220px]:grid-cols-2 @min-[420px]:grid-cols-3">
          {fields.map((field, index) => (
            <div
              key={field.customFieldId || `${field.name}-${index}`}
              className={cn(
                "group/field relative grid min-h-6 grid-cols-[minmax(0,1fr)_minmax(1.8rem,max-content)] items-center gap-1 border-b border-[var(--border)]/28 px-1 py-0.5 text-[0.6875rem] leading-[0.875rem]",
                index % 2 === 0 &&
                  !(fields.length % 2 === 1 && index === fields.length - 1) &&
                  "@min-[220px]:border-r @min-[220px]:border-r-[var(--border)]/20",
                fields.length % 2 === 1 && index === fields.length - 1 && "@min-[220px]:col-span-2",
                fields.length > 2 &&
                  index % 3 !== 2 &&
                  "@min-[420px]:border-r @min-[420px]:border-r-[var(--border)]/20",
                fields.length > 2 && index % 3 === 2 && "@min-[420px]:border-r-0",
                fields.length > 2 &&
                  fields.length % 2 === 1 &&
                  index === fields.length - 1 &&
                  "@min-[420px]:col-span-1",
                deleteMode && "pr-5",
              )}
            >
              {onUpdate ? (
                <InlineEdit
                  value={field.name}
                  onSave={(name) => updateField(index, { ...field, name: name || "Field" })}
                  placeholder="Field"
                  className="min-w-0 px-0.5 py-0 font-medium"
                  showEditHint={false}
                />
              ) : (
                <span className="truncate font-medium text-[var(--muted-foreground)]">
                  {visibleText(field.name, "Field")}
                </span>
              )}
              {onUpdate ? (
                <InlineEdit
                  value={field.value}
                  onSave={(value) => updateField(index, { ...field, value })}
                  placeholder="Value"
                  className="min-w-0 justify-end px-0.5 py-0 text-right tabular-nums"
                  showEditHint={false}
                />
              ) : (
                <span className="min-w-0 truncate text-right text-[var(--foreground)]">
                  {visibleText(field.value, "Empty")}
                </span>
              )}
              {onUpdate && deleteMode && (
                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="absolute right-1 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--background)]/85 text-[var(--destructive)] shadow-sm ring-1 ring-[var(--border)]/70 backdrop-blur-sm transition-all hover:bg-[var(--accent)] focus-visible:outline-none focus-visible:ring-[var(--primary)] active:scale-90"
                  title="Remove field"
                  aria-label={`Remove ${field.name || "field"}`}
                >
                  <X size="0.5625rem" />
                </button>
              )}
            </div>
          ))}
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
  collapsed = false,
  onToggleCollapsed,
}: {
  fields: CustomTrackerField[];
  action?: ReactNode;
  onUpdateFields: (fields: CustomTrackerField[]) => void;
  deleteMode: boolean;
  addMode: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <section className="relative z-10 overflow-hidden border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_10%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]">
      <TrackerReadabilityVeil strength="strong" />
      <div className="relative z-10">
        <SectionHeader
          icon={<SlidersHorizontal size="0.6875rem" />}
          title="Custom Stats"
          action={action}
          addAction={
            addMode ? (
              <AddRowButton
                title="Add custom stat"
                onClick={() => onUpdateFields(appendTrackerListItem(fields, createManualCustomTrackerField()))}
                className="h-4 w-4 rounded-sm"
              />
            ) : undefined
          }
          collapsed={collapsed}
          onToggle={onToggleCollapsed}
        />
        {!collapsed && <CustomFieldList fields={fields} onUpdate={onUpdateFields} deleteMode={deleteMode} />}
      </div>
    </section>
  );
}
