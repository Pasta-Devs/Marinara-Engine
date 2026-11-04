// ──────────────────────────────────────────────
// UI overhaul: Professor Mari as a tab
//
// Her full chat in the main area, so you can keep a thread with her open
// beside your chats. ⌘J and the omnibar still open her in the popover.
// ──────────────────────────────────────────────
import { HomeProfessorMariChat } from "../chat/HomeProfessorMariChat";

export function OverhaulMariPage() {
  return (
    <section className="ov-mari mari-workspace-canvas" data-component="OverhaulMariPage">
      <HomeProfessorMariChat pageActive embeddedTab launchHidden chatWindowOpen />
    </section>
  );
}
