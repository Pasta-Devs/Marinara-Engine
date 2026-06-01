import { Suspense, lazy } from "react";
import { BarChart3, Package, Scroll, SlidersHorizontal, Users } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import type {
  CharacterStat,
  CustomTrackerField,
  InventoryItem,
  PresentCharacter,
  QuestProgress,
} from "../../../../engine/contracts/types/game-state";
import type { HudPosition } from "../../../../shared/stores/ui.store";
import { getTrackerStatPercent } from "../../../runtime/world-state/index";
import {
  DeferredHUDPanelFallback,
  WIDGET,
  WidgetPopover,
  getWidgetPreviewFontSize,
  useCyclingWidgetIndex,
  useWidgetPopoverController,
} from "./RoleplayHUDWidgetShell";

const PersonaStatsPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.PersonaStatsPanel })),
);
const CharactersPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CharactersPanel })),
);
const InventoryPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.InventoryPanel })),
);
const QuestsPanel = lazy(async () => import("./RoleplayHUDPanels").then((module) => ({ default: module.QuestsPanel })));
const CustomTrackerPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CustomTrackerPanel })),
);

export function CharactersWidget({
  characters,
  onUpdate,
  chatId,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  characters: PresentCharacter[];
  onUpdate: (chars: PresentCharacter[]) => void;
  chatId: string;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className={cn(WIDGET, "text-purple-500 dark:text-purple-300")}
        title="Present Characters"
      >
        {characters.length > 0 ? (
          <div className="flex items-center -space-x-0.5">
            {characters.slice(0, 3).map((c, i) => (
              <span key={i} className="text-xs max-md:text-[0.5625rem] leading-none">
                {c.emoji || "👤"}
              </span>
            ))}
            {characters.length > 3 && (
              <span className="text-[0.4375rem] text-[var(--muted-foreground)]/60 ml-0.5">
                +{characters.length - 3}
              </span>
            )}
          </div>
        ) : (
          <Users size="0.875rem" className="text-purple-400/50 max-md:h-3.5 max-md:w-3.5" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        placement={placement}
        className="w-72 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading characters…" />}>
          <CharactersPanel
            characters={characters}
            onUpdate={onUpdate}
            chatId={chatId}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

export function PersonaStatsWidget({
  bars,
  onUpdate,
  status,
  onUpdateStatus,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  bars: CharacterStat[];
  onUpdate: (bars: CharacterStat[]) => void;
  status: string;
  onUpdateStatus: (status: string) => void;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={toggle} className={cn(WIDGET, "text-violet-300")} title="Persona Stats">
        {bars.length > 0 ? (
          <div className="flex w-6 max-md:w-8 flex-col justify-center gap-0.5 max-md:gap-px shrink-0">
            {bars.map((bar) => {
              const pct = getTrackerStatPercent(bar);
              return (
                <div
                  key={bar.name}
                  className="h-1 max-md:h-px w-full rounded-full bg-[var(--muted)]/30 dark:bg-foreground/10 overflow-hidden"
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: bar.color || "#8b5cf6" }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <BarChart3 size="0.875rem" className="text-violet-400/40 max-md:h-3.5 max-md:w-3.5" />
        )}
        <span className="max-w-full truncate text-[0.5625rem] max-md:text-[0.4375rem] font-semibold leading-tight shrink-0 md:hidden">
          Persona
        </span>
      </button>

      <WidgetPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        placement={placement}
        className="w-60 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading persona stats…" />}>
          <PersonaStatsPanel
            bars={bars}
            onUpdate={onUpdate}
            status={status}
            onUpdateStatus={onUpdateStatus}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

export function CustomTrackerWidget({
  fields,
  onUpdate,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  fields: CustomTrackerField[];
  onUpdate: (fields: CustomTrackerField[]) => void;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);
  const { animKey, cycleIdx } = useCyclingWidgetIndex(fields.length);

  const currentField = fields[cycleIdx];
  const previewLabel = currentField
    ? currentField.value
      ? `${currentField.name}: ${currentField.value}`
      : currentField.name
    : "";
  const previewFontSize = getWidgetPreviewFontSize(previewLabel);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={toggle} className={cn(WIDGET, "text-cyan-300")} title="Custom Tracker">
        {fields.length > 0 && currentField ? (
          <span
            key={animKey}
            className="w-full px-0.5 text-center font-semibold leading-[1.2] animate-[inventory-cycle_0.4s_ease-out]"
            style={{ fontSize: `${previewFontSize}px` }}
          >
            {previewLabel}
          </span>
        ) : (
          <SlidersHorizontal size="0.875rem" className="text-cyan-400/60 max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        placement={placement}
        className="w-72 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading custom tracker…" />}>
          <CustomTrackerPanel
            fields={fields}
            onUpdate={onUpdate}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

export function InventoryWidget({
  items,
  onUpdate,
  layout = "top",
}: {
  items: InventoryItem[];
  onUpdate: (items: InventoryItem[]) => void;
  layout?: HudPosition;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);
  const { animKey, cycleIdx } = useCyclingWidgetIndex(items.length);

  const currentItem = items[cycleIdx];
  const itemLabel = currentItem
    ? currentItem.quantity > 1
      ? `${currentItem.name} ×${currentItem.quantity}`
      : currentItem.name
    : "";
  const itemFontSize = getWidgetPreviewFontSize(itemLabel);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={toggle} className={cn(WIDGET, "text-amber-300")} title="Inventory">
        {items.length > 0 && currentItem ? (
          <span
            key={animKey}
            className="w-full px-0.5 text-center font-semibold leading-[1.2] animate-[inventory-cycle_0.4s_ease-out]"
            style={{ fontSize: `${itemFontSize}px` }}
          >
            {itemLabel}
          </span>
        ) : (
          <Package size="0.875rem" className="text-amber-400/60 max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        placement={placement}
        className="w-64 max-h-80 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading inventory…" />}>
          <InventoryPanel items={items} onUpdate={onUpdate} />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}

export function QuestsWidget({
  quests,
  onUpdate,
  layout = "top",
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  quests: QuestProgress[];
  onUpdate: (quests: QuestProgress[]) => void;
  layout?: HudPosition;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);
  const incompleteQuests = quests.filter((q) => !q.completed);
  const mainQuest = incompleteQuests.length > 0 ? incompleteQuests[incompleteQuests.length - 1] : undefined;
  const currentObjective = mainQuest?.objectives.find((o) => !o.completed);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={toggle} className={cn(WIDGET, "text-emerald-300")} title="Active Quests">
        {currentObjective ? (
          <span className="widget-scroll-text w-full px-0.5 text-center text-[0.375rem] font-semibold leading-[1.15] max-md:text-[0.5rem]">
            <span className="inline-flex animate-[widget-scroll_8s_linear_infinite] whitespace-nowrap">
              <span className="px-3">{currentObjective.text}</span>
              <span className="px-3" aria-hidden>
                {currentObjective.text}
              </span>
            </span>
          </span>
        ) : (
          <Scroll size="0.875rem" className="text-emerald-400/60 max-md:h-3 max-md:w-3" />
        )}
      </button>

      <WidgetPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        placement={placement}
        className="w-72 max-h-96 overflow-y-auto"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading quests…" />}>
          <QuestsPanel
            quests={quests}
            onUpdate={onUpdate}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}
