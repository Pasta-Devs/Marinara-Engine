import { X } from "lucide-react";
import {
  normalizeInventoryTrackerQuantity,
  inventorySectionTrackerLockKey,
  inventorySectionTrackerRowPrefix,
  isTrackerFieldLocked,
  renameTrackerFieldLockPrefix,
  type InventoryTrackerGroup,
  type InventoryTrackerItem,
} from "@marinara-engine/shared";
import { cn } from "../../../../lib/utils";
import { visibleText } from "../../lib/tracker-display";
import { InlineEdit, InlineNumber } from "../controls/InlineControls";
import { useTrackerLockContext } from "../TrackerLockContext";
import { useTranslation as useUiTranslation } from "react-i18next";

/** One grid cell in the Inventory Tracker panel. Shared by all three groups. */
export function InventoryTrackerRow({
  group,
  item,
  itemIndex,
  onUpdate,
  onRemove,
  deleteMode,
  fullWidth = false,
}: {
  group: InventoryTrackerGroup;
  item: InventoryTrackerItem;
  itemIndex: number;
  onUpdate: (item: InventoryTrackerItem) => void;
  onRemove: () => void;
  deleteMode: boolean;
  fullWidth?: boolean;
}) {
  const { t: localizeUi } = useUiTranslation();
  const { fieldLocks, lockMode, onToggleFieldLock, onUpdateFieldLocks } = useTrackerLockContext();
  const nameLockKey = inventorySectionTrackerLockKey(group, item, "name", itemIndex);
  const qtyLockKey = inventorySectionTrackerLockKey(group, item, "qty", itemIndex);
  const itemName = visibleText(item.name, localizeUi("ui.trackerPanel.inventorytrackerrow.item"));
  const updateName = (name: string) => {
    const nextItem = { ...item, name: name || "Item" };
    if (nextItem.name !== item.name) {
      onUpdateFieldLocks?.((locks) =>
        renameTrackerFieldLockPrefix(
          locks,
          inventorySectionTrackerRowPrefix(group, item, itemIndex),
          inventorySectionTrackerRowPrefix(group, nextItem, itemIndex),
        ),
      );
    }
    onUpdate(nextItem);
  };
  return (
    <div
      className={cn(
        "relative min-w-0 rounded-[2px] border border-[var(--tracker-profile-slot-rule)] bg-[image:var(--tracker-profile-slot-surface)] px-1 py-px shadow-[inset_0_1px_2px_var(--tracker-profile-slot-shadow)] [background-blend-mode:var(--tracker-profile-slot-surface-blend)]",
        fullWidth && "col-span-full",
        deleteMode && "pr-5",
      )}
    >
      <div className="grid min-h-4 grid-cols-[minmax(0,1fr)_max-content] items-center gap-0.5">
        <InlineEdit
          value={item.name}
          onSave={updateName}
          className="h-4 w-full min-w-0 px-0.5 py-0 text-[0.625rem] font-medium leading-4 text-[color:var(--tracker-profile-text)] hover:bg-[var(--accent)]/25"
          placeholder={localizeUi("ui.trackerPanel.inventorytrackerrow.item")}
          title={itemName}
          scrollOnHover
          showEditHint={false}
          locked={isTrackerFieldLocked(fieldLocks, nameLockKey)}
          lockMode={lockMode}
          onToggleLock={() => onToggleFieldLock?.(nameLockKey)}
        />
        <div className="flex h-4 min-w-0 items-center justify-end">
          <InlineNumber
            value={item.qty}
            onChange={(qty) => onUpdate({ ...item, qty: normalizeInventoryTrackerQuantity(qty) })}
            min={1}
            className="justify-self-end px-0 text-right text-[0.625rem] leading-4 text-[color:var(--tracker-profile-number-text)] hover:bg-transparent focus:bg-transparent focus:ring-0"
            title={localizeUi("ui.trackerPanel.inventorytrackerrow.value1Quantity", { value1: itemName })}
            locked={isTrackerFieldLocked(fieldLocks, qtyLockKey)}
            lockMode={lockMode}
            onToggleLock={() => onToggleFieldLock?.(qtyLockKey)}
          />
        </div>
      </div>
      {deleteMode && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-0.5 top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/10"
          title={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: itemName })}
          aria-label={localizeUi("ui.trackerPanel.charactertrackercard.removeValue1", { value1: itemName })}
        >
          <X size="0.65rem" />
        </button>
      )}
    </div>
  );
}
