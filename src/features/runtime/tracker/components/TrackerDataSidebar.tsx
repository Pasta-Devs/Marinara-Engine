import { useState } from "react";
import { cn } from "../../../../shared/lib/utils";
import { useTrackerPanelModel } from "../hooks/use-tracker-panel-model";
import { EmptySection } from "./tracker-data-sidebar.controls";
import { TrackerCardColorSettings } from "./TrackerCardColorSettings";
import { TrackerSkeleton } from "./TrackerSkeleton";
import { TrackerSectionList } from "./TrackerSectionList";
import { TrackerSidebarHeader } from "./TrackerSidebarHeader";

export function TrackerDataSidebar({ fillHeight = false }: { fillHeight?: boolean } = {}) {
  const [deleteMode, setDeleteMode] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const model = useTrackerPanelModel();

  return (
    <section
      data-component="TrackerDataSidebar"
      data-tracker-size-profile={model.trackerPanelSizeProfile}
      className={cn(
        "@container relative flex flex-col overflow-hidden bg-[color-mix(in_srgb,var(--background)_8%,transparent)] backdrop-blur-sm",
        fillHeight ? "h-full" : "min-h-0",
      )}
    >
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.08] [background-image:linear-gradient(color-mix(in_srgb,var(--foreground)_12%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--foreground)_9%,transparent)_1px,transparent_1px)] [background-size:8px_8px]" />

      <TrackerSidebarHeader
        trackerPanelSide={model.trackerPanelSide}
        sizeProfile={model.trackerPanelSizeProfile}
        addMode={addMode}
        deleteMode={deleteMode}
        onSetAddMode={setAddMode}
        onSetDeleteMode={setDeleteMode}
        onSetSide={model.setTrackerPanelSide}
        onSetSizeProfile={model.setTrackerPanelSizeProfile}
        onClose={() => model.setTrackerPanelOpen(false)}
      />

      <div className={cn("relative z-10", fillHeight && "min-h-0 flex-1 overflow-y-auto")}>
        {model.activeChatId ? <TrackerCardColorSettings /> : null}

        {model.showTrackerSections ? (
          <TrackerSectionList model={model} deleteMode={deleteMode} addMode={addMode} />
        ) : null}

        {!model.activeChatId ? (
          <EmptySection>Select a chat to view tracker data.</EmptySection>
        ) : model.isLoadingGameState ? (
          <TrackerSkeleton />
        ) : !model.gameState ? (
          <EmptySection>No tracker data yet.</EmptySection>
        ) : !model.hasFixedTrackerPanel ? (
          <EmptySection>No enabled tracker panels.</EmptySection>
        ) : null}
      </div>
    </section>
  );
}
