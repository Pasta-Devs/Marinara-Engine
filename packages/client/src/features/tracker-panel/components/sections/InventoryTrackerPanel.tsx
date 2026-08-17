import type { ReactNode } from "react";
import { Backpack, Lock, X } from "lucide-react";
import {
  isTrackerFieldLocked,
  normalizeInventoryTrackerName,
  removeTrackerFieldLockPrefix,
  renameTrackerFieldLockPrefix,
  roleplayInventoryTrackerLockKey,
  roleplayInventoryTrackerRowLockPrefix,
  type InventoryTrackerGroup,
  type InventoryTrackerRow,
} from "@marinara-engine/shared";
import { useTranslation as useUiTranslation } from "react-i18next";
import { cn } from "../../../../lib/utils";
import { InlineEdit, InlineNumber } from "../controls/InlineControls";
import { TrackerReadabilityVeil } from "../controls/TrackerProfileChrome";
import { AddRowButton, EmptySection, SectionHeader } from "../controls/SectionControls";
import { useTrackerLockContext } from "../TrackerLockContext";

/**
 * Give a new row a name no existing row already has.
 *
 * Rows are deduplicated by name on the way to storage, so two untouched "New item"
 * placeholders would collapse into one row with `qty: 2` instead of giving the user a
 * second row to name.
 */
function nextPlaceholderName(rows: InventoryTrackerRow[], base: string): string {
  const taken = new Set(rows.map((row) => normalizeInventoryTrackerName(row.name).toLocaleLowerCase("en-US")));
  if (!taken.has(base.toLocaleLowerCase("en-US"))) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base} ${suffix}`;
    if (!taken.has(candidate.toLocaleLowerCase("en-US"))) return candidate;
  }
  return base;
}

/**
 * Cancels the fill and ring InlineEdit/InlineNumber paint when a field is locked.
 *
 * Those were designed for bare rows on a panel. Inside a chip that already has its own
 * border they draw a second surface within the first, so a pinned entry stopped looking
 * like its neighbours. A padlock marks the lock instead, which leaves every chip the
 * same colour and shape — the alternative, restyling the chip, means guessing at the
 * tracker panel's scoped colour tokens, which do not resolve to the same values as the
 * app-level ones.
 *
 * The hover fill is deliberately kept: it is transient, and it is the only cue that an
 * individual field is clickable in lock mode. `rounded-full` makes it nest cleanly.
 * `cn` merges by Tailwind group and this is passed last, so it wins over the control's
 * own classes without touching the shared component.
 */
const LOCK_SURFACE_RESET = "rounded-full bg-transparent ring-0";

const LOCK_GLYPH = <Lock size="0.5rem" className="shrink-0 opacity-70" aria-hidden="true" />;

type InventoryGroupProps = {
  group: InventoryTrackerGroup;
  label: string;
  rows: InventoryTrackerRow[];
  onUpdate: (rows: InventoryTrackerRow[]) => void;
  deleteMode: boolean;
  addMode: boolean;
};

function InventoryGroup({ group, label, rows, onUpdate, deleteMode, addMode }: InventoryGroupProps) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock, onUpdateFieldLocks } = useTrackerLockContext();
  const updateRow = (index: number, row: InventoryTrackerRow) => {
    const previous = rows[index];
    if (previous && previous.name !== row.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          roleplayInventoryTrackerRowLockPrefix(group, previous, index),
          // Remap from the stored form of the name, not the raw keystrokes — storage
          // trims and collapses whitespace, so an un-normalized key would orphan the lock.
          roleplayInventoryTrackerRowLockPrefix(
            group,
            { ...row, name: normalizeInventoryTrackerName(row.name) },
            index,
          ),
        ),
      );
    }
    const next = [...rows];
    next[index] = row;
    onUpdate(next);
  };
  const removeRow = (index: number) => {
    onUpdateFieldLocks?.((locks) =>
      removeTrackerFieldLockPrefix(locks, roleplayInventoryTrackerRowLockPrefix(group, rows[index]!, index)),
    );
    onUpdate(rows.filter((_, rowIndex) => rowIndex !== index));
  };

  return (
    <div className="min-w-0 border-b border-[var(--border)]/25 p-1.5 last:border-0">
      <div className="mb-1 flex min-h-6 items-center justify-between gap-1 px-0.5">
        <span className="truncate text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
          {label}
        </span>
        {addMode && (
          <AddRowButton
            title={localizeUi("ui.trackerPanel.inventoryTracker.addToGroup", { group: label })}
            onClick={() =>
              onUpdate([
                ...rows,
                { name: nextPlaceholderName(rows, localizeUi("ui.trackerPanel.inventoryTracker.newItem")) },
              ])
            }
            className="h-5 min-h-5 w-5 min-w-5"
          />
        )}
      </div>
      {/* Chips wrap at every width. A narrow panel does get a ragged right edge, but the
          stacked fallback stretched each chip to the full row, which read as a list of
          buttons rather than as the item pills the wide layout shows. */}
      <div className="flex flex-wrap gap-1">
        {rows.length === 0 && (
          <EmptySection className="w-full">{localizeUi("ui.trackerPanel.inventoryTracker.emptyGroup")}</EmptySection>
        )}
        {rows.map((row, index) => {
          const nameKey = roleplayInventoryTrackerLockKey(group, row, "name", index);
          const qtyKey = roleplayInventoryTrackerLockKey(group, row, "qty", index);
          const quantity = row.qty ?? 1;
          // A quantity of 1 is the overwhelmingly common case and the number carries no
          // information, so it is hidden — but it still has to be reachable when the user
          // is deliberately editing structure or pinning values, or a qty-1 row could
          // never be raised or locked.
          const showQuantity = quantity > 1 || addMode || lockMode;
          const nameLocked = isTrackerFieldLocked(fieldLocks, nameKey);
          const qtyLocked = isTrackerFieldLocked(fieldLocks, qtyKey);
          return (
            <div
              key={`${row.name}-${index}`}
              className="flex min-h-6 min-w-0 max-w-full items-center gap-1 rounded-full border border-[var(--tracker-profile-slot-rule)] bg-[image:var(--tracker-profile-slot-surface)] px-1.5 shadow-[inset_0_1px_2px_var(--tracker-profile-slot-shadow)] [@media(pointer:coarse)]:min-h-7"
            >
              {nameLocked && LOCK_GLYPH}
              <InlineEdit
                value={row.name}
                onSave={(name) =>
                  updateRow(index, { ...row, name: name || localizeUi("ui.trackerPanel.inventoryTracker.item") })
                }
                placeholder={localizeUi("ui.trackerPanel.inventoryTracker.item")}
                className={cn("min-w-0 px-0.5 text-[0.625rem] font-medium", LOCK_SURFACE_RESET)}
                title={row.name}
                showEditHint={false}
                scrollOnHover
                locked={nameLocked}
                lockMode={lockMode}
                onToggleLock={() => onToggleFieldLock?.(nameKey)}
              />
              {showQuantity && (
                <span className="flex shrink-0 items-center gap-0.5 text-[0.625rem] text-[var(--muted-foreground)]">
                  {qtyLocked && LOCK_GLYPH}
                  <span aria-hidden="true">×</span>
                  <InlineNumber
                    value={quantity}
                    min={1}
                    onChange={(qty) => updateRow(index, qty > 1 ? { ...row, qty } : { name: row.name })}
                    className={cn("px-0 text-right text-[0.625rem] tabular-nums", LOCK_SURFACE_RESET)}
                    title={localizeUi("ui.trackerPanel.inventoryTracker.quantityFor", { item: row.name })}
                    locked={qtyLocked}
                    lockMode={lockMode}
                    onToggleLock={() => onToggleFieldLock?.(qtyKey)}
                  />
                </span>
              )}
              {deleteMode && (
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[var(--destructive)] ring-1 ring-[var(--border)]"
                  title={localizeUi("ui.trackerPanel.inventoryTracker.removeItem", { item: row.name })}
                  aria-label={localizeUi("ui.trackerPanel.inventoryTracker.removeItem", { item: row.name })}
                >
                  <X size="0.5625rem" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function InventoryTrackerPanel({
  currencies,
  equipped,
  inventory,
  action,
  onUpdateCurrencies,
  onUpdateEquipped,
  onUpdateInventory,
  deleteMode,
  addMode,
  collapsed = false,
  onToggleCollapsed,
}: {
  currencies: InventoryTrackerRow[];
  equipped: InventoryTrackerRow[];
  inventory: InventoryTrackerRow[];
  action?: ReactNode;
  onUpdateCurrencies: (rows: InventoryTrackerRow[]) => void;
  onUpdateEquipped: (rows: InventoryTrackerRow[]) => void;
  onUpdateInventory: (rows: InventoryTrackerRow[]) => void;
  deleteMode: boolean;
  addMode: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  return (
    // Own the query container rather than inheriting one. The docked sidebar provides
    // `@container`, but the HUD popover is portaled to document.body and has none — so
    // the same component used to lay itself out differently in its two hosts.
    <section className="@container relative z-10 overflow-hidden border-b border-[var(--border)] bg-[var(--tracker-panel-section-background,color-mix(in_srgb,var(--card)_10%,transparent))]">
      <TrackerReadabilityVeil strength="strong" />
      <div className="relative z-10">
        <SectionHeader
          icon={<Backpack size="0.6875rem" />}
          title={localizeUi("ui.trackerPanel.inventoryTracker.title")}
          badge={currencies.length + equipped.length + inventory.length}
          action={action}
          collapsed={collapsed}
          onToggle={onToggleCollapsed}
        />
        {!collapsed && (
          // Groups stack full-width. Splitting the panel into three columns gave the
          // longest group a third of the width and truncated its names, while a group
          // with two rows sat mostly empty.
          <div className="flex flex-col">
            <InventoryGroup
              group="currencies"
              label={localizeUi("ui.trackerPanel.inventoryTracker.currencies")}
              rows={currencies}
              onUpdate={onUpdateCurrencies}
              deleteMode={deleteMode}
              addMode={addMode}
            />
            <InventoryGroup
              group="equipped"
              label={localizeUi("ui.trackerPanel.inventoryTracker.equipped")}
              rows={equipped}
              onUpdate={onUpdateEquipped}
              deleteMode={deleteMode}
              addMode={addMode}
            />
            <InventoryGroup
              group="inventory"
              label={localizeUi("ui.trackerPanel.inventoryTracker.inventory")}
              rows={inventory}
              onUpdate={onUpdateInventory}
              deleteMode={deleteMode}
              addMode={addMode}
            />
          </div>
        )}
      </div>
    </section>
  );
}
