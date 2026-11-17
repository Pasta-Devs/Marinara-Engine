// Roleplay side panels: where the Echo Chamber sits when stacked, and the tracker panel's desktop width and content
// scale.
import assert from "node:assert/strict";
import { resolveEchoChamberTopLayout } from "../../../packages/client/src/lib/echo-chamber-layout.js";
import {
  resolveTrackerPanelContentScale,
  resolveTrackerPanelDesktopWidth,
} from "../../../packages/client/src/lib/tracker-panel-layout.js";

const unstackedEchoLayout = resolveEchoChamberTopLayout({
  baseTop: 96,
  containerTop: 40,
  containerBottom: 840,
  viewportBottom: 800,
  bottomClearance: 88,
});
assert.deepEqual(unstackedEchoLayout, { top: 96, maxHeight: 576 });
const stackedEchoLayout = resolveEchoChamberTopLayout({
  baseTop: 96,
  containerTop: 40,
  containerBottom: 840,
  viewportBottom: 800,
  bottomClearance: 88,
  trackerBottom: 420,
  stackGap: 8,
});
assert.deepEqual(stackedEchoLayout, { top: 388, maxHeight: 284 });
assert.equal(
  40 + stackedEchoLayout.top + stackedEchoLayout.maxHeight + 88,
  800,
  "A stacked Echo Chamber must remain inside the visible roleplay area",
);
assert.equal(
  resolveEchoChamberTopLayout({
    baseTop: 96,
    containerTop: 40,
    containerBottom: 840,
    viewportBottom: 800,
    bottomClearance: 88,
    trackerBottom: 760,
    stackGap: 8,
  }).maxHeight,
  0,
  "Echo Chamber height must not become negative when the Tracker consumes the available corner",
);
assert.equal(
  resolveTrackerPanelDesktopWidth({
    preferredWidth: 340,
    mainLeft: 280,
    mainRight: 1920,
    chatColumnLeft: 636,
    chatColumnRight: 1564,
    side: "left",
    gap: 8,
  }),
  340,
  "The Tracker should retain its selected width when it fits beside the chat column",
);
assert.equal(
  resolveTrackerPanelDesktopWidth({
    preferredWidth: 420,
    mainLeft: 280,
    mainRight: 1480,
    chatColumnLeft: 416,
    chatColumnRight: 1344,
    side: "left",
    gap: 8,
  }),
  128,
  "The Tracker should shrink to the narrower left chat gutter",
);
assert.equal(
  resolveTrackerPanelDesktopWidth({
    preferredWidth: 340,
    mainLeft: 0,
    mainRight: 1200,
    chatColumnLeft: 136,
    chatColumnRight: 1064,
    side: "right",
    gap: 8,
  }),
  128,
  "The Tracker should use the matching right chat gutter",
);
assert.equal(
  resolveTrackerPanelDesktopWidth({
    preferredWidth: 340,
    mainLeft: 0,
    mainRight: 1024,
    chatColumnLeft: 19,
    chatColumnRight: 1005,
    side: "right",
    gap: 8,
    minWidth: 96,
  }),
  96,
  "A docked Tracker in a gutter too narrow for it keeps its minimum width instead of a sliver (#7188)",
);
assert.equal(resolveTrackerPanelContentScale(340, 340), 1);
assert.equal(resolveTrackerPanelContentScale(340, 255), 0.75);
assert.equal(
  resolveTrackerPanelContentScale(420, 128),
  0.65,
  "Severely constrained Tracker contents should reflow before their text becomes unreadably small",
);
