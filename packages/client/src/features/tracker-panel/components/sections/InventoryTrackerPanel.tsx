import type { ReactNode } from "react";
import { Backpack, Coins, Shield } from "lucide-react";
import {
  INVENTORY_TRACKER_GROUPS,
  type InventoryTrackerGroup,
  type InventoryTrackerItem,
} from "@marinara-engine/shared";
import type { TrackerPanelSizeProfile } from "../../../../stores/ui.store";
import { cn } from "../../../../lib/utils";
import { TrackerReadabilityVeil } from "../controls/TrackerProfileChrome";
import { AddRowButton, EmptySection, SectionHeader } from "../controls/SectionControls";
import { InventoryTrackerRow } from "./InventoryTrackerRow";
import { useTranslation as useUiTranslation } from "react-i18next";

export type InventoryTrackerGroups = Record<InventoryTrackerGroup, InventoryTrackerItem[]>;

const GROUP_ICONS: Record<InventoryTrackerGroup, ReactNode> = {
  currencies: <Coins size="0.625rem" />,
  equipped: <Shield size="0.625rem" />,
  carried: <Backpack size="0.625rem" />,
};

const GROUP_HEADER_CLASS =
  "relative mx-0.5 flex min-h-5 items-center gap-1 overflow-hidden px-0.5 text-[0.625rem] leading-3";

/**
 * A labelled grid of items for one tracked group.
 *
 * Two columns once there is room and enough items to justify them, matching the
 * persona inventory shelf. Currencies stay single-column: there are rarely more
 * than a couple, and a lone pair reads better on its own line.
 */
function InventoryTrackerGroupGrid({
  group,
  items,
  label,
  addLabel,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  deleteMode,
  addMode,
  trackerPanelSizeProfile,
}: {
  group: InventoryTrackerGroup;
  items: InventoryTrackerItem[];
  label: string;
  addLabel: string;
  onAddItem: (group: InventoryTrackerGroup) => void;
  onUpdateItem: (group: InventoryTrackerGroup, index: number, item: InventoryTrackerItem) => void;
  onRemoveItem: (group: InventoryTrackerGroup, index: number) => void;
  deleteMode: boolean;
  addMode: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
}) {
  const { t: localizeUi } = useUiTranslation();
  const twoColumn = group !== "currencies" && trackerPanelSizeProfile !== "compact" && items.length >= 4;
  return (
    <div className="flex min-w-0 flex-col">
      <div className={GROUP_HEADER_CLASS}>
        <span className="relative z-[1] shrink-0 text-[color-mix(in_srgb,var(--muted-foreground)_58%,var(--foreground)_42%)]">
          {GROUP_ICONS[group]}
        </span>
        <span className="relative z-[1] min-w-0 flex-1 truncate font-semibold uppercase tracking-[0.06em] text-[color-mix(in_srgb,var(--muted-foreground)_70%,var(--foreground)_30%)]">
          {label}
        </span>
        {items.length > 0 && (
          <span className="relative z-[1] shrink-0 tabular-nums text-[var(--muted-foreground)]/70">{items.length}</span>
        )}
        {addMode && (
          <span className="relative z-[1]">
            <AddRowButton title={addLabel} onClick={() => onAddItem(group)} />
          </span>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--border)_58%,transparent),transparent)] opacity-80" />
      </div>
      <div
        className={cn(
          "@container",
          items.length === 0
            ? "px-1 py-1"
            : ["grid auto-rows-max content-start items-start gap-px p-0.5 text-left", "grid-cols-1"],
          twoColumn && "@min-[300px]:grid-cols-2",
        )}
      >
        {items.length === 0 ? (
          <EmptySection>{localizeUi("ui.trackerPanel.inventorytrackerpanel.nothingTracked")}</EmptySection>
        ) : (
          items.map((item, index) => (
            <InventoryTrackerRow
              key={`${item.name}-${index}`}
              group={group}
              item={item}
              itemIndex={index}
              onUpdate={(updated) => onUpdateItem(group, index, updated)}
              onRemove={() => onRemoveItem(group, index)}
              deleteMode={deleteMode}
              fullWidth={twoColumn && items.length % 2 === 1 && index === items.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function InventoryTrackerPanel({
  groups,
  action,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
  deleteMode,
  addMode,
  trackerPanelSizeProfile,
  collapsed = false,
  onToggleCollapsed,
}: {
  groups: InventoryTrackerGroups;
  action?: ReactNode;
  onAddItem: (group: InventoryTrackerGroup) => void;
  onUpdateItem: (group: InventoryTrackerGroup, index: number, item: InventoryTrackerItem) => void;
  onRemoveItem: (group: InventoryTrackerGroup, index: number) => void;
  deleteMode: boolean;
  addMode: boolean;
  trackerPanelSizeProfile: TrackerPanelSizeProfile;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const { t: localizeUi } = useUiTranslation();
  const groupLabels: Record<InventoryTrackerGroup, string> = {
    currencies: localizeUi("ui.trackerPanel.inventorytrackerpanel.currencies"),
    equipped: localizeUi("ui.trackerPanel.inventorytrackerpanel.equipped"),
    carried: localizeUi("ui.trackerPanel.inventorytrackerpanel.carried"),
  };
  const groupAddLabels: Record<InventoryTrackerGroup, string> = {
    currencies: localizeUi("ui.trackerPanel.inventorytrackerpanel.addCurrency"),
    equipped: localizeUi("ui.trackerPanel.inventorytrackerpanel.addEquippedItem"),
    carried: localizeUi("ui.trackerPanel.inventorytrackerpanel.addCarriedItem"),
  };
  return (
    <section className="relative z-10 overflow-hidden border-b border-[var(--border)] bg-[var(--tracker-panel-section-background,color-mix(in_srgb,var(--card)_10%,transparent))] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]">
      <TrackerReadabilityVeil strength="strong" />
      <div className="relative z-10">
        <SectionHeader
          icon={<Backpack size="0.6875rem" />}
          title={localizeUi("ui.trackerPanel.inventorytrackerpanel.inventory")}
          action={action}
          collapsed={collapsed}
          onToggle={onToggleCollapsed}
        />
        {!collapsed && (
          <div className="flex flex-col gap-0.5 border-t border-[var(--border)]/30 px-1 pb-1">
            {INVENTORY_TRACKER_GROUPS.map((group) => (
              <InventoryTrackerGroupGrid
                key={group}
                group={group}
                items={groups[group]}
                label={groupLabels[group]}
                addLabel={groupAddLabels[group]}
                onAddItem={onAddItem}
                onUpdateItem={onUpdateItem}
                onRemoveItem={onRemoveItem}
                deleteMode={deleteMode}
                addMode={addMode}
                trackerPanelSizeProfile={trackerPanelSizeProfile}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
