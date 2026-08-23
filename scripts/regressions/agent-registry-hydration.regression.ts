import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  replaceBuiltInAgentDefinitions,
  type BuiltInAgentManifest,
  type InstalledCapabilityPackage,
} from "../../packages/shared/dist/index.js";
import { buildRoleplayAgentSettingsOrder } from "../../packages/client/src/lib/agent-settings-order.js";
import {
  isCapabilityPackageAvailableUntilRestart,
  selectHomeBrowserPackages,
  selectVisibleTrackerCapabilityAgents,
} from "../../packages/client/src/hooks/use-capability-packages.js";
import { isReviewableWriterAgentType } from "../../packages/server/src/services/generation/runtime-agent-sections.js";

const manifests: BuiltInAgentManifest[] = [
  {
    id: "late-tracker",
    name: "Late tracker",
    description: "Loaded after the consuming modules.",
    phase: "post_processing",
    enabledByDefault: false,
    category: "tracker",
  },
  {
    id: "illustrator",
    name: "Illustrator",
    description: "Settings ordering anchor.",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "misc",
  },
  {
    id: "late-writer",
    name: "Late writer",
    description: "Loaded after the consuming modules.",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "writer",
  },
  {
    id: "late-misc",
    name: "Late misc agent",
    description: "Loaded after the consuming modules.",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
  },
  {
    id: "storyboard",
    name: "Storyboard",
    description: "Must remain directly after Illustrator regardless of manifest order.",
    phase: "post_processing",
    enabledByDefault: false,
    category: "misc",
  },
  {
    id: "director",
    name: "Director",
    description: "Deliberately excluded from writer approval.",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "writer",
    libraryHidden: true,
  },
  {
    id: "knowledge-retrieval",
    name: "Knowledge retrieval",
    description: "Deliberately excluded from writer approval.",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "writer",
    libraryHidden: true,
  },
  {
    id: "knowledge-router",
    name: "Knowledge router",
    description: "Deliberately excluded from writer approval.",
    phase: "pre_generation",
    enabledByDefault: false,
    category: "writer",
    libraryHidden: true,
  },
];

replaceBuiltInAgentDefinitions(manifests);

assert.equal(
  isReviewableWriterAgentType("late-writer"),
  true,
  "Writer approval eligibility must observe agents hydrated after module import",
);
assert.equal(isReviewableWriterAgentType("illustrator"), false);
assert.equal(isReviewableWriterAgentType("late-tracker"), false);
assert.equal(isReviewableWriterAgentType("director"), false);
assert.equal(isReviewableWriterAgentType("knowledge-retrieval"), false);
assert.equal(isReviewableWriterAgentType("knowledge-router"), false);

const settingsOrder = buildRoleplayAgentSettingsOrder(manifests);
assert.equal(settingsOrder.get("late-writer"), 0);
assert.equal(settingsOrder.get("late-tracker"), 1);
assert.equal(settingsOrder.get("illustrator"), 2);
assert.equal(settingsOrder.get("storyboard"), 2.5);
assert.equal(settingsOrder.get("late-misc"), 3);

const visibleManifests = manifests.filter((agent) => !agent.libraryHidden);
const menuOrder = [...visibleManifests]
  .sort(
    (a, b) =>
      (settingsOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (settingsOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  )
  .map((agent) => agent.id);
const activeSettingsOrder = ["writer", "tracker", "misc"].flatMap((category) =>
  visibleManifests
    .filter((agent) => agent.category === category)
    .sort(
      (a, b) =>
        (settingsOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (settingsOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
    .map((agent) => agent.id),
);
assert.deepEqual(activeSettingsOrder, menuOrder, "Roleplay quick links and active settings must share one order");

// Connections can mount before this query resolves. It must use the React Query
// result, rather than reading the mutable shared registry that is already hydrated.
assert.deepEqual(
  selectVisibleTrackerCapabilityAgents(undefined),
  [],
  "Connections must show no tracker agents until the capability-agent query hydrates",
);
assert.deepEqual(
  selectVisibleTrackerCapabilityAgents(manifests).map((agent) => agent.id),
  ["late-tracker"],
  "Connections must include hydrated visible trackers and exclude hidden agents",
);

const refreshedManifests = manifests.map((agent) =>
  agent.id === "late-tracker" ? { ...agent, id: "refreshed-tracker", name: "Refreshed tracker" } : agent,
);
assert.deepEqual(
  selectVisibleTrackerCapabilityAgents(refreshedManifests).map((agent) => agent.id),
  ["refreshed-tracker"],
  "Connections must use refreshed capability-agent definitions while it remains mounted",
);

const pendingNoodleUpdate = {
  id: "noodle",
  version: "1.0.9",
  manifest: {
    entrypoints: { client: "client.js" },
    contributions: {
      slots: ["home-browser-tab"],
      homeBrowserTab: { label: "Noodle", ariaLabel: "Open Noodle" },
    },
  },
  status: "restart-required",
  readiness: "pending",
  previousVersion: "1.0.8",
} as unknown as InstalledCapabilityPackage;
assert.equal(isCapabilityPackageAvailableUntilRestart(pendingNoodleUpdate), true);
assert.deepEqual(
  selectHomeBrowserPackages([pendingNoodleUpdate]).map((item) => item.id),
  ["noodle"],
  "A Noodle update waiting for restart must keep the already-loaded Home tab visible",
);
assert.deepEqual(
  selectHomeBrowserPackages([{ ...pendingNoodleUpdate, previousVersion: undefined }]).map((item) => item.id),
  [],
  "A first install waiting for restart must not expose a client module that has never loaded",
);

const connectionsPanelSource = await readFile(
  new URL("../../packages/client/src/components/panels/ConnectionsPanel.tsx", import.meta.url),
  "utf8",
);
const sidecarCardStart = connectionsPanelSource.indexOf("function SidecarCard()");
const sidecarCardEnd = connectionsPanelSource.indexOf("\nfunction connectionMatchesSearch", sidecarCardStart);
assert.ok(sidecarCardStart >= 0 && sidecarCardEnd > sidecarCardStart, "Connections must retain the Sidecar card");
const sidecarCardSource = connectionsPanelSource.slice(sidecarCardStart, sidecarCardEnd);
assert.match(
  sidecarCardSource,
  /const \{ data: capabilityAgents \} = useCapabilityAgentRegistry\(\);/u,
  "Connections must subscribe to React-visible capability-agent query data",
);
assert.match(
  sidecarCardSource,
  /const trackerAgents = useMemo\(\s*\(\) => selectVisibleTrackerCapabilityAgents\(capabilityAgents\),\s*\[capabilityAgents\],?\s*\);/u,
  "Connections must recompute visible trackers when capability-agent query data changes",
);
assert.match(
  sidecarCardSource,
  /const trackerLocalCount = useMemo\(\(\) => \{[\s\S]*?return trackerAgents\.filter\([\s\S]*?\}, \[agentConfigs, trackerAgents\]\);/u,
  "the Sidecar count must consume the reactive tracker list",
);

const capabilityPackageRoutesSource = await readFile(
  new URL("../../packages/server/src/routes/capability-packages.routes.ts", import.meta.url),
  "utf8",
);
assert.match(
  capabilityPackageRoutesSource,
  /if \(installed\.status !== "restart-required"\) await refreshCapabilityAgentRegistry\(\);/u,
  "A restart-required update must retain the current session's agent registry until restart",
);
const assignHandlerStart = sidecarCardSource.indexOf("const handleAssignTrackersToLocal = async () => {");
const assignHandlerEnd = sidecarCardSource.indexOf("\n  const handleModelLoadToggle", assignHandlerStart);
assert.ok(
  assignHandlerStart >= 0 && assignHandlerEnd > assignHandlerStart,
  "Connections must retain assign-all handling",
);
assert.match(
  sidecarCardSource.slice(assignHandlerStart, assignHandlerEnd),
  /trackerAgents\.map\(async \(agent\) => \{/u,
  "assign-all must consume the same reactive tracker list",
);
assert.match(
  sidecarCardSource,
  /onClick=\{\(\) => void handleAssignTrackersToLocal\(\)\}/u,
  "the assign-all button must invoke the reactive tracker handler",
);
assert.match(
  sidecarCardSource,
  /\{trackerLocalCount\}\/\{trackerAgents\.length\}/u,
  "the rendered Sidecar count must use the reactive assigned and total tracker values",
);

console.info("Agent registry hydration regression passed.");
