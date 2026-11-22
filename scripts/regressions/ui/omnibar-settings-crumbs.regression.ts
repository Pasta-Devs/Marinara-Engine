import assert from "node:assert/strict";
import {
  OVERHAUL_SETTINGS_TABS,
  overhaulSettingsTabLabelFor,
} from "../../../packages/client/src/components/overhaul/settings-tabs.js";
import {
  SETTINGS_SEARCHABLE_CONTROLS,
  SETTINGS_SECTION_BY_ID,
  settingsLocationPath,
} from "../../../packages/client/src/lib/settings-registry.js";

// QC panel 2, D11: in the new layout Ctrl+K said "Advanced › Message Buttons" for a setting that lives in
// Chatting. Every section the new layout shows names the new layout's own tab in its crumb.
const same = (text: string) => text;
for (const tab of OVERHAUL_SETTINGS_TABS) {
  for (const sectionId of tab.sections) {
    const section = SETTINGS_SECTION_BY_ID.get(sectionId);
    assert.ok(section, `${tab.id} lists a section the registry knows (${sectionId})`);
    assert.equal(overhaulSettingsTabLabelFor(sectionId), tab.label, `${sectionId} belongs to ${tab.label}`);
    assert.equal(
      settingsLocationPath(sectionId, same, overhaulSettingsTabLabelFor(sectionId)),
      `${tab.label} › ${section.label}`,
      `${sectionId}'s crumb names ${tab.label}`,
    );
  }
}
assert.equal(
  settingsLocationPath("message-buttons", same, overhaulSettingsTabLabelFor("message-buttons")),
  "Chatting › Message Buttons",
);
// The classic layout keeps its own tabs.
assert.match(settingsLocationPath("message-buttons", same) ?? "", /^Advanced › /u);

// The layout switch and the theme gallery can be found by name.
for (const id of ["overhaul-layout", "theme-gallery"]) {
  const control = SETTINGS_SEARCHABLE_CONTROLS.find((entry) => entry.id === id);
  assert.ok(control, `${id} is a searchable control`);
  assert.ok(SETTINGS_SECTION_BY_ID.get(control.sectionId), `${id} points at a real section`);
}
console.log("omnibar settings crumbs: OK");
