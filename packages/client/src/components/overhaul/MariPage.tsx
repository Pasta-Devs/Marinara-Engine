// ──────────────────────────────────────────────
// UI overhaul: Professor Mari as a tab
//
// Her full chat in the main area, so you can keep a thread with her open
// beside your chats. ⌘J opens this page; her head in Search and ⌘↵ there open the popover.
// ──────────────────────────────────────────────
import { HomeProfessorMariChat } from "../chat/HomeProfessorMariChat";

export function OverhaulMariPage({ active = true }: { active?: boolean }) {
  return (
    <section className="ov-mari mari-workspace-canvas" data-component="OverhaulMariPage">
      <HomeProfessorMariChat pageActive={active} embeddedTab launchHidden chatWindowOpen />
    </section>
  );
}
