import { Suspense, lazy } from "react";
import { getTrackerPanelWidthForProfile, useUIStore } from "../../../stores/ui.store";
import { useChatStore } from "../../../stores/chat.store";

const TrackerDataSidebar = lazy(() =>
  import("../../layout/TrackerDataSidebar").then((module) => ({ default: module.TrackerDataSidebar })),
);

const noop = () => {};

/**
 * Live Tracker Panel preview for Settings: the real panel for the open roleplay chat, drawn at the
 * chosen desktop size, so size, background, thoughts and stat changes show up as you make them.
 */
export function TrackerPanelPreview() {
  const activeChat = useChatStore((s) => s.activeChat);
  const sizeProfile = useUIStore((s) => s.trackerPanelSizeProfile);
  const enabled = useUIStore((s) => s.trackerPanelEnabled);
  const width = getTrackerPanelWidthForProfile(sizeProfile);
  const isRoleplay = activeChat?.mode === "roleplay";

  return (
    <aside className="ov-trk-preview" aria-label="Tracker Panel preview">
      <p className="ov-trk-preview__label">
        Preview
        {isRoleplay ? <span> · {activeChat?.name}</span> : null}
      </p>
      {!enabled ? (
        <p className="ov-trk-preview__empty">Turn on the Tracker Panel to see a preview.</p>
      ) : !isRoleplay ? (
        <p className="ov-trk-preview__empty">Open a roleplay chat in a tab to preview its Tracker Panel here.</p>
      ) : (
        <div className="ov-trk-preview__frame mari-tracker-panel" style={{ width, maxWidth: "100%" }}>
          <Suspense fallback={null}>
            <TrackerDataSidebar fillHeight queuePersonaPortraitSave={noop} flushPersonaPortraitSave={noop} />
          </Suspense>
        </div>
      )}
    </aside>
  );
}
