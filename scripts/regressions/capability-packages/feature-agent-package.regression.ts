// Which installed package a Feature agent belongs to: the registry-owned package ID wins, an unowned manifest borrows
// nothing, and a legacy agent-detail contribution is the fallback.
import assert from "node:assert/strict";
import { resolveFeatureAgentPackage } from "../../../packages/client/src/lib/feature-agent-package.js";
import { type BuiltInAgentManifest, type InstalledCapabilityPackage } from "../../../packages/shared/src/index.js";

const installedFeaturePackage = {
  id: "chess",
  manifest: { contributions: { slots: ["conversation-surface"] } },
} as InstalledCapabilityPackage;
assert.equal(
  resolveFeatureAgentPackage({ id: "chess", packageId: "chess" } as BuiltInAgentManifest, [installedFeaturePackage]),
  installedFeaturePackage,
  "Feature agents must resolve their installed package through the registry-owned package ID",
);
assert.equal(
  resolveFeatureAgentPackage({ id: "chess" } as BuiltInAgentManifest, [installedFeaturePackage]),
  null,
  "Unowned feature manifests must not borrow an unrelated installed package",
);
const contributedFeaturePackage = {
  id: "world-maps",
  manifest: { contributions: { agentDetail: { agentIds: ["hierarchical-maps"] } } },
} as InstalledCapabilityPackage;
assert.equal(
  resolveFeatureAgentPackage({ id: "chess", packageId: "chess" } as BuiltInAgentManifest, [
    {
      id: "legacy-chess-detail",
      manifest: { contributions: { agentDetail: { agentIds: ["chess"] } } },
    } as InstalledCapabilityPackage,
    installedFeaturePackage,
  ]),
  installedFeaturePackage,
  "The registry-owned Feature package must win when a legacy contribution appears first",
);
assert.equal(
  resolveFeatureAgentPackage({ id: "hierarchical-maps" } as BuiltInAgentManifest, [contributedFeaturePackage]),
  contributedFeaturePackage,
  "Feature detail contributions must remain a compatible ownership fallback",
);
