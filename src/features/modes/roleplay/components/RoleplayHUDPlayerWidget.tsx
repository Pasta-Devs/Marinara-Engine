import { Suspense, lazy } from "react";
import { Swords } from "lucide-react";
import { cn } from "../../../../shared/lib/utils";
import type {
  CharacterStat,
  CustomTrackerField,
  InventoryItem,
  PresentCharacter,
  QuestProgress,
} from "../../../../engine/contracts/types/game-state";
import type { HudPosition } from "../../../../shared/stores/ui.store";
import { DeferredHUDPanelFallback, WIDGET, WidgetPopover, useWidgetPopoverController } from "./RoleplayHUDWidgetShell";

const CombinedPlayerPanel = lazy(async () =>
  import("./RoleplayHUDPanels").then((module) => ({ default: module.CombinedPlayerPanel })),
);

export function CombinedPlayerWidget({
  layout = "top",
  showPersona,
  showCharacters,
  showQuests,
  showCustomTracker,
  personaStats,
  onUpdatePersonaStats,
  personaStatus,
  onUpdatePersonaStatus,
  characters,
  onUpdateCharacters,
  inventory,
  onUpdateInventory,
  quests,
  onUpdateQuests,
  customTrackerFields,
  onUpdateCustomTracker,
  onRerunSingleTracker,
  isTrackerRetryBusy,
}: {
  layout?: HudPosition;
  showPersona: boolean;
  showCharacters: boolean;
  showQuests: boolean;
  showCustomTracker: boolean;
  personaStats: CharacterStat[];
  onUpdatePersonaStats: (bars: CharacterStat[]) => void;
  personaStatus: string;
  onUpdatePersonaStatus: (status: string) => void;
  characters: PresentCharacter[];
  onUpdateCharacters: (chars: PresentCharacter[]) => void;
  inventory: InventoryItem[];
  onUpdateInventory: (items: InventoryItem[]) => void;
  quests: QuestProgress[];
  onUpdateQuests: (quests: QuestProgress[]) => void;
  customTrackerFields: CustomTrackerField[];
  onUpdateCustomTracker: (fields: CustomTrackerField[]) => void;
  onRerunSingleTracker?: (agentType: string) => void;
  isTrackerRetryBusy?: boolean;
}) {
  const { buttonRef, close, open, placement, toggle } = useWidgetPopoverController(layout);

  return (
    <div className="relative">
      <button ref={buttonRef} onClick={toggle} className={cn(WIDGET, "text-orange-300")} title="Player & Tracker">
        <div className="flex h-7 max-md:h-auto items-center justify-center shrink-0">
          <Swords size="0.875rem" className="text-orange-400/70 max-md:h-4 max-md:w-4" />
        </div>
        <span className="max-w-full truncate text-[0.5625rem] font-semibold leading-tight shrink-0 max-md:hidden">
          Tracker
        </span>
      </button>

      <WidgetPopover
        open={open}
        onClose={close}
        anchorRef={buttonRef}
        placement={placement}
        className="w-80 max-h-[min(75vh,32rem)]"
      >
        <Suspense fallback={<DeferredHUDPanelFallback label="Loading trackers…" />}>
          <CombinedPlayerPanel
            showPersona={showPersona}
            showCharacters={showCharacters}
            showQuests={showQuests}
            showCustomTracker={showCustomTracker}
            personaStats={personaStats}
            onUpdatePersonaStats={onUpdatePersonaStats}
            personaStatus={personaStatus}
            onUpdatePersonaStatus={onUpdatePersonaStatus}
            characters={characters}
            onUpdateCharacters={onUpdateCharacters}
            inventory={inventory}
            onUpdateInventory={onUpdateInventory}
            quests={quests}
            onUpdateQuests={onUpdateQuests}
            customTrackerFields={customTrackerFields}
            onUpdateCustomTracker={onUpdateCustomTracker}
            onClose={close}
            onRerunSingleTracker={onRerunSingleTracker}
            isTrackerRetryBusy={isTrackerRetryBusy}
          />
        </Suspense>
      </WidgetPopover>
    </div>
  );
}
